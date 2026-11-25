"""Configuração por variáveis de ambiente. Nenhum segredo fica no código."""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    app_env: str = field(default_factory=lambda: os.environ.get("APP_ENV", "development"))
    database_url: str = field(default_factory=lambda: os.environ.get("DATABASE_URL", "sqlite:///./data/cantina.db"))
    # PIN das rotas de administração do painel. Em produção é obrigatório; em desenvolvimento, se ausente, gera um aleatório.
    admin_pin: str = field(default_factory=lambda: os.environ.get("ADMIN_PIN", ""))
    admin_pin_generated: bool = field(default=False, init=False)
    cors_origins: list[str] = field(default_factory=lambda: [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()])
    report_interval_seconds: int = field(default_factory=lambda: int(os.environ.get("REPORT_INTERVAL_SECONDS", "120")))
    rate_limit_per_min: int = field(default_factory=lambda: int(os.environ.get("RATE_LIMIT_PER_MIN", "300")))
    order_rate_per_min: int = field(default_factory=lambda: int(os.environ.get("ORDER_RATE_PER_MIN", "20")))
    max_ws_connections: int = field(default_factory=lambda: int(os.environ.get("MAX_WS_CONNECTIONS", "300")))
    max_body_bytes: int = field(default_factory=lambda: int(os.environ.get("MAX_BODY_BYTES", str(64 * 1024))))
    trust_proxy: bool = field(default_factory=lambda: _bool("TRUST_PROXY"))
    static_dir: Path = field(default_factory=lambda: Path(os.environ.get("STATIC_DIR", str(ROOT / "apps"))))
    # Agente com LLM real: DESLIGADO por padrão; só liga com LLM_ENABLED=true e ANTHROPIC_API_KEY no ambiente.
    llm_enabled: bool = field(default_factory=lambda: _bool("LLM_ENABLED"))
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    llm_model: str = field(default_factory=lambda: os.environ.get("LLM_MODEL", ""))
    # Web Push (VAPID). Gere o par com `python -m app.push generate`; a chave privada NUNCA vai para o repositório.
    vapid_public_key: str = field(default_factory=lambda: os.environ.get("VAPID_PUBLIC_KEY", ""))
    vapid_private_key: str = field(default_factory=lambda: os.environ.get("VAPID_PRIVATE_KEY", ""))
    vapid_subject: str = field(default_factory=lambda: os.environ.get("VAPID_SUBJECT", "mailto:cantina@example.com"))
    push_on_preparo: bool = field(default_factory=lambda: _bool("PUSH_ON_PREPARO"))

    def __post_init__(self) -> None:
        production = self.app_env == "production"
        if not self.admin_pin:
            if production:
                raise RuntimeError("ADMIN_PIN é obrigatório em produção (APP_ENV=production).")
            self.admin_pin = f"{secrets.randbelow(10**8):08d}"
            self.admin_pin_generated = True
        if not self.cors_origins and not production:
            self.cors_origins = ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"]

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)

    @property
    def production(self) -> bool:
        return self.app_env == "production"


def get_settings() -> Settings:
    return Settings()
