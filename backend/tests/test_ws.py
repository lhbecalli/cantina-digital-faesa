import pytest
from starlette.websockets import WebSocketDisconnect

from tests.conftest import HA, PIN, SID, SID2, student


def recv_state(ws):
    while True:
        m = ws.receive_json()
        if m["type"] == "state":
            return m["state"]


def auth(pin):
    return {"type": "auth", "pin": pin}


def recusa(client, msg) -> int:
    with client.websocket_connect("/ws?role=admin") as ws:
        ws.send_json(msg)
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
    return e.value.code


def test_ws_envia_estado_inicial_e_eventos(client):
    with client.websocket_connect("/ws?role=admin") as admin, client.websocket_connect(f"/ws?role=student&sid={SID}") as aluno:
        admin.send_json(auth(PIN))
        a0, s0 = recv_state(admin), recv_state(aluno)
        assert len(a0["orders"]) > 10 and s0["orders"] == []
        # pedido feito pelo "celular" chega no painel na hora
        r = client.post("/api/orders", json={"lines": [{"id": "misto", "qty": 1}], "clientRequestId": "ws-aaaaaaaa"}, headers=student(SID))
        n = r.json()["result"]["number"]
        assert any(o["number"] == n for o in recv_state(admin)["orders"])
        assert [o["number"] for o in recv_state(aluno)["orders"]] == [n]
        # painel avança o status e o aluno é notificado
        client.post(f"/api/admin/orders/{n}/payment", headers=HA); recv_state(admin); recv_state(aluno)
        client.patch(f"/api/admin/orders/{n}/status", json={"status": "pronto"}, headers=HA)
        recv_state(admin)
        s = recv_state(aluno)
        assert s["orders"][0]["status"] == "pronto" and s["notifications"][0]["number"] == n


def test_ws_isola_alunos(client):
    with client.websocket_connect(f"/ws?role=student&sid={SID2}") as outro:
        recv_state(outro)
        client.post("/api/orders", json={"lines": [{"id": "cafe", "qty": 1}]}, headers=student(SID))
        assert recv_state(outro)["orders"] == []  # não vê o pedido do SID


def test_ws_pin_errado_e_sid_invalido_sao_recusados(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws?role=student&sid=curto") as ws:
            ws.receive_json()
    for msg in (auth("errado"), auth(123), auth("\ud800"), {"pin": PIN}, [], "ping"):
        assert recusa(client, msg) == 4403


def test_ws_pin_na_url_nao_autentica(client):
    with client.websocket_connect(f"/ws?role=admin&pin={PIN}") as ws:
        ws.send_text("ping")
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4403


def test_ws_tentativas_de_pin_bloqueiam_inclusive_o_pin_certo(client):
    codes = [recusa(client, auth("errado")) for _ in range(10)]
    assert codes == [4403] * 8 + [4429] * 2
    assert recusa(client, auth(PIN)) == 4429
    assert client.post("/api/admin/auth", headers=HA).status_code == 429  # o bloqueio vale também na API


def test_ws_ping_pong_e_mensagem_grande(client):
    with client.websocket_connect(f"/ws?role=student&sid={SID}") as ws:
        recv_state(ws)
        ws.send_text("ping")
        assert ws.receive_json()["type"] == "pong"
        ws.send_text("x" * 1000)
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 1009


def test_ws_limite_de_conexoes():
    from fastapi.testclient import TestClient
    from app.main import create_app
    from tests.conftest import make_settings
    app = create_app(make_settings(max_ws_connections=1), background=False)
    with TestClient(app) as c, c.websocket_connect(f"/ws?role=student&sid={SID}") as ws1:
        recv_state(ws1)
        with pytest.raises(WebSocketDisconnect) as e:
            with c.websocket_connect(f"/ws?role=student&sid={SID2}") as ws2:
                ws2.receive_json()
        assert e.value.code == 1013
