"""POST /api/agent/chat — invoke the LangGraph multi-agent pipeline."""

import asyncio
import uuid

from fastapi import APIRouter
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from app.core.config import get_settings
from app.core.graph import get_compiled_graph, _local_synthesis
from app.core.logging import get_logger
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

# Reply priority: synthesizer wins; vision is fallback for image-only flows
_REPLY_PRIORITY = ["synthesizer", "vision", "field", "liaison"]


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    session_id = request.session_id or str(uuid.uuid4())
    has_image = bool(request.image_base64)
    log.info("chat session=%s has_image=%s msg=%.80s", session_id, has_image, request.message)

    settings = get_settings()
    graph = get_compiled_graph()

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
            "messages": [HumanMessage(content=request.message or "ما تشوف في هالصورة؟")],
            "sender": "user",
            "agricultural_context": {
                "image_base64": request.image_base64,
            },
        },
        config=run_config,
    )

    chain: list[AgentThought] = []
    for msg in final_state["messages"]:
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

    reply = ""
    for agent_name in _REPLY_PRIORITY:
        found = next(
            (t.thought for t in reversed(chain) if t.agent == agent_name and t.thought.strip()),
            None,
        )
        if found:
            reply = found
            break

    if not reply:
        reply = "عذراً، حدث خطأ. حاول مرة أخرى."

    log.info(
        "reply agent=%s len=%d",
        next((t.agent for t in reversed(chain) if t.thought == reply), "?"),
        len(reply),
    )

    # Thread visualization data from graph state into response
    viz: VisualizationData | None = None
    raw_viz = final_state.get("agricultural_context", {}).get("visualization")
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
    )
