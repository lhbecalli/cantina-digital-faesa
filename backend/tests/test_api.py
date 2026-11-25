from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from tests.conftest import HA, PIN, SID, SID2, make_settings, student


def order(client, sid=SID, key="k-aaaaaaaa", lines=None):
    return client.post("/api/orders", json={"lines": lines or [{"id": "misto", "qty": 1}], "clientRequestId": key}, headers=student(sid))


def test_healthz_e_headers_de_seguranca(client):
    r = client.get("/healthz")
    assert r.json()["ok"] is True
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert "default-src 'self'" in r.headers["content-security-policy"]


def test_aluno_precisa_de_id_valido(client):
    assert client.get("/api/state").status_code == 400
    assert client.get("/api/state", headers=student("curto")).status_code == 400
    assert client.get("/api/state", headers=student(SID)).status_code == 200


def test_cria_pedido_e_so_o_dono_ve(client):
    r = order(client)
    assert r.status_code == 201 and r.json()["result"]["number"] == 44
    mine = client.get("/api/orders", headers=student(SID)).json()
    other = client.get("/api/orders", headers=student(SID2)).json()
    assert [o["number"] for o in mine] == [44] and other == []


def test_pedido_idempotente_via_http(client):
    a, b = order(client), order(client)
    assert a.status_code == 201 and b.status_code == 200
    assert a.json()["result"]["id"] == b.json()["result"]["id"]


def test_validacao_pydantic(client):
    assert client.post("/api/orders", json={"lines": []}, headers=student()).status_code == 422
    assert client.post("/api/orders", json={"lines": [{"id": "misto", "qty": 999}]}, headers=student()).status_code == 422
    r = client.post("/api/orders", json={"lines": [{"id": "cookie", "qty": 1}]}, headers=student())
    assert r.status_code == 409 and r.json()["error"]["code"] == "item_unavailable"


def test_rotas_admin_exigem_pin(client):
    assert client.post("/api/admin/reset").status_code == 403
    assert client.post("/api/admin/orders/42/payment", headers={"X-Admin-Pin": "errado"}).status_code == 403
    assert client.get("/api/admin/state").status_code == 403
    r = client.get("/api/admin/state", headers=HA)
    assert r.status_code == 200 and len(r.json()["state"]["orders"]) > 10


def test_fluxo_completo_e_idempotencia_admin(client):
    n = order(client).json()["result"]["number"]
    assert client.post(f"/api/admin/orders/{n}/payment", headers=HA).json()["result"]["status"] == "preparo"
    assert client.post(f"/api/admin/orders/{n}/payment", headers=HA).json()["result"]["status"] == "preparo"
    assert client.patch(f"/api/admin/orders/{n}/status", json={"status": "retirado"}, headers=HA).status_code == 409
    assert client.patch(f"/api/admin/orders/{n}/status", json={"status": "pronto"}, headers=HA).json()["result"]["status"] == "pronto"
    st = client.get("/api/state", headers=student(SID)).json()["state"]
    assert st["orders"][0]["status"] == "pronto" and st["notifications"][0]["number"] == n
    assert client.get("/api/state", headers=student(SID2)).json()["state"]["notifications"] == []


def test_cardapio_admin_e_visivel_ao_aluno(client):
    assert client.patch("/api/admin/menu/misto", json={"available": False}, headers=HA).json()["result"]["available"] is False
    r = order(client, key="k-bbbbbbbb")
    assert r.status_code == 409
    assert client.post("/api/admin/menu", json={"name": "Pastel", "cat": "salgados", "price": 8}, headers=HA).status_code == 201
    assert any(m["id"] == "pastel" for m in client.get("/api/menu").json())


def test_reset_da_demo_com_pin(client):
    order(client)
    assert client.post("/api/admin/reset", headers=HA).status_code == 200
    assert client.get("/api/orders", headers=student(SID)).json() == []
    assert client.get("/api/admin/state", headers=HA).json()["state"]["nextNumber"] == 44


def test_renomear_aluno(client):
    r = client.put("/api/student", json={"name": "  <Ana>  "}, headers=student())
    assert r.json()["result"]["name"] == "Ana"
    assert order(client).json()["state"]["orders"][0]["customer"] == "Ana"


def test_corpo_grande_e_rate_limit():
    app = create_app(make_settings(max_body_bytes=200, rate_limit_per_min=5), background=False)
    with TestClient(app) as c:
        assert c.post("/api/orders", content=b"x" * 500, headers={**student(), "content-type": "application/json"}).status_code == 413
        codes = [c.get("/api/menu").status_code for _ in range(8)]
        assert 429 in codes


def test_limite_de_pedidos_por_aluno():
    app = create_app(make_settings(order_rate_per_min=2), background=False)
    with TestClient(app) as c:
        codes = [order(c, key=f"chave-{i}-aaaaaa").status_code for i in range(4)]
        assert codes[:2] == [201, 201] and codes[2] == 429


def test_tentativas_de_pin_sao_limitadas(client):
    codes = [client.post("/api/admin/auth", headers={"X-Admin-Pin": "x"}).status_code for _ in range(12)]
    assert 429 in codes


def test_cors_restrito(client):
    ok = client.options("/api/menu", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/menu", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


def test_producao_exige_admin_pin(monkeypatch):
    from app.config import Settings
    monkeypatch.delenv("ADMIN_PIN", raising=False)
    with pytest.raises(RuntimeError):
        Settings(app_env="production")


def test_agente_via_api_devolve_carrinho(client):
    r = client.post("/api/agent/chat", json={"message": "quero 2 sucos de laranja e um misto", "cart": []}, headers=student()).json()
    assert {ln["id"]: ln["qty"] for ln in r["cart"]["lines"]} == {"suco-laranja": 2, "misto": 1} and r["cart"]["viaIA"] is True
    assert any(t["name"] == "adicionar_ao_carrinho" for t in r["tools"])
    r2 = client.post("/api/agent/chat", json={"message": "tira o suco", "cart": r["cart"]["lines"]}, headers=student()).json()
    assert [ln["id"] for ln in r2["cart"]["lines"]] == ["misto"]
    assert client.post("/api/agent/chat", json={"message": "x" * 400, "cart": []}, headers=student()).status_code == 422


def test_pin_certo_e_recusado_depois_do_limite(client):
    for _ in range(8):
        assert client.post("/api/admin/auth", headers={"X-Admin-Pin": "x"}).status_code == 403
    assert client.post("/api/admin/auth", headers=HA).status_code == 429


def test_pin_certo_nao_conta_como_falha(client):
    assert {client.post("/api/admin/auth", headers=HA).status_code for _ in range(20)} == {200}


def test_x_forwarded_for_forjado_nao_escapa_do_bloqueio():
    from fastapi.testclient import TestClient

    with TestClient(create_app(make_settings(trust_proxy=True), background=False)) as c:
        codes = [c.post("/api/admin/auth", headers={"X-Admin-Pin": "x", "X-Forwarded-For": f"203.0.113.{i}, 198.51.100.7"}).status_code for i in range(10)]
        assert codes == [403] * 8 + [429] * 2
        # outro visitante (outro último valor, escrito pelo proxy) não é afetado
        assert c.post("/api/admin/auth", headers={**HA, "X-Forwarded-For": "198.51.100.8"}).status_code == 200


def test_sem_admin_pin_em_dev_gera_pin_aleatorio(monkeypatch):
    from app.config import Settings

    monkeypatch.delenv("ADMIN_PIN", raising=False)
    a, b = Settings(app_env="development"), Settings(app_env="development")
    assert a.admin_pin_generated and len(a.admin_pin) == 8 and a.admin_pin.isdigit() and a.admin_pin != b.admin_pin
