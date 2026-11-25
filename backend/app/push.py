"""Web Push (VAPID) via pywebpush. O envio roda em segundo plano, é idempotente por (pedido, status),
remove assinaturas expiradas (404/410) e nunca derruba a API. CLI: `python -m app.push generate`."""
from __future__ import annotations

import base64
import json
import logging
import sys
import uuid
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from . import db, service
from .config import Settings

log = logging.getLogger("cantina.push")


def generate_vapid_keys() -> dict[str, str]:
    """Gera um par VAPID (P-256). A pública vai ao navegador; a privada fica só em variável de ambiente."""
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid01

    v = Vapid01()
    v.generate_keys()
    raw_priv = v.private_key.private_numbers().private_value.to_bytes(32, "big")
    pub = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()  # noqa: E731
    return {"VAPID_PUBLIC_KEY": b64(pub), "VAPID_PRIVATE_KEY": b64(raw_priv)}


def default_sender(subscription: dict, payload: str, settings: Settings) -> None:
    from pywebpush import webpush

    webpush(subscription_info=subscription, data=payload, vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject}, ttl=3600, timeout=10)


class PushError(Exception):
    def __init__(self, status: int | None) -> None:
        super().__init__(f"push falhou ({status})")
        self.status = status


def _status_of(exc: Exception) -> int | None:
    resp = getattr(exc, "response", None)
    return getattr(resp, "status_code", None)


class Notifier:
    def __init__(self, settings: Settings, factory: sessionmaker, sender: Callable[[dict, str, Settings], None] = default_sender,
                 after_log: Callable[[], None] | None = None) -> None:
        self.settings, self.factory, self.sender, self.after_log = settings, factory, sender, after_log
        self.pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="push")
        self.futures: list[Future] = []

    # chamado pelo service depois de cada transição de status
    def on_status(self, student_id: str, number: int, status: str) -> None:
        if status == "pronto" or (status == "preparo" and self.settings.push_on_preparo):
            self.futures.append(self.pool.submit(self.deliver, student_id, number, status))

    def flush(self) -> None:
        for f in list(self.futures):
            f.result(timeout=15)
        self.futures.clear()

    def _log(self, s, number: int, result: str) -> None:
        s.add(db.AutomationLog(id=str(uuid.uuid4()), at=service.now_ms(), workflow="Pedido pronto → Notificar aluno (push)",
                               trigger=f"Status do pedido {service.order_number_label(number)}", action=f"Web Push: {result}", detail=""))
        service._bump(s)
        s.commit()

    def deliver(self, student_id: str, number: int, status: str) -> str:
        label = service.order_number_label(number)
        key = f"{number}:{status}"
        try:
            with self.factory() as s:
                # idempotência: só o primeiro envio para (pedido, status) segue adiante
                s.add(db.PushDelivery(key=key, at=service.now_ms()))
                try:
                    s.commit()
                except IntegrityError:
                    s.rollback()
                    return "duplicado"
                if not self.settings.push_enabled:
                    self._log(s, number, "desativado (sem chaves VAPID)")
                    self._after()
                    return "desativado"
                subs = list(s.scalars(select(db.PushSubscription).where(db.PushSubscription.student_id == student_id)))
                if not subs:
                    self._log(s, number, "sem assinatura (aviso só dentro do app)")
                    self._after()
                    return "sem_assinatura"
                title = f"Pedido {label} pronto" if status == "pronto" else f"Pedido {label} em preparo"
                body = "Retire no balcão da Cantina FAESA." if status == "pronto" else "Pagamento confirmado. Estamos preparando."
                payload = json.dumps({"title": title, "body": body, "tag": f"pedido-{number}", "url": f"/pedidos/{number}", "number": number, "status": status})
                sent = failed = 0
                for sub in subs:
                    try:
                        self.sender({"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}, payload, self.settings)
                        sent += 1
                    except Exception as e:  # noqa: BLE001
                        code = _status_of(e)
                        if code in (404, 410):  # assinatura expirada: remove
                            s.delete(sub)
                            s.commit()
                        failed += 1
                        log.warning("push falhou (%s) para uma assinatura", code)
                result = f"enviado ({sent})" if sent and not failed else f"enviado {sent}, falhou {failed}" if sent else f"falhou ({failed})"
                self._log(s, number, result)
                self._after()
                return "enviado" if sent else "falhou"
        except Exception:  # noqa: BLE001
            log.exception("erro inesperado no envio de push")
            return "erro"

    def _after(self) -> None:
        if self.after_log:
            try:
                self.after_log()
            except Exception:  # noqa: BLE001
                pass


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "generate":
        keys = generate_vapid_keys()
        print("# Cole no ambiente do servidor (a chave PRIVADA nunca vai para o repositório):")
        for k, v in keys.items():
            print(f"{k}={v}")
        print("VAPID_SUBJECT=mailto:seu-email@exemplo.com")
    else:
        print("uso: python -m app.push generate")
