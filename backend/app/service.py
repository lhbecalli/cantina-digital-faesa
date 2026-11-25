"""Regras de negócio da cantina. Toda escrita acontece numa transação, sob um lock de processo
(e com SELECT ... FOR UPDATE nos contadores, que vale em PostgreSQL), então a numeração é atômica
e as ações são idempotentes."""
from __future__ import annotations

import random
import re
import threading
import time
import unicodedata
import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from . import db, seed

WRITE_LOCK = threading.RLock()
# Gancho chamado DEPOIS do commit quando um pedido muda de status: (student_id, número, status). Definido pelo app (push).
status_hook = None  # type: ignore[var-annotated]
FLOW = seed.FLOW
CATEGORIES = {"lanches", "salgados", "sucos", "bebidas", "doces"}
TAGS = {"sem-acucar", "vegetariano"}
NAMES = ["Beatriz", "Thiago", "Isabela", "Lucas", "Mariana", "Felipe", "Aline", "Vinícius", "Renata", "Caio"]
STUDENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
_CTRL = re.compile(r"[\x00-\x1f\x7f<>]")


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, details: object | None = None) -> None:
        super().__init__(message)
        self.code, self.message, self.status, self.details = code, message, status, details


def now_ms() -> int:
    return int(time.time() * 1000)


def order_number_label(n: int) -> str:
    return f"#{n:04d}"


def brl(v: float) -> str:
    return "R$ " + f"{v:.2f}".replace(".", ",")


def clean_name(raw: str, default: str = "Aluno") -> str:
    name = _CTRL.sub("", unicodedata.normalize("NFC", raw or "")).strip()
    return name[:30] or default


def valid_student_id(sid: str | None) -> str:
    if not sid or not STUDENT_ID_RE.match(sid):
        raise ApiError("invalid_student", "Identificador do aluno ausente ou inválido.", 400)
    return sid


# ---------- serialização ----------
def order_json(o: db.Order) -> dict:
    return {"id": o.id, "number": o.number, "customer": o.customer, "items": [{"id": i.item_id, "name": i.name, "price": i.price, "qty": i.qty} for i in o.items],
            "total": round(o.total, 2), "status": o.status, "history": o.history or {}, "createdAt": o.created_at, "via": o.via}


def menu_json(m: db.MenuItem) -> dict:
    return {"id": m.id, "name": m.name, "cat": m.cat, "price": m.price, "desc": m.desc, "tags": m.tags or [], "available": m.available}


def _rev(s: Session) -> int:
    c = s.get(db.Counter, "rev")
    return c.value if c else 0


def _bump(s: Session) -> None:
    s.execute(update(db.Counter).where(db.Counter.name == "rev").values(value=db.Counter.value + 1))


def _log(s: Session, workflow: str, trigger: str, action: str, detail: str = "") -> None:
    s.add(db.AutomationLog(id=str(uuid.uuid4()), at=now_ms(), workflow=workflow, trigger=trigger, action=action, detail=detail[:240]))


def snapshot(s: Session, epoch: str, *, student_id: str | None = None, admin: bool = False) -> dict:
    """Estado entregue às SPAs. O aluno só recebe os PRÓPRIOS pedidos e notificações; o painel (admin) recebe tudo."""
    menu = [menu_json(m) for m in s.scalars(select(db.MenuItem).order_by(db.MenuItem.position))]
    q = select(db.Order).order_by(db.Order.number)
    if not admin:
        q = q.where(db.Order.student_id == (student_id or "-"))
    orders = [order_json(o) for o in s.scalars(q)]
    nq = select(db.Notification).order_by(db.Notification.at.desc()).limit(30)
    notes: list[dict] = []
    if student_id and not admin:
        notes = [{"id": n.id, "to": n.student_id, "number": n.number, "at": n.at, "title": n.title, "text": n.text} for n in s.scalars(nq.where(db.Notification.student_id == student_id))]
    reports, log = [], []
    if admin:
        reports = [{"id": r.id, "at": r.at, "orders": r.orders, "revenue": r.revenue, "avg": r.avg, "top": r.top, "trigger": r.trigger}
                   for r in s.scalars(select(db.Report).order_by(db.Report.at.desc()).limit(10))]
        log = [{"id": a.id, "at": a.at, "workflow": a.workflow, "trigger": a.trigger, "action": a.action, "detail": a.detail}
               for a in s.scalars(select(db.AutomationLog).order_by(db.AutomationLog.at.desc()).limit(60))]
    nxt = s.get(db.Counter, "order_number")
    return {"epoch": epoch, "rev": _rev(s), "nextNumber": nxt.value if nxt else 0, "menu": menu, "orders": orders, "notifications": notes, "reports": reports, "log": log}


# ---------- alunos ----------
def upsert_student(s: Session, student_id: str, name: str | None = None) -> db.Student:
    st = s.get(db.Student, student_id)
    if st is None:
        st = db.Student(id=student_id, name=clean_name(name or "Aluno"), created_at=now_ms())
        s.add(st)
    elif name:
        st.name = clean_name(name, st.name)
    return st


def rename_student(s: Session, student_id: str, name: str) -> db.Student:
    with WRITE_LOCK:
        st = upsert_student(s, valid_student_id(student_id), name)
        _bump(s)
        s.commit()
        return st


# ---------- pedidos ----------
def _next_number(s: Session) -> int:
    c = s.execute(select(db.Counter).where(db.Counter.name == "order_number").with_for_update()).scalar_one()
    n = c.value
    c.value = n + 1
    return n


def create_order(s: Session, *, student_id: str, name: str | None, lines: list[dict], via: str = "app", client_request_id: str | None = None) -> tuple[dict, bool]:
    valid_student_id(student_id)
    with WRITE_LOCK:
        if client_request_id:
            prev = s.scalar(select(db.Order).where(db.Order.client_request_id == client_request_id))
            if prev is not None:
                if prev.student_id != student_id:
                    raise ApiError("request_conflict", "Chave de idempotência já usada.", 409)
                return order_json(prev), False
        st = upsert_student(s, student_id, name)
        agg: dict[str, int] = {}
        for ln in lines:
            agg[ln["id"]] = min(20, agg.get(ln["id"], 0) + int(ln["qty"]))
        if not agg:
            raise ApiError("empty_order", "O pedido não tem itens.", 422)
        if len(agg) > 30:
            raise ApiError("too_many_items", "Itens demais no pedido.", 422)
        menu = {m.id: m for m in s.scalars(select(db.MenuItem).where(db.MenuItem.id.in_(list(agg))))}
        missing = [i for i in agg if i not in menu]
        if missing:
            raise ApiError("item_not_found", "Item inexistente.", 422, {"ids": missing})
        unavailable = [i for i in agg if not menu[i].available]
        if unavailable:
            raise ApiError("item_unavailable", "Há itens esgotados no pedido.", 409, {"ids": unavailable})
        now = now_ms()
        o = db.Order(id=str(uuid.uuid4()), number=_next_number(s), student_id=student_id, customer=st.name, status="aguardando",
                     via=via if via in {"app", "ia", "sim"} else "app", total=sum(menu[i].price * q for i, q in agg.items()),
                     created_at=now, history={"aguardando": now}, client_request_id=client_request_id)
        o.items = [db.OrderItem(item_id=i, name=menu[i].name, price=menu[i].price, qty=q) for i, q in agg.items()]
        s.add(o)
        _log(s, "Novo pedido → Avisar cantina", f"Webhook · pedido criado {order_number_label(o.number)}", 'Exibir card em "Aguardando pagamento" + alerta no painel',
             f"{st.name} · {brl(o.total)}" + (" · via assistente" if o.via == "ia" else ""))
        _bump(s)
        s.commit()
        return order_json(o), True


def _move(s: Session, number: int, to: str, payment_only: bool) -> dict:
    if to not in FLOW:
        raise ApiError("invalid_status", "Status inválido.", 422)
    with WRITE_LOCK:
        o = s.scalar(select(db.Order).where(db.Order.number == number))
        if o is None:
            raise ApiError("order_not_found", "Pedido não encontrado.", 404)
        cur, target = FLOW.index(o.status), FLOW.index(to)
        if target <= cur:
            return order_json(o)  # idempotente: repetir não muda nada
        if target != cur + 1:
            raise ApiError("invalid_transition", f"Transição inválida: {o.status} → {to}", 409)
        o.status = to
        o.history = {**(o.history or {}), to: now_ms()}
        num = order_number_label(o.number)
        if to == "preparo":
            _log(s, "Pagamento confirmado → Iniciar preparo", f"Status = Em preparo · {num}", "Atualizar ticket do aluno e enviar pedido à chapa", o.customer)
        elif to == "pronto":
            _log(s, "Pedido pronto → Notificar aluno", f"Status = Pronto · {num}", f"Enviar notificação in-app para {o.customer}", f"Seu pedido {num} está pronto para retirada!")
            s.add(db.Notification(id=str(uuid.uuid4()), student_id=o.student_id, number=o.number, at=now_ms(), title=f"Pedido {num} pronto",
                                  text="Retire no balcão da Cantina FAESA, Bloco B."))
        elif to == "retirado":
            _log(s, "Retirada confirmada → Encerrar ticket", f"Status = Retirado · {num}", "Invalidar QR do ticket e registrar venda", o.customer)
        _bump(s)
        s.commit()
        if status_hook is not None:
            try:
                status_hook(o.student_id, o.number, to)
            except Exception:  # noqa: BLE001  (aviso nunca derruba a transição)
                pass
        return order_json(o)


def confirm_payment(s: Session, number: int) -> dict:
    return _move(s, number, "preparo", True)


def update_status(s: Session, number: int, to: str) -> dict:
    return _move(s, number, to, False)


# ---------- cardápio ----------
def _price(v: object) -> float:
    try:
        f = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ApiError("invalid_price", "Preço inválido.", 422) from None
    if not (0 <= f <= 999) or f != f:
        raise ApiError("invalid_price", "Preço inválido.", 422)
    return round(f, 2)


def patch_menu(s: Session, item_id: str, available: bool | None, price: float | None) -> dict:
    with WRITE_LOCK:
        m = s.get(db.MenuItem, item_id)
        if m is None:
            raise ApiError("item_not_found", "Item inexistente.", 404)
        changed = False
        if available is not None and m.available != available:
            m.available, changed = available, True
        if price is not None and m.price != _price(price):
            m.price, changed = _price(price), True
        if changed:
            _bump(s)
            s.commit()
        return menu_json(m)


def add_menu_item(s: Session, name: str, cat: str, price: float, desc: str = "", tags: list[str] | None = None) -> dict:
    name = clean_name(name, "")
    if not name or len(name) > 40:
        raise ApiError("invalid_name", "Nome inválido.", 422)
    if cat not in CATEGORIES:
        raise ApiError("invalid_category", "Categoria inválida.", 422)
    base = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFD", name.lower()).encode("ascii", "ignore").decode()).strip("-") or uuid.uuid4().hex[:8]
    with WRITE_LOCK:
        id_ = base
        while s.get(db.MenuItem, id_) is not None:
            id_ += "-2"
        pos = (s.scalar(select(db.MenuItem.position).order_by(db.MenuItem.position.desc()).limit(1)) or 0) + 1
        m = db.MenuItem(id=id_, name=name, cat=cat, price=_price(price), desc=clean_name(desc, "")[:90], tags=[t for t in (tags or []) if t in TAGS], available=True, position=pos)
        s.add(m)
        _bump(s)
        s.commit()
        return menu_json(m)


# ---------- relatório e automações ----------
def stats(s: Session) -> dict:
    today = datetime.now().date()
    paid = [o for o in s.scalars(select(db.Order)) if o.status != "aguardando" and datetime.fromtimestamp(o.created_at / 1000).date() == today]
    revenue = sum(o.total for o in paid)
    counts: dict[str, int] = {}
    for o in paid:
        for i in o.items:
            counts[i.name] = counts.get(i.name, 0) + i.qty
    top = sorted(({"name": n, "qty": q} for n, q in counts.items()), key=lambda x: -x["qty"])[:5]
    return {"orders": len(paid), "revenue": revenue, "avg": revenue / len(paid) if paid else 0.0, "top": top}


def fire_report(s: Session, trigger: str = "manual") -> dict:
    with WRITE_LOCK:
        st = stats(s)
        r = db.Report(id=str(uuid.uuid4()), at=now_ms(), orders=st["orders"], revenue=st["revenue"], avg=st["avg"], top=st["top"][:3], trigger=trigger)
        s.add(r)
        _log(s, f"Relatório de vendas ({'agendado' if trigger == 'cron' else 'manual'})",
             "Cron · a cada 2 h (demo: 2 min)" if trigger == "cron" else 'Botão "Disparar relatório agora"', "Consolidar vendas do dia e publicar na aba Relatório",
             f"{st['orders']} pedidos · {brl(st['revenue'])} · ticket médio {brl(st['avg'])}")
        _bump(s)
        s.commit()
        return {"id": r.id, "at": r.at, "orders": r.orders, "revenue": r.revenue, "avg": r.avg, "top": r.top, "trigger": r.trigger}


def receive_student_order(s: Session) -> dict:
    avail = list(s.scalars(select(db.MenuItem).where(db.MenuItem.available.is_(True))))
    picks = random.sample(avail, k=min(len(avail), random.randint(1, 3)))
    name = random.choice(NAMES)
    order, _ = create_order(s, student_id="sim-" + uuid.uuid4().hex[:12], name=name, lines=[{"id": m.id, "qty": 2 if random.random() < 0.25 else 1} for m in picks], via="sim")
    return order


def reset_demo(s: Session) -> None:
    with WRITE_LOCK:
        rev = _rev(s)
        seed.populate(s)
        s.execute(update(db.Counter).where(db.Counter.name == "rev").values(value=rev + 1))
        s.commit()
