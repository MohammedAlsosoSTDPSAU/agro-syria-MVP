"""LangSmith tracing configuration.

Must be called BEFORE the first graph.ainvoke() so the LangSmith SDK
picks up the credentials from os.environ rather than missing them.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.config import Settings


def configure_tracing(settings: Settings) -> bool:
    """
    Propagate LangChain tracing settings into os.environ.

    pydantic-settings reads .env into Settings fields but does NOT
    automatically export them back to os.environ. LangSmith reads
    directly from os.environ at first use, so we must push the values
    there explicitly.

    Returns True if tracing is active, False otherwise.
    """
    if not settings.tracing_enabled:
        # Ensure tracing is explicitly OFF so stale env vars don't activate it.
        os.environ.pop("LANGCHAIN_TRACING_V2", None)
        return False

    os.environ["LANGCHAIN_TRACING_V2"]           = "true"
    os.environ["LANGCHAIN_API_KEY"]               = settings.langchain_api_key
    os.environ["LANGCHAIN_PROJECT"]               = settings.langchain_project
    # Run tracing callbacks in a background thread so they never block the
    # asyncio event loop (critical: prevents LangSmith HTTP calls from
    # stalling LLM requests in the Synthesizer node).
    os.environ["LANGCHAIN_CALLBACKS_BACKGROUND"]  = "true"

    return True
