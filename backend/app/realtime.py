"""Tempo real por WebSocket. Cada conexão recebe o estado FILTRADO pelo seu papel (aluno: só o que é dele; admin: tudo)."""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import WebSocket
from starlette.concurrency import run_in_threadpool

log = logging.getLogger("cantina.ws")


@dataclass(eq=False)
class Conn:
    ws: WebSocket
    role: str  # 'student' | 'admin'
    student_id: str | None


class Hub:
    def __init__(self, build_state: Callable[[str, str | None], dict], max_connections: int) -> None:
        self.build_state = build_state  # (role, student_id) -> snapshot
        self.max = max_connections
        self.conns: set[Conn] = set()
        self._lock = asyncio.Lock()

    @property
    def size(self) -> int:
        return len(self.conns)

    async def add(self, c: Conn) -> bool:
        if len(self.conns) >= self.max:
            return False
        self.conns.add(c)
        return True

    def remove(self, c: Conn) -> None:
        self.conns.discard(c)

    async def send_state(self, c: Conn) -> None:
        state = await run_in_threadpool(self.build_state, c.role, c.student_id)
        await c.ws.send_json({"type": "state", "state": state})

    async def broadcast(self) -> None:
        """Reenvia o estado a todos (um snapshot por papel/aluno). Conexões mortas são descartadas."""
        async with self._lock:
            cache: dict[tuple[str, str | None], dict] = {}
            for c in list(self.conns):
                key = (c.role, c.student_id if c.role == "student" else None)
                try:
                    if key not in cache:
                        cache[key] = await run_in_threadpool(self.build_state, *key)
                    await c.ws.send_json({"type": "state", "state": cache[key]})
                except Exception:  # noqa: BLE001
                    self.conns.discard(c)

    async def ping(self) -> None:
        for c in list(self.conns):
            try:
                await c.ws.send_json({"type": "ping"})
            except Exception:  # noqa: BLE001
                self.conns.discard(c)
