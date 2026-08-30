"""In-memory, single-process session store for multi-turn conversation state.

Holds each session's recent message history and any "pending" slot-fill state
(intent + partially-filled slots) left over from a turn that ended in a
slot-ask, so a short follow-up answer (e.g. "45 يوم") can be merged into the
prior turn's context instead of every request starting from scratch.

IMPORTANT — this is single-process, in-memory state:
  * It resets on every redeploy/restart — no persistence.
  * It will NOT work correctly if the app ever runs with multiple server
    instances/workers: each process has its own independent store, so a
    session's follow-up could land on a different instance with no memory
    of the first turn.
  * Acceptable for now (single Render instance, no real concurrent-instance
    traffic yet). Once there's real traffic or horizontal scaling, replace
    this with a shared store (e.g. Redis) — that migration is a future infra
    item, intentionally out of scope here.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import BaseMessage

_MAX_MESSAGES = 20
_EVICT_AFTER_SECONDS = 2 * 60 * 60  # 2 hours


@dataclass
class SessionState:
    messages: list[BaseMessage] = field(default_factory=list)
    pending: dict[str, Any] | None = None
    last_touched: float = field(default_factory=time.monotonic)


class SessionStore:
    """Thread-safe in-memory session map with time-based eviction."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._lock = threading.Lock()

    def get(self, session_id: str) -> SessionState:
        """Return the session's current state (a fresh, empty one if new)."""
        with self._lock:
            self._evict_stale()
            session = self._sessions.get(session_id)
            if session is None:
                session = SessionState()
                self._sessions[session_id] = session
            session.last_touched = time.monotonic()
            return session

    def save(
        self,
        session_id: str,
        *,
        messages: list[BaseMessage],
        pending: dict[str, Any] | None,
    ) -> None:
        """Persist the updated message history (capped) and pending slot-fill state."""
        with self._lock:
            self._sessions[session_id] = SessionState(
                messages=list(messages[-_MAX_MESSAGES:]),
                pending=pending,
                last_touched=time.monotonic(),
            )

    def _evict_stale(self) -> None:
        now = time.monotonic()
        stale = [sid for sid, s in self._sessions.items() if now - s.last_touched > _EVICT_AFTER_SECONDS]
        for sid in stale:
            del self._sessions[sid]


_STORE: SessionStore | None = None


def get_session_store() -> SessionStore:
    global _STORE
    if _STORE is None:
        _STORE = SessionStore()
    return _STORE
