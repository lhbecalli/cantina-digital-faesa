import threading

import pytest
from sqlalchemy import func, select

from app import db, service
from app.service import ApiError


def mk(session, sid="aluno-teste-0001", lines=None, key=None):
    return service.create_order(session, student_id=sid, name="Teste", lines=lines or [{"id": "misto", "qty": 1}], client_request_id=key)


def test_numeracao_sequencial_e_ids_unicos(session):
    a, _ = mk(session)
    b, _ = mk(session, "aluno-teste-0002")
    assert (a["number"], b["number"]) == (44, 45)
    assert a["id"] != b["id"] and a["status"] == "aguardando"


def test_idempotencia_por_chave(session):
    a, c1 = mk(session, key="chave-12345678")
    b, c2 = mk(session, key="chave-12345678")
    assert c1 is True and c2 is False and a["id"] == b["id"]
    assert session.scalar(select(func.count()).select_from(db.Order).where(db.Order.client_request_id == "chave-12345678")) == 1


def test_chave_de_outro_aluno_e_conflito(session):
    mk(session, key="chave-12345678")
    with pytest.raises(ApiError) as e:
        mk(session, "aluno-teste-0002", key="chave-12345678")
    assert e.value.status == 409


def test_validacoes(session):
    with pytest.raises(ApiError):
        service.create_order(session, student_id="x", name=None, lines=[{"id": "misto", "qty": 1}])  # id curto
    with pytest.raises(ApiError) as e:
        service.create_order(session, student_id='aluno-teste-0001', name='T', lines=[])
    assert e.value.code == "empty_order"
    with pytest.raises(ApiError) as e:
        mk(session, lines=[{"id": "nada", "qty": 1}])
    assert e.value.code == "item_not_found"
    with pytest.raises(ApiError) as e:
        mk(session, lines=[{"id": "cookie", "qty": 1}])
    assert e.value.code == "item_unavailable" and e.value.status == 409


def test_confirmar_pagamento_duas_vezes_nao_muda(session):
    rev0 = service._rev(session)
    assert service.confirm_payment(session, 42)["status"] == "preparo"
    rev1 = service._rev(session)
    assert service.confirm_payment(session, 42)["status"] == "preparo"
    assert service._rev(session) == rev1 > rev0


def test_transicoes_validas(session):
    with pytest.raises(ApiError) as e:
        service.update_status(session, 42, "pronto")  # pula o preparo
    assert e.value.code == "invalid_transition"
    service.confirm_payment(session, 42)
    assert service.update_status(session, 42, "pronto")["status"] == "pronto"
    assert service.update_status(session, 42, "pronto")["status"] == "pronto"  # idempotente
    assert service.update_status(session, 42, "preparo")["status"] == "pronto"  # não volta
    assert service.update_status(session, 42, "retirado")["status"] == "retirado"
    with pytest.raises(ApiError):
        service.update_status(session, 999, "pronto")


def test_pronto_notifica_o_aluno_dono_uma_vez(session):
    service.confirm_payment(session, 42)
    service.update_status(session, 42, "pronto")
    service.update_status(session, 42, "pronto")
    notes = list(session.scalars(select(db.Notification)))
    mine = [n for n in notes if n.student_id == "seed-luiz" and n.number == 42]
    assert len(mine) == 1
    assert any("Notificar aluno" in a.workflow for a in session.scalars(select(db.AutomationLog)))


def test_snapshot_do_aluno_so_traz_o_que_e_dele(session):
    mk(session, "aluno-teste-0001")
    st = service.snapshot(session, "e", student_id="aluno-teste-0001")
    assert [o["customer"] for o in st["orders"]] == ["Teste"] and st["log"] == [] and st["reports"] == []
    other = service.snapshot(session, "e", student_id="aluno-teste-0002")
    assert other["orders"] == []
    adm = service.snapshot(session, "e", admin=True)
    assert len(adm["orders"]) > 10 and adm["log"]


def test_cardapio_validacoes(session):
    assert service.patch_menu(session, "misto", False, None)["available"] is False
    assert service.patch_menu(session, "misto", None, 12.5)["price"] == 12.5
    with pytest.raises(ApiError):
        service.patch_menu(session, "misto", None, -1)
    with pytest.raises(ApiError):
        service.patch_menu(session, "x", True, None)
    a = service.add_menu_item(session, "Pastel", "salgados", 8)
    b = service.add_menu_item(session, "Pastel", "salgados", 9)
    assert (a["id"], b["id"]) == ("pastel", "pastel-2")
    with pytest.raises(ApiError):
        service.add_menu_item(session, "X", "pizzas", 1)


def test_relatorio_e_texto_sanitizado(session):
    r = service.fire_report(session, "manual")
    assert r["orders"] > 5 and r["revenue"] > 0
    assert service.clean_name("<b>Ana</b>\x00\x1f") == "bAna/b"
    assert service.clean_name("   ") == "Aluno"


def test_concorrencia_numeracao_sem_colisao(app):
    """Vários pedidos simultâneos (threads, cada uma com sua sessão) nunca repetem número."""
    factory = app.state.run.__closure__  # noqa: F841  (apenas garante que o app foi criado)
    from app import service as svc

    results, errors = [], []

    def worker(i: int) -> None:
        try:
            order = __import__("asyncio").run(app.state.run(lambda s: svc.create_order(s, student_id=f"aluno-conc-{i:04d}", name=f"A{i}", lines=[{"id": "cafe", "qty": 1}])[0]))
            results.append(order["number"])
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    ts = [threading.Thread(target=worker, args=(i,)) for i in range(25)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert not errors and len(results) == 25 and len(set(results)) == 25
    assert sorted(results) == list(range(44, 69))
