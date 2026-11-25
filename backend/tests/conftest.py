import pytest
from fastapi.testclient import TestClient

from app import db, seed
from app.config import Settings
from app.main import create_app

PIN = "9999"
SID = "aluno-teste-0001"
SID2 = "aluno-teste-0002"
HA = {"X-Admin-Pin": PIN}


def make_settings(**kw) -> Settings:
    base = dict(app_env="test", database_url="sqlite://", admin_pin=PIN, cors_origins=["http://localhost:5173"], rate_limit_per_min=10_000,
                order_rate_per_min=1000, report_interval_seconds=3600, static_dir=__import__("pathlib").Path("/nonexistent"))
    base.update(kw)
    return Settings(**base)


@pytest.fixture()
def app():
    return create_app(make_settings(), background=False)


@pytest.fixture()
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def session():
    """Sessão sobre um banco SQLite em memória já populado com a demo."""
    engine = db.make_engine("sqlite://")
    db.Base.metadata.create_all(engine)
    factory = db.make_session_factory(engine)
    with factory() as s:
        seed.populate(s)
    with factory() as s:
        yield s
    engine.dispose()


def student(sid: str = SID) -> dict:
    return {"X-Student-Id": sid}
