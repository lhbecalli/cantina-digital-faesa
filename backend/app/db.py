"""Modelo de dados (SQLAlchemy 2). O DDL é portável: SQLite por padrão; troque por PostgreSQL via DATABASE_URL."""
from __future__ import annotations

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, UniqueConstraint, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


class MenuItem(Base):
    __tablename__ = "menu_items"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    cat: Mapped[str] = mapped_column(String(20))
    price: Mapped[float] = mapped_column(Float)
    desc: Mapped[str] = mapped_column(String(120), default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)


class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[int] = mapped_column(Integer)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("number", name="uq_orders_number"), UniqueConstraint("client_request_id", name="uq_orders_request"))
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    number: Mapped[int] = mapped_column(Integer, index=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    customer: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(12), index=True)
    via: Mapped[str] = mapped_column(String(8), default="app")
    total: Mapped[float] = mapped_column(Float)
    created_at: Mapped[int] = mapped_column(Integer)  # epoch em ms
    history: Mapped[dict] = mapped_column(JSON, default=dict)
    client_request_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    items: Mapped[list["OrderItem"]] = relationship(cascade="all, delete-orphan", order_by="OrderItem.pk", lazy="selectin")


class OrderItem(Base):
    __tablename__ = "order_items"
    pk: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(60))
    price: Mapped[float] = mapped_column(Float)
    qty: Mapped[int] = mapped_column(Integer)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    number: Mapped[int] = mapped_column(Integer)
    at: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(120))
    text: Mapped[str] = mapped_column(String(240))


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    at: Mapped[int] = mapped_column(Integer)
    orders: Mapped[int] = mapped_column(Integer)
    revenue: Mapped[float] = mapped_column(Float)
    avg: Mapped[float] = mapped_column(Float)
    top: Mapped[list] = mapped_column(JSON, default=list)
    trigger: Mapped[str] = mapped_column(String(8))


class AutomationLog(Base):
    __tablename__ = "automation_log"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    at: Mapped[int] = mapped_column(Integer, index=True)
    workflow: Mapped[str] = mapped_column(String(120))
    trigger: Mapped[str] = mapped_column(String(160))
    action: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(String(240), default="")


class PushSubscription(Base):
    """Assinatura Web Push (um aparelho/navegador), vinculada ao id anônimo do aluno."""
    __tablename__ = "push_subscriptions"
    endpoint: Mapped[str] = mapped_column(String(600), primary_key=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    p256dh: Mapped[str] = mapped_column(String(200))
    auth: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[int] = mapped_column(Integer)


class PushDelivery(Base):
    """Marca "pedido N → status X já avisado": impede push duplicado em reenvio/repetição."""
    __tablename__ = "push_deliveries"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    at: Mapped[int] = mapped_column(Integer)


class Counter(Base):
    """Contadores atômicos: 'order_number' (numeração dos pedidos) e 'rev' (versão do estado)."""
    __tablename__ = "counters"
    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[int] = mapped_column(Integer)


def make_engine(url: str) -> Engine:
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if ":memory:" in url or url == "sqlite://":
            from sqlalchemy.pool import StaticPool
            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _pragmas(dbapi_conn, _):  # noqa: ANN001
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()
    return engine


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
