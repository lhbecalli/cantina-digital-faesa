"""Adaptador OPCIONAL para um LLM real (Anthropic). DESLIGADO por padrão: só roda com LLM_ENABLED=true,
ANTHROPIC_API_KEY e LLM_MODEL no ambiente. Nenhuma chave fica no repositório. Se algo falhar, o agente por regras responde."""
from __future__ import annotations

import logging

import httpx

from .config import Settings

log = logging.getLogger("cantina.llm")


def llm_available(settings: Settings) -> bool:
    return bool(settings.llm_enabled and settings.anthropic_api_key and settings.llm_model)


def llm_reply(settings: Settings, message: str, menu: list[dict]) -> str | None:
    """Resposta em texto livre do LLM (sem tools) para perguntas que as regras não entenderam. None = sem LLM/falha."""
    if not llm_available(settings):
        return None
    cardapio = "; ".join(f"{m['name']} (R$ {m['price']:.2f}{'' if m['available'] else ', esgotado'})" for m in menu)
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": settings.llm_model, "max_tokens": 300,
                  "system": "Você é o assistente da Cantina FAESA. Responda em português, em até 3 frases, só sobre o cardápio e pedidos. Cardápio: " + cardapio,
                  "messages": [{"role": "user", "content": message[:500]}]},
            timeout=10,
        )
        r.raise_for_status()
        parts = r.json().get("content", [])
        return "".join(p.get("text", "") for p in parts if p.get("type") == "text").strip() or None
    except Exception as e:  # noqa: BLE001
        log.warning("LLM indisponível (%s); usando regras.", type(e).__name__)
        return None
