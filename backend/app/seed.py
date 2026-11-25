"""Dados fictícios iniciais. Preços coerentes com os slides:
Misto Quente (11) + Suco de Laranja (6) = R$ 17,00 | Sanduíche Natural (14) + Suco (6) = R$ 20,00 | X-Burguer R$ 18,00."""
from __future__ import annotations

import time
import uuid
from datetime import datetime

from sqlalchemy import delete
from sqlalchemy.orm import Session

from . import db

DEMO_STUDENT_ID = "seed-luiz"

MENU = [
    ("misto", "Misto Quente", "lanches", 11, "Pão na chapa, queijo e presunto.", [], True),
    ("natural", "Sanduíche Natural", "lanches", 14, "Pão integral, peito de peru, ricota e cenoura. Sem açúcar adicionado.", ["sem-acucar"], True),
    ("xburguer", "X-Burguer", "lanches", 18, "Hambúrguer artesanal, queijo, alface e tomate.", [], True),
    ("natural-veg", "Natural Vegetariano", "lanches", 13, "Pão integral, ricota, cenoura e folhas. Sem açúcar adicionado.", ["sem-acucar", "vegetariano"], True),
    ("pao-queijo", "Pão de Queijo", "salgados", 5, "Quentinho, saindo do forno.", ["vegetariano"], True),
    ("coxinha", "Coxinha de Frango", "salgados", 7, "Massa crocante e recheio cremoso.", [], True),
    ("empada", "Empada de Palmito", "salgados", 7, "Massa amanteigada com palmito.", ["vegetariano"], True),
    ("suco-laranja", "Suco de Laranja", "sucos", 6, "Natural, 300 ml, sem açúcar.", ["sem-acucar", "vegetariano"], True),
    ("suco-maracuja", "Suco de Maracujá", "sucos", 6, "Polpa da fruta, adoçado, 300 ml.", ["vegetariano"], True),
    ("suco-verde", "Suco Verde", "sucos", 7, "Couve, limão e maçã. Sem açúcar.", ["sem-acucar", "vegetariano"], True),
    ("cafe", "Café Expresso", "bebidas", 4, "Servido sem açúcar (adoçante à parte).", ["sem-acucar", "vegetariano"], True),
    ("cappuccino", "Cappuccino", "bebidas", 6, "Cremoso, com chocolate em pó.", ["vegetariano"], True),
    ("agua", "Água Mineral", "bebidas", 3, "500 ml.", ["sem-acucar", "vegetariano"], True),
    ("refri", "Refrigerante Lata", "bebidas", 6, "350 ml.", [], True),
    ("salada-frutas", "Salada de Frutas", "doces", 7, "Frutas da estação, sem açúcar adicionado.", ["sem-acucar", "vegetariano"], True),
    ("brownie", "Brownie", "doces", 8, "Chocolate meio amargo.", ["vegetariano"], True),
    ("cookie", "Cookie de Aveia", "doces", 6, "Esgotado hoje.", ["vegetariano"], False),
]
FLOW = ["aguardando", "preparo", "pronto", "retirado"]

# (número, aluno, itens, status, minutos atrás)
ORDERS = [
    (25, "Luiz", [("misto", 1), ("suco-laranja", 1)], "retirado", 1620),
    (28, "Luiz", [("natural", 1), ("suco-laranja", 1)], "retirado", 1500),
    (34, "Luiz", [("misto", 1), ("suco-laranja", 1)], "retirado", 1450),
    (30, "Marina", [("xburguer", 1), ("refri", 1)], "retirado", 280),
    (31, "Pedro", [("coxinha", 2), ("suco-maracuja", 1)], "retirado", 250),
    (32, "Júlia", [("natural-veg", 1), ("suco-verde", 1)], "retirado", 205),
    (33, "Rafael", [("misto", 1), ("cafe", 1)], "retirado", 170),
    (35, "Camila", [("pao-queijo", 3), ("cappuccino", 1)], "retirado", 140),
    (36, "Bruno", [("xburguer", 1), ("suco-laranja", 1)], "retirado", 100),
    (37, "Larissa", [("natural", 1), ("suco-laranja", 1)], "retirado", 70),
    (38, "Diego", [("misto", 2), ("refri", 2)], "retirado", 45),
    (39, "Fernanda", [("empada", 1), ("cafe", 1)], "retirado", 30),
    (40, "Gabriel", [("brownie", 1), ("cappuccino", 1)], "retirado", 22),
    (41, "Ana", [("misto", 1), ("suco-laranja", 1)], "preparo", 9),
    (42, "Luiz", [("misto", 1), ("suco-laranja", 1)], "aguardando", 3),
    (43, "Carlos", [("xburguer", 1)], "pronto", 14),
]


def _student_id(name: str) -> str:
    return DEMO_STUDENT_ID if name == "Luiz" else "seed-" + name.lower()


def populate(session: Session, now_ms: int | None = None) -> None:
    """Apaga tudo e recria o cenário da demonstração."""
    now = now_ms or int(time.time() * 1000)
    for model in (db.PushDelivery, db.OrderItem, db.Order, db.Notification, db.Report, db.AutomationLog, db.Student, db.MenuItem, db.Counter):
        session.execute(delete(model))
    for pos, (id_, name, cat, price, desc, tags, av) in enumerate(MENU):
        session.add(db.MenuItem(id=id_, name=name, cat=cat, price=price, desc=desc, tags=tags, available=av, position=pos))
    by_id = {m[0]: m for m in MENU}
    day_start = int(datetime.fromtimestamp(now / 1000).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
    names = {o[1] for o in ORDERS}
    for n in names:
        session.add(db.Student(id=_student_id(n), name=n, created_at=now))
    for number, name, items, status, mins in ORDERS:
        created = now - mins * 60000 if mins > 600 else max(now - mins * 60000, day_start + 60000 * ((number % 50) + 1))
        idx = FLOW.index(status)
        history = {FLOW[k]: min(created + k * 3 * 60000, now) for k in range(idx + 1)}
        rows = [(i, by_id[i][1], float(by_id[i][3]), q) for i, q in items]
        o = db.Order(id=f"seed-{number}", number=number, student_id=_student_id(name), customer=name, status=status, via="app",
                     total=sum(p * q for _, _, p, q in rows), created_at=created, history=history)
        o.items = [db.OrderItem(item_id=i, name=n_, price=p, qty=q) for i, n_, p, q in rows]
        session.add(o)
    session.add(db.Counter(name="order_number", value=44))
    session.add(db.Counter(name="rev", value=1))
    session.add(db.AutomationLog(id=str(uuid.uuid4()), at=now - 40 * 60000, workflow="Relatório de vendas (agendado)",
                                 trigger="Cron · a cada 2 h", action="Gerar resumo e publicar na aba Relatório", detail="9 pedidos · R$ 128,00"))
    session.commit()


def ensure_seed(session: Session) -> None:
    if session.get(db.Counter, "order_number") is None:
        populate(session)
