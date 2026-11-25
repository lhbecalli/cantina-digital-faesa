"""API da Cantina Digital FAESA (FastAPI): REST + WebSocket + SPAs estáticas na mesma origem."""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal, TypeVar

from fastapi import FastAPI, Header, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker
from starlette.concurrency import run_in_threadpool
from starlette.staticfiles import StaticFiles

from . import agent, db, llm, push, seed, service
from .config import Settings, get_settings
from .realtime import Conn, Hub
from .service import ApiError

log = logging.getLogger("cantina")
T = TypeVar("T")


# ---------- schemas (validação) ----------
class LineIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    qty: int = Field(ge=1, le=20)


class CreateOrderIn(BaseModel):
    lines: list[LineIn] = Field(min_length=1, max_length=30)
    via: Literal["app", "ia"] = "app"
    clientRequestId: str | None = Field(default=None, min_length=8, max_length=80)


class StudentIn(BaseModel):
    name: str = Field(min_length=1, max_length=30)


class StatusIn(BaseModel):
    status: Literal["aguardando", "preparo", "pronto", "retirado"]


class MenuPatchIn(BaseModel):
    available: bool | None = None
    price: float | None = Field(default=None, ge=0, le=999)


class NewItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    cat: Literal["lanches", "salgados", "sucos", "bebidas", "doces"]
    price: float = Field(ge=0, le=999)
    desc: str = Field(default="", max_length=90)
    tags: list[Literal["sem-acucar", "vegetariano"]] = Field(default_factory=list, max_length=2)


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=20, max_length=200)
    auth: str = Field(min_length=8, max_length=100)


class PushSubIn(BaseModel):
    endpoint: str = Field(min_length=20, max_length=600, pattern=r"^https://")
    keys: PushKeys


class PushUnsubIn(BaseModel):
    endpoint: str = Field(min_length=20, max_length=600)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=300)
    cart: list[LineIn] = Field(default_factory=list, max_length=30)
    viaIA: bool = False


# ---------- limites ----------
PIN_MAX_FAILURES = 8  # tentativas erradas de PIN por IP por minuto (API e WebSocket somados)
WS_AUTH_TIMEOUT = 5.0  # segundos para o painel enviar o PIN depois de abrir o WebSocket


class RateLimiter:
    def __init__(self) -> None:
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def blocked(self, key: str, limit: int, window: float = 60.0) -> bool:
        """Diz se o limite já foi atingido, sem registrar uma nova ocorrência."""
        now = time.monotonic()
        return sum(1 for t in self.hits.get(key, ()) if now - t <= window) >= limit

    def allow(self, key: str, limit: int, window: float = 60.0) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        if len(self.hits) > 5000:  # evita crescer sem limite
            for k in [k for k, v in self.hits.items() if not v or now - v[-1] > window][:1000]:
                self.hits.pop(k, None)
        return True


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
}


class SPAStatic(StaticFiles):
    """StaticFiles com fallback para index.html (rotas do React Router)."""

    async def get_response(self, path: str, scope):  # noqa: ANN001
        try:
            return await super().get_response(path, scope)
        except Exception as e:  # noqa: BLE001
            if getattr(e, "status_code", None) == 404 and "." not in Path(path).name:
                return await super().get_response("index.html", scope)
            raise


def create_app(settings: Settings | None = None, session_factory: sessionmaker | None = None, *, background: bool = True) -> FastAPI:
    cfg = settings or get_settings()
    if session_factory is None:
        if cfg.database_url.startswith("sqlite:///") and ":memory:" not in cfg.database_url:
            Path(cfg.database_url.replace("sqlite:///", "", 1)).parent.mkdir(parents=True, exist_ok=True)
        engine = db.make_engine(cfg.database_url)
        db.Base.metadata.create_all(engine)
        session_factory = db.make_session_factory(engine)
    SessionLocal = session_factory
    epoch = uuid.uuid4().hex
    limiter = RateLimiter()
    with SessionLocal() as s:
        seed.ensure_seed(s)

    def build_state(role: str, student_id: str | None) -> dict:
        with SessionLocal() as s:
            return service.snapshot(s, epoch, student_id=student_id, admin=role == "admin")

    hub = Hub(build_state, cfg.max_ws_connections)
    loop_ref: dict[str, Any] = {}

    def broadcast_from_thread() -> None:  # o envio de push roda em thread; avisa o painel (log de automações) no loop principal
        loop = loop_ref.get("loop")
        if loop is not None and loop.is_running():
            asyncio.run_coroutine_threadsafe(hub.broadcast(), loop)

    notifier = push.Notifier(cfg, SessionLocal, after_log=broadcast_from_thread)
    service.status_hook = notifier.on_status

    async def run(fn: Callable[[Session], T]) -> T:
        def inner() -> T:
            with SessionLocal() as s:
                return fn(s)
        return await run_in_threadpool(inner)

    async def report_loop() -> None:
        while True:
            await asyncio.sleep(cfg.report_interval_seconds)
            try:
                await run(lambda s: service.fire_report(s, "cron"))
                await hub.broadcast()
            except Exception:  # noqa: BLE001
                log.exception("falha no relatório agendado")

    async def ping_loop() -> None:
        while True:
            await asyncio.sleep(25)
            await hub.ping()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        loop_ref["loop"] = asyncio.get_running_loop()
        tasks = [asyncio.create_task(report_loop()), asyncio.create_task(ping_loop())] if background else []
        if cfg.admin_pin_generated:
            log.warning("ADMIN_PIN não definido. PIN do painel gerado para esta execução: %s", cfg.admin_pin)
        yield
        for t in tasks:
            t.cancel()

    app = FastAPI(title="Cantina Digital FAESA", version="1.0.0", lifespan=lifespan, docs_url=None if cfg.production else "/docs", redoc_url=None, openapi_url=None if cfg.production else "/openapi.json")
    app.state.hub, app.state.settings, app.state.run, app.state.limiter, app.state.epoch, app.state.notifier = hub, cfg, run, limiter, epoch, notifier
    if cfg.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Content-Type", "X-Student-Id", "X-Admin-Pin"], max_age=600)

    def client_ip(conn: Request | WebSocket) -> str:
        # Só o ÚLTIMO valor de X-Forwarded-For é escrito pelo proxy confiável; os anteriores vêm do cliente e podem ser forjados.
        forwarded = ",".join(conn.headers.getlist("x-forwarded-for")).split(",")[-1].strip() if cfg.trust_proxy else ""
        return forwarded or (conn.client.host if conn.client else "?")

    def check_pin(ip: str, pin: str | None) -> Literal["ok", "invalid", "blocked"]:
        key = "pin:" + ip
        if limiter.blocked(key, PIN_MAX_FAILURES):  # antes de comparar: bloqueado, nem o PIN certo passa
            return "blocked"
        if pin and hmac.compare_digest(pin.encode("utf-8", "replace"), cfg.admin_pin.encode()):
            return "ok"
        limiter.allow(key, PIN_MAX_FAILURES)  # registra a falha
        return "invalid"

    @app.middleware("http")
    async def guards(request: Request, call_next):  # noqa: ANN001
        ip = client_ip(request)
        request.state.ip = ip
        if request.url.path.startswith("/api"):
            if int(request.headers.get("content-length") or 0) > cfg.max_body_bytes:
                return JSONResponse({"error": {"code": "payload_too_large", "message": "Corpo grande demais."}}, status_code=413)
            if not limiter.allow("ip:" + ip, cfg.rate_limit_per_min):
                return JSONResponse({"error": {"code": "rate_limited", "message": "Muitas requisições. Aguarde um instante."}}, status_code=429, headers={"Retry-After": "30"})
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            if request.url.path.startswith(("/docs", "/openapi")) and k == "Content-Security-Policy":
                continue
            response.headers.setdefault(k, v)
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ApiError)
    async def api_error(_: Request, e: ApiError):  # noqa: ANN001
        return JSONResponse({"error": {"code": e.code, "message": e.message, "details": e.details}}, status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, e: RequestValidationError):  # noqa: ANN001
        return JSONResponse({"error": {"code": "invalid_request", "message": "Dados inválidos.", "details": [{"loc": x.get("loc"), "msg": x.get("msg")} for x in e.errors()][:5]}}, status_code=422)

    # ---------- identidade ----------
    def student_of(x_student_id: str | None) -> str:
        return service.valid_student_id(x_student_id)

    def admin_only(request: Request, pin: str | None) -> None:
        ip = getattr(request.state, "ip", "?")
        result = check_pin(ip, pin)
        if result == "blocked":
            raise ApiError("rate_limited", "Muitas tentativas de PIN. Aguarde um minuto.", 429)
        if result != "ok":
            raise ApiError("forbidden", "PIN de administrador inválido.", 403)

    async def student_state(sid: str) -> dict:
        return await run_in_threadpool(build_state, "student", sid)

    async def admin_state() -> dict:
        return await run_in_threadpool(build_state, "admin", None)

    # ---------- saúde ----------
    @app.get("/healthz")
    async def healthz() -> dict:
        return {"ok": True, "connections": hub.size, "llm": llm.llm_available(cfg)}

    # ---------- aluno ----------
    @app.get("/api/menu")
    async def get_menu() -> list[dict]:
        return (await run_in_threadpool(build_state, "student", None))["menu"]

    @app.get("/api/state")
    async def get_state(x_student_id: str | None = Header(default=None)) -> dict:
        sid = student_of(x_student_id)
        st = await run(lambda s: service.upsert_student(s, sid))
        await run(lambda s: s.commit())
        state = await student_state(sid)
        return {"result": {"id": st.id, "name": st.name}, "state": state}

    @app.put("/api/student")
    async def put_student(body: StudentIn, x_student_id: str | None = Header(default=None)) -> dict:
        sid = student_of(x_student_id)
        st = await run(lambda s: service.rename_student(s, sid, body.name))
        await hub.broadcast()
        return {"result": {"id": st.id, "name": st.name}, "state": await student_state(sid)}

    @app.get("/api/orders")
    async def my_orders(x_student_id: str | None = Header(default=None)) -> list[dict]:
        return (await student_state(student_of(x_student_id)))["orders"]

    @app.get("/api/notifications")
    async def my_notifications(x_student_id: str | None = Header(default=None)) -> list[dict]:
        return (await student_state(student_of(x_student_id)))["notifications"]

    @app.post("/api/orders", status_code=201)
    async def create_order(body: CreateOrderIn, request: Request, x_student_id: str | None = Header(default=None)):
        sid = student_of(x_student_id)
        if not limiter.allow("order:" + sid, cfg.order_rate_per_min):
            raise ApiError("rate_limited", "Muitos pedidos em sequência. Aguarde um minuto.", 429)
        order, created = await run(lambda s: service.create_order(s, student_id=sid, name=None, lines=[ln.model_dump() for ln in body.lines], via=body.via, client_request_id=body.clientRequestId))
        if created:
            await hub.broadcast()
        return JSONResponse({"result": order, "state": await student_state(sid)}, status_code=201 if created else 200)

    # ---------- Web Push ----------
    @app.get("/api/push/config")
    async def push_config() -> dict:
        return {"enabled": cfg.push_enabled, "publicKey": cfg.vapid_public_key if cfg.push_enabled else None}

    @app.post("/api/push/subscribe", status_code=201)
    async def push_subscribe(body: PushSubIn, x_student_id: str | None = Header(default=None)) -> dict:
        sid = student_of(x_student_id)
        if not cfg.push_enabled:
            raise ApiError("push_disabled", "Notificações push não estão configuradas neste servidor.", 503)

        def save(s: Session) -> int:
            with service.WRITE_LOCK:
                service.upsert_student(s, sid)
                existing = s.get(db.PushSubscription, body.endpoint)
                if existing is not None:
                    existing.student_id, existing.p256dh, existing.auth = sid, body.keys.p256dh, body.keys.auth  # idempotente: reassinar atualiza
                else:
                    count = len(list(s.scalars(select(db.PushSubscription).where(db.PushSubscription.student_id == sid))))
                    if count >= 5:
                        raise ApiError("too_many_subscriptions", "Aparelhos demais para este aluno.", 409)
                    s.add(db.PushSubscription(endpoint=body.endpoint, student_id=sid, p256dh=body.keys.p256dh, auth=body.keys.auth, created_at=service.now_ms()))
                s.commit()
                return len(list(s.scalars(select(db.PushSubscription).where(db.PushSubscription.student_id == sid))))

        return {"ok": True, "subscriptions": await run(save)}

    @app.delete("/api/push/subscribe")
    async def push_unsubscribe(body: PushUnsubIn, x_student_id: str | None = Header(default=None)) -> dict:
        sid = student_of(x_student_id)

        def remove(s: Session) -> bool:
            sub = s.get(db.PushSubscription, body.endpoint)
            if sub is None or sub.student_id != sid:
                return False  # só o dono remove; remover de novo é inofensivo
            s.delete(sub)
            s.commit()
            return True

        return {"ok": True, "removed": await run(remove)}

    @app.post("/api/agent/chat")
    async def agent_chat(body: ChatIn, x_student_id: str | None = Header(default=None)) -> dict:
        sid = student_of(x_student_id)
        state = await student_state(sid)
        name = (await run(lambda s: service.upsert_student(s, sid))).name
        cart = agent.Cart([ln.model_dump() for ln in body.cart], state["menu"], body.viaIA)
        reply = agent.respond(body.message, state["menu"], state["orders"], cart, name)
        if reply["text"].startswith("Não entendi."):  # regras não entenderam: LLM opcional (desligado por padrão)
            extra = await run_in_threadpool(llm.llm_reply, cfg, body.message, state["menu"])
            if extra:
                reply["text"] = extra
                reply["tools"].append({"name": "llm_responder", "args": {}, "result": "ok"})
        reply["cart"] = {"lines": cart.data, "viaIA": cart.via_ia}
        return reply

    # ---------- administração (PIN) ----------
    @app.post("/api/admin/auth")
    async def admin_auth(request: Request, x_admin_pin: str | None = Header(default=None)) -> dict:
        admin_only(request, x_admin_pin)
        return {"ok": True}

    @app.get("/api/admin/state")
    async def get_admin_state(request: Request, x_admin_pin: str | None = Header(default=None)) -> dict:
        admin_only(request, x_admin_pin)
        return {"result": None, "state": await admin_state()}

    async def admin_cmd(request: Request, pin: str | None, fn: Callable[[Session], Any], status: int = 200) -> JSONResponse:
        admin_only(request, pin)
        result = await run(fn)
        await hub.broadcast()
        return JSONResponse({"result": result, "state": await admin_state()}, status_code=status)

    @app.post("/api/admin/orders/{number}/payment")
    async def confirm_payment(number: int, request: Request, x_admin_pin: str | None = Header(default=None)):
        return await admin_cmd(request, x_admin_pin, lambda s: service.confirm_payment(s, number))

    @app.patch("/api/admin/orders/{number}/status")
    async def update_status(number: int, body: StatusIn, request: Request, x_admin_pin: str | None = Header(default=None)):
        return await admin_cmd(request, x_admin_pin, lambda s: service.update_status(s, number, body.status))

    @app.patch("/api/admin/menu/{item_id}")
    async def patch_menu(item_id: str, body: MenuPatchIn, request: Request, x_admin_pin: str | None = Header(default=None)):
        return await admin_cmd(request, x_admin_pin, lambda s: service.patch_menu(s, item_id, body.available, body.price))

    @app.post("/api/admin/menu")
    async def add_menu(body: NewItemIn, request: Request, x_admin_pin: str | None = Header(default=None)):
        return await admin_cmd(request, x_admin_pin, lambda s: service.add_menu_item(s, body.name, body.cat, body.price, body.desc, list(body.tags)), 201)

    @app.post("/api/admin/reports")
    async def post_report(request: Request, x_admin_pin: str | None = Header(default=None)):
        return await admin_cmd(request, x_admin_pin, lambda s: service.fire_report(s, "manual"), 201)

    @app.post("/api/admin/dev/student-order")
    async def student_order(request: Request, x_admin_pin: str | None = Header(default=None)):
        return await admin_cmd(request, x_admin_pin, service.receive_student_order, 201)

    @app.post("/api/admin/reset")
    async def reset(request: Request, x_admin_pin: str | None = Header(default=None)):
        return await admin_cmd(request, x_admin_pin, lambda s: service.reset_demo(s))

    @app.get("/api/admin/automations")
    async def automations(request: Request, x_admin_pin: str | None = Header(default=None)) -> list[dict]:
        admin_only(request, x_admin_pin)
        return (await admin_state())["log"]

    @app.get("/api/admin/reports")
    async def reports(request: Request, x_admin_pin: str | None = Header(default=None)) -> list[dict]:
        admin_only(request, x_admin_pin)
        return (await admin_state())["reports"]

    # ---------- WebSocket ----------
    async def ws_admin_auth(ws: WebSocket) -> int | None:
        """Lê o PIN da primeira mensagem (nunca da URL, que vai para logs). Retorna None se ok, ou o código de fechamento."""
        try:
            raw = await asyncio.wait_for(ws.receive_text(), WS_AUTH_TIMEOUT)
        except (asyncio.TimeoutError, KeyError):  # sem mensagem a tempo, ou mensagem binária
            return 4403
        msg = None
        if len(raw) <= 256:
            try:
                msg = json.loads(raw)
            except (ValueError, RecursionError):
                pass
        pin = msg.get("pin") if isinstance(msg, dict) and msg.get("type") == "auth" else None
        result = check_pin(client_ip(ws), pin if isinstance(pin, str) else None)
        return {"ok": None, "invalid": 4403, "blocked": 4429}[result]

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket, role: str = "student", sid: str | None = None) -> None:
        if role == "admin":
            await ws.accept()
            try:
                code = await ws_admin_auth(ws)
            except WebSocketDisconnect:
                return
            if code is not None:
                await ws.close(code=code)
                return
            conn = Conn(ws, "admin", None)
        else:
            try:
                conn = Conn(ws, "student", service.valid_student_id(sid))
            except ApiError:
                await ws.close(code=4400)
                return
            await ws.accept()
        if not await hub.add(conn):
            await ws.close(code=1013)
            return
        try:
            await hub.send_state(conn)
            while True:
                msg = await ws.receive_text()
                if len(msg) > 256:  # o cliente só envia "ping"; qualquer coisa grande é abuso
                    await ws.close(code=1009)
                    break
                if msg == "ping":
                    await ws.send_json({"type": "pong"})
        except WebSocketDisconnect:
            pass
        except Exception:  # noqa: BLE001
            log.debug("ws encerrado", exc_info=True)
        finally:
            hub.remove(conn)

    # ---------- SPAs estáticas ----------
    for name in ("aluno", "painel"):
        dist = cfg.static_dir / name / "dist"
        if dist.is_dir():
            app.mount(f"/{name}", SPAStatic(directory=str(dist), html=True), name=name)

    @app.get("/", include_in_schema=False)
    async def root():
        has_aluno = (cfg.static_dir / "aluno" / "dist").is_dir()
        if has_aluno:
            return HTMLResponse(
                '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cantina Digital FAESA</title>'
                '<body style="font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#1F5CB0"><main style="background:#fff;border-radius:16px;padding:28px;max-width:420px;width:calc(100% - 32px)">'
                '<h1 style="color:#0B3A7A;margin:0 0 8px">Cantina Digital FAESA</h1><p style="color:#485364">Protótipo do Projeto Integrador.</p>'
                '<p><a href="/aluno/">App do aluno</a> &middot; <a href="/painel/">Painel da cantina</a></p></main>'
            )
        return RedirectResponse("/healthz")

    return app
