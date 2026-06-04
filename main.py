"""Agro-Syria AI — FastAPI entry point.

Run with:
    uvicorn main:app --reload --port 8000
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import get_logger, log_tracing_status, setup_logging
from app.core.tracing import configure_tracing
from app.routes import admin, agents, chat, fields, health, market

# ── Bootstrap logging before anything else ───────────────────────────
setup_logging(level=logging.INFO)
log = get_logger("agro_syria.main")
settings = get_settings()


# ── LLM startup probe (provider-agnostic: Gemini or OpenAI) ──────────
def _probe_llm_sync(api_key: str, model: str, base_url: str | None) -> bool:
    """Run in executor — tests if the active provider key works.

    Uses the synchronous openai client (pointed at Gemini's OpenAI-compatible
    endpoint when configured) so the probe never blocks the event loop;
    asyncio.wait_for provides the outer deadline.
    """
    try:
        import openai
        client = openai.OpenAI(api_key=api_key, base_url=base_url, max_retries=0, timeout=5.0)
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "test"}],
            max_tokens=1,
        )
        return True
    except Exception:
        return False


async def _probe_openai() -> None:
    """Probe the active LLM provider at startup; mark unavailable on any failure."""
    import asyncio as _aio
    from app.core.graph import _mark_openai_unavailable  # alias → mark_llm_unavailable

    if not settings.llm_api_key:
        _mark_openai_unavailable()
        log.warning("No LLM API key configured — chat will use local synthesis")
        return

    try:
        ok = await _aio.wait_for(
            _aio.get_event_loop().run_in_executor(
                None, _probe_llm_sync, settings.llm_api_key, settings.llm_model, settings.llm_base_url
            ),
            timeout=8.0,
        )
    except Exception:
        ok = False

    if ok:
        log.info("LLM provider '%s' verified ✓ (model: %s)", settings.llm_provider, settings.llm_model)
    else:
        _mark_openai_unavailable()
        log.warning("LLM provider '%s' unavailable at startup — chat will use local synthesis", settings.llm_provider)


# ── Warm-up helper ───────────────────────────────────────────────────
async def _warmup_graph() -> None:
    """Pre-compile the LangGraph singleton and send a canary trace."""
    from langchain_core.messages import HumanMessage
    from langchain_core.runnables import RunnableConfig

    from app.core.graph import get_compiled_graph

    graph = get_compiled_graph()   # compile once; cached for all requests
    config: RunnableConfig = {
        "tags":     ["agro-syria", "warmup"],
        "metadata": {"project": settings.langchain_project, "type": "warmup"},
        "run_name": "agro-syria-warmup",
    }
    try:
        await graph.ainvoke(
            {"messages": [HumanMessage(content="مرحبا")], "sender": "user", "agricultural_context": {}},
            config=config,
        )
        log.info("Graph warm-up OK%s", " — canary trace sent to LangSmith" if settings.tracing_enabled else "")
    except Exception as exc:
        log.warning("Graph warm-up failed (%s) — server will still start", type(exc).__name__)


# ── Lifespan (startup / shutdown) ────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("══════════════════════════════════════════")
    log.info("  %s  |  %s", settings.app_name_ar, settings.app_name)
    log.info("  الإصدار: %s  |  البيئة: %s", settings.app_version, settings.app_env)
    log.info("══════════════════════════════════════════")

    # Tracing must be configured before any graph.ainvoke() call
    configure_tracing(settings)
    log_tracing_status(settings)

    # Warm-up: build RAG index in background — server starts immediately;
    # first queries may fall back to TF-IDF until the index is ready.
    import asyncio
    from app.core.rag_engine import warmup_rag
    asyncio.get_event_loop().run_in_executor(None, warmup_rag)

    # Warm-up: pre-compile the graph and send a canary trace (greeting
    # short-circuits at Liaison Agent — no OpenAI call, completes fast)
    await _warmup_graph()

    # Disable LangSmith after the warmup trace — keeping LANGCHAIN_TRACING_V2=true
    # injects synchronous HTTP callbacks on every LLM call which block the asyncio
    # event loop and prevent timeouts from firing during chat requests.
    if settings.tracing_enabled:
        os.environ.pop("LANGCHAIN_TRACING_V2", None)
        log.info("LangSmith tracing disabled for chat requests (warmup trace sent)")

    # Probe OpenAI and mark unavailable immediately if quota is exhausted.
    # This prevents any chat request from ever waiting on a doomed API call.
    await _probe_openai()

    log.info("الخادم جاهز — Server is ready ✓")
    yield
    log.info("إيقاف التشغيل — Shutting down gracefully.")


# ── Application factory ───────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description=(
            "**أغرو-سيريا** — منصة الزراعة الذكية للمزارع السوري.\n\n"
            "Multi-agent AI backend powered by LangGraph."
        ),
        version=settings.app_version,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ──────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(agents.router)
    app.include_router(fields.router)
    app.include_router(chat.router)
    app.include_router(admin.router)
    app.include_router(market.router)

    return app


app = create_app()
