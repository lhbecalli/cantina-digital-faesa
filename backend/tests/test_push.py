import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import db
from app.main import create_app
from tests.conftest import HA, SID, SID2, make_settings, student

SUB = {"endpoint": "https://push.example.test/send/abc123456789", "keys": {"p256dh": "B" * 40, "auth": "a" * 16}}


class FakePush:
    def __init__(self):
        self.calls, self.fail_with = [], None

    def __call__(self, subscription, payload, settings):
        if self.fail_with:
            err = Exception("boom")
            err.response = type("R", (), {"status_code": self.fail_with})()
            raise err
        self.calls.append((subscription, json.loads(payload)))


@pytest.fixture()
def pclient():
    app = create_app(make_settings(vapid_public_key="PUB" * 20, vapid_private_key="PRIV" * 20), background=False)
    fake = FakePush()
    app.state.notifier.sender = fake
    with TestClient(app) as c:
        c.fake, c.app_ = fake, app
        yield c


def make_ready(c, sid=SID, key="push-aaaaaaaa"):
    n = c.post("/api/orders", json={"lines": [{"id": "cafe", "qty": 1}], "clientRequestId": key}, headers=student(sid)).json()["result"]["number"]
    c.post(f"/api/admin/orders/{n}/payment", headers=HA)
    return n


def log_actions(c):
    return [a["action"] for a in c.get("/api/admin/state", headers=HA).json()["state"]["log"]]


def pronto(c, n):
    r = c.patch(f"/api/admin/orders/{n}/status", json={"status": "pronto"}, headers=HA)
    c.app_.state.notifier.flush()
    return r


def test_config_e_assinatura(pclient):
    cfg = pclient.get("/api/push/config").json()
    assert cfg["enabled"] is True and cfg["publicKey"]
    assert pclient.post("/api/push/subscribe", json=SUB, headers=student()).status_code == 201
    assert pclient.post("/api/push/subscribe", json=SUB, headers=student()).json()["subscriptions"] == 1  # idempotente
    assert pclient.post("/api/push/subscribe", json={**SUB, "endpoint": "http://inseguro.test/x" + "a" * 20}, headers=student()).status_code == 422
    assert pclient.post("/api/push/subscribe", json=SUB).status_code == 400  # sem id de aluno


def test_so_o_dono_remove(pclient):
    pclient.post("/api/push/subscribe", json=SUB, headers=student(SID))
    r = pclient.request("DELETE", "/api/push/subscribe", json={"endpoint": SUB["endpoint"]}, headers=student(SID2))
    assert r.json()["removed"] is False
    assert pclient.request("DELETE", "/api/push/subscribe", json={"endpoint": SUB["endpoint"]}, headers=student(SID)).json()["removed"] is True
    assert pclient.request("DELETE", "/api/push/subscribe", json={"endpoint": SUB["endpoint"]}, headers=student(SID)).json()["removed"] is False


def test_sem_chaves_o_servidor_recusa(client):
    assert client.get("/api/push/config").json() == {"enabled": False, "publicKey": None}
    assert client.post("/api/push/subscribe", json=SUB, headers=student()).status_code == 503


def test_pronto_envia_push_uma_unica_vez(pclient):
    pclient.post("/api/push/subscribe", json=SUB, headers=student())
    n = make_ready(pclient)
    pronto(pclient, n)
    assert len(pclient.fake.calls) == 1
    sub, payload = pclient.fake.calls[0]
    assert sub["endpoint"] == SUB["endpoint"] and payload["tag"] == f"pedido-{n}" and f"#{n:04d} pronto" in payload["title"] and payload["url"] == f"/pedidos/{n}"
    pronto(pclient, n)  # repetir "pronto" não reenvia
    assert len(pclient.fake.calls) == 1
    assert any("Web Push: enviado (1)" in a for a in log_actions(pclient))


def test_nao_envia_para_outro_aluno_nem_em_preparo(pclient):
    pclient.post("/api/push/subscribe", json=SUB, headers=student(SID2))
    n = make_ready(pclient, SID)  # pedido do SID; assinatura é do SID2
    pronto(pclient, n)
    assert pclient.fake.calls == [] and any("sem assinatura" in a for a in log_actions(pclient))


@pytest.mark.parametrize("code", [404, 410])
def test_assinatura_expirada_e_removida(pclient, code):
    pclient.post("/api/push/subscribe", json=SUB, headers=student())
    pclient.fake.fail_with = code
    pronto(pclient, make_ready(pclient))
    with pclient.app_.state.run.__closure__[0].cell_contents() as s:  # SessionLocal
        assert s.scalars(select(db.PushSubscription)).first() is None
    assert any("falhou" in a for a in log_actions(pclient))


def test_falha_do_provedor_nao_derruba_a_api(pclient):
    pclient.post("/api/push/subscribe", json=SUB, headers=student())
    pclient.fake.fail_with = 500
    r = pronto(pclient, make_ready(pclient))
    assert r.status_code == 200 and r.json()["result"]["status"] == "pronto"
    assert pclient.get("/healthz").status_code == 200
