"""Agent-status route.

Returns the live status of all AI agents in the Agro-Syria system.
This endpoint is consumed by the frontend AgentStatusBar component and
will later be backed by real LangGraph agent state.
"""

from fastapi import APIRouter

from app.schema.agents import AgentInfo, AgentStatus, AgentStatusResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])

# ---------------------------------------------------------------------------
# Static registry — will be replaced with live LangGraph state in Phase 2.2
# ---------------------------------------------------------------------------
_AGENTS: list[AgentInfo] = [
    AgentInfo(
        id="strategist",
        name_en="Strategist",
        name_ar="المخطط الاستراتيجي",
        role_ar="المخطط الاستراتيجي: عم بدرس توازن المحاصيل بالسوق.",
        status=AgentStatus.active,
        metric="٣ خطط",
        icon="Target",
    ),
    AgentInfo(
        id="field",
        name_en="Field Agent",
        name_ar="وكيل الميدان",
        role_ar="وكيل الميدان: عيوني على التربة والطقس بكل لحظة.",
        status=AgentStatus.active,
        metric="٤ حقول",
        icon="Sprout",
    ),
    AgentInfo(
        id="synthesizer",
        name_en="Synthesizer",
        name_ar="الموثق الذكي",
        role_ar="الموثق الذكي: عم جهزلك أحدث الأبحاث الزراعية.",
        status=AgentStatus.processing,
        metric="جاري...",
        icon="BookOpen",
    ),
    AgentInfo(
        id="liaison",
        name_en="Liaison",
        name_ar="وكيل التواصل",
        role_ar="وكيل التواصل: أنا هون لحتى جاوبك على أي سؤال.",
        status=AgentStatus.idle,
        metric="جاهز",
        icon="MessageCircle",
    ),
    AgentInfo(
        id="security",
        name_en="Security",
        name_ar="الحارس",
        role_ar="الحارس: عم اتأكد إنو بياناتك وأرضك بأمان.",
        status=AgentStatus.active,
        metric="آمن",
        icon="Shield",
    ),
]


@router.get(
    "/status",
    response_model=AgentStatusResponse,
    summary="Live agent status",
    description=(
        "Returns the operational status of every AI agent in the system. "
        "Designed to replace hardcoded frontend data once LangGraph is wired in."
    ),
)
async def get_agent_status() -> AgentStatusResponse:
    active_count = sum(
        1
        for a in _AGENTS
        if a.status in (AgentStatus.active, AgentStatus.processing)
    )
    return AgentStatusResponse(
        agents=_AGENTS,
        active_count=active_count,
        total_count=len(_AGENTS),
        system_healthy=active_count > 0,
    )
