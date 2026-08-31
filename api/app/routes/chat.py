"""POST /api/agent/chat — invoke the LangGraph multi-agent pipeline."""

import asyncio
import json
import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from app.core.config import get_settings
from app.core.graph import get_compiled_graph
from app.core.logging import get_logger
from app.core.session_store import get_session_store
from app.orchestration.schemas import (
    CalculatorOutput,
    LiaisonOutput,
    SynthesizerOutput,
    VisionOutput,
    coerce,
)
from app.schema.chat import AgentThought, ChatRequest, ChatResponse, VisualizationData

router = APIRouter(prefix="/api/agent", tags=["agent"])
log = get_logger("agro_syria.routes.chat")

_AGENT_META: dict[str, dict] = {
    "liaison":    {"role_ar": "وكيل التواصل",          "is_status": False},
    "vision":     {"role_ar": "خبير المعاينة البصرية", "is_status": False},
    "field":      {"role_ar": "عميل الحقل",             "is_status": True},
    "research":   {"role_ar": "وكيل البحث العلمي",      "is_status": True},
    "synthesizer":{"role_ar": "المُجمِّع الاستراتيجي",  "is_status": False},
}

def _resolve_output(ctx: dict) -> tuple[str, dict | None]:
    """Extract the user-facing reply + visualization from typed agent outputs.

    Priority mirrors the pipeline's terminal states: the Synthesizer's final
    answer wins; otherwise the Liaison short-circuit reply (greeting / slot-ask).
    Everything is read from the strongly-typed contract — no string parsing.
    """
    synth = ctx.get("synthesizer_output")
    if synth is not None:
        out = coerce(SynthesizerOutput, synth)
        return out.reply_ar, out.visualization

    liaison = ctx.get("liaison_output")
    if liaison is not None:
        lo = coerce(LiaisonOutput, liaison)
        if lo.reply_ar:
            return lo.reply_ar, None

    vision = ctx.get("vision_output")
    if vision is not None:
        return coerce(VisionOutput, vision).description_ar, None

    return "", None


def _pending_from_liaison_ctx(ctx: dict) -> dict | None:
    """Derive next turn's session-store ``pending`` from this turn's Liaison output.

    Non-``None`` only when this turn itself ended in a slot-ask — a resolved
    or unrelated turn clears any prior pending state so it never leaks into
    an unrelated follow-up.
    """
    liaison = ctx.get("liaison_output")
    if liaison is None:
        return None
    lo = coerce(LiaisonOutput, liaison)
    if not lo.missing_slots:
        return None
    return {"intent": lo.intent, "slots": lo.slots}


def _intent_and_tool(ctx: dict) -> tuple[str | None, str | None]:
    """Structured (intent, tool_used) pair for the API response.

    Lets frontend status displays (e.g. the "مركز العمليات" sidebar) react to
    what actually happened this turn without re-parsing chain_of_thought's
    free-text markdown.
    """
    liaison = ctx.get("liaison_output")
    intent = coerce(LiaisonOutput, liaison).intent if liaison is not None else None

    calc = ctx.get("calculator_output")
    tool_used = coerce(CalculatorOutput, calc).tool_used if calc is not None else None

    return intent, tool_used


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    session_id = request.session_id or str(uuid.uuid4())
    has_image = bool(request.image_base64)
    log.info("chat session=%s has_image=%s msg=%.80s", session_id, has_image, request.message)

    settings = get_settings()
    graph = get_compiled_graph()
    store = get_session_store()
    session = store.get(session_id)

    run_config: RunnableConfig = {
        "tags": ["agro-syria", "chat", settings.app_env] + (["vision"] if has_image else []),
        "metadata": {
            "project":     settings.langchain_project,
            "environment": settings.app_env,
            "session_id":  session_id,
            "has_image":   has_image,
        },
        "run_name": "agro-syria-vision-chat" if has_image else "agro-syria-chat",
    }

    final_state = await graph.ainvoke(
        {
            "messages": [*session.messages, HumanMessage(content=request.message or "ما تشوف في هالصورة؟")],
            "sender": "user",
            "agricultural_context": {
                "image_base64": request.image_base64,
                "user_context": request.user_context.model_dump() if request.user_context else None,
                "pending": session.pending,
            },
        },
        config=run_config,
    )

    # Only this turn's messages — session.messages (prior turns, now prepended
    # into the graph input) must not resurface as if they just happened.
    turn_messages = final_state["messages"][len(session.messages):]

    chain: list[AgentThought] = []
    for msg in turn_messages:
        if not isinstance(msg, AIMessage):
            continue
        meta = _AGENT_META.get(msg.name or "")  # type: ignore[arg-type]
        if meta is None:
            continue
        chain.append(
            AgentThought(
                agent=msg.name,        # type: ignore[arg-type]
                role_ar=meta["role_ar"],
                thought=msg.content,
                is_status=meta["is_status"],
            )
        )

    # Reply + visualization come from the typed agent outputs (the data
    # contract) — never from parsing message strings.
    final_ctx = final_state.get("agricultural_context", {})
    reply, raw_viz = _resolve_output(final_ctx)
    if not reply:
        reply = "عذراً، حدث خطأ. حاول مرة أخرى."

    log.info("reply len=%d viz=%s", len(reply), bool(raw_viz))

    store.save(session_id, messages=final_state["messages"], pending=_pending_from_liaison_ctx(final_ctx))
    intent, tool_used = _intent_and_tool(final_ctx)

    viz: VisualizationData | None = None
    if raw_viz:
        try:
            viz = VisualizationData.model_validate(raw_viz)
        except Exception as exc:
            log.warning("Visualization payload invalid (%s) — skipping", type(exc).__name__)

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        chain_of_thought=chain,
        visualization=viz,
        intent=intent,
        tool_used=tool_used,
    )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """SSE variant of :func:`chat` — streams each agent's thought as it lands.

    Uses ``graph.astream(..., stream_mode="values")``, which yields the FULL
    accumulated ``GraphState`` after every superstep (see ``app.core.state``:
    the ``add_messages`` reducer is what makes each yield a clean, growing
    snapshot rather than a bare delta). We diff against the message count seen
    so far to find only the newly-appended ``AIMessage``s per step.
    """
    session_id = request.session_id or str(uuid.uuid4())
    has_image = bool(request.image_base64)
    log.info("chat-stream session=%s has_image=%s msg=%.80s", session_id, has_image, request.message)

    settings = get_settings()
    graph = get_compiled_graph()
    store = get_session_store()
    session = store.get(session_id)

    run_config: RunnableConfig = {
        "tags": ["agro-syria", "chat", "stream", settings.app_env] + (["vision"] if has_image else []),
        "metadata": {
            "project":     settings.langchain_project,
            "environment": settings.app_env,
            "session_id":  session_id,
            "has_image":   has_image,
        },
        "run_name": "agro-syria-vision-chat-stream" if has_image else "agro-syria-chat-stream",
    }

    initial_state = {
        "messages": [*session.messages, HumanMessage(content=request.message or "ما تشوف في هالصورة؟")],
        "sender": "user",
        "agricultural_context": {
            "image_base64": request.image_base64,
            "user_context": request.user_context.model_dump() if request.user_context else None,
            "pending": session.pending,
        },
    }

    async def event_generator():
        # Start counting from the prior turns' message count — session.messages
        # is already prepended into initial_state, so those must not resurface
        # as "new" thought events for this turn.
        last_count = len(session.messages)
        final_ctx: dict = {}
        final_messages: list = []
        try:
            async for state in graph.astream(initial_state, config=run_config, stream_mode="values"):
                messages = state.get("messages", [])
                new_messages = messages[last_count:]
                last_count = len(messages)
                final_messages = messages

                for msg in new_messages:
                    if not isinstance(msg, AIMessage):
                        continue
                    meta = _AGENT_META.get(msg.name or "")  # type: ignore[arg-type]
                    if meta is None:
                        continue
                    thought = AgentThought(
                        agent=msg.name,  # type: ignore[arg-type]
                        role_ar=meta["role_ar"],
                        thought=msg.content,
                        is_status=meta["is_status"],
                    )
                    yield f"data: {json.dumps({'type': 'thought', **thought.model_dump()}, ensure_ascii=False)}\n\n"

                final_ctx = state.get("agricultural_context", {})

            store.save(session_id, messages=final_messages, pending=_pending_from_liaison_ctx(final_ctx))
            intent, tool_used = _intent_and_tool(final_ctx)

            reply, raw_viz = _resolve_output(final_ctx)
            if not reply:
                reply = "عذراً، حدث خطأ. حاول مرة أخرى."

            viz: VisualizationData | None = None
            if raw_viz:
                try:
                    viz = VisualizationData.model_validate(raw_viz)
                except Exception as exc:
                    log.warning("Visualization payload invalid (%s) — skipping", type(exc).__name__)

            final_payload = {
                "type": "final",
                "reply": reply,
                "visualization": viz.model_dump() if viz else None,
                "session_id": session_id,
                "intent": intent,
                "tool_used": tool_used,
            }
            yield f"data: {json.dumps(final_payload, ensure_ascii=False)}\n\n"
        except Exception as exc:
            log.exception("chat-stream failed session=%s", session_id)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
