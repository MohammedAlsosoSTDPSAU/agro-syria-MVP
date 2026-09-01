"""Deterministic agent orchestrator for the Agro-Syria multi-agent graph.

This module replaces ad-hoc, prompt-driven branching (keyword sniffing inside
``_detect_intent``, scattered ``ctx.get(...)`` checks, image-existence probes)
with a single, explicit *state machine*.

Design goals
------------
* **Deterministic** — the next node is computed purely from boolean state flags
  (``greeting``, ``image_b64``, ``missing_slots``). No LLM round-trip is needed
  to decide where a request goes next, removing routing latency and token cost.
* **Single source of truth** — the execution order (:data:`PIPELINE`), the
  transition table (:data:`HANDOFF_RULES`) and the per-agent input contracts
  (:data:`REQUIRED_CONTEXT`) live in one cohesive place.
* **Loosely coupled** — the orchestrator operates on the plain ``GraphState``
  mapping (a ``TypedDict``, i.e. a ``dict`` at runtime) and imports nothing from
  the ``app`` package. It can be unit-tested in isolation with bare dicts.

The orchestrator does **not** mutate state and does **not** know how individual
agents do their work; it only decides *who runs next* and *whether the handoff
contract is satisfied*.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Mapping

from langchain_core.messages import AIMessage
from langgraph.graph import END
from pydantic import BaseModel, ValidationError

from app.core.logging import get_logger

# ``GraphState`` is a plain ``TypedDict`` (it pulls in only langchain/langgraph,
# never the heavy app runtime), so importing it here is a type-level dependency
# only — no behavioral coupling and no import cycle. The import must be at
# runtime (not under ``TYPE_CHECKING``) because LangGraph resolves the router's
# annotations via ``get_type_hints`` when inferring the branch input schema.
from app.core.state import GraphState
from app.orchestration.schemas import (
    OUTPUT_KEYS,
    OUTPUT_SCHEMAS,
    AgentIO,
    coerce,
    safe_fallback,
)

log = get_logger("agro_syria.orchestrator")

__all__ = ["AgentOrchestrator", "get_orchestrator"]

# A LangGraph node: async ``state -> partial-state-update``.
NodeFn = Callable[["GraphState"], Awaitable[dict[str, Any]]]

# Canonical node identifiers — kept identical to the names registered on the
# LangGraph ``StateGraph`` so the orchestrator and the builder never drift.
LIAISON = "Liaison Agent"
VISION = "Vision Agent"
IRRIGATION = "Irrigation Agent"
SOIL = "Soil Agent"
MARKET = "Market Agent"
CALENDAR = "Calendar Agent"
RESEARCH = "Research Agent"
SYNTHESIZER = "Strategic Synthesizer"

# Liaison's detected intent -> the one domain agent that matches it. "general"
# and "vision" (and anything else unmatched) intentionally have no entry —
# those turns fan out to Research alone, no domain agent at all.
INTENT_NODE_MAP: dict[str, str] = {
    "irrigation": IRRIGATION,
    "soil": SOIL,
    "market": MARKET,
    "calendar": CALENDAR,
}


class AgentOrchestrator:
    """Deterministic router and handoff validator for the agent pipeline.

    The class is stateless and therefore safe to share as a process-wide
    singleton (see :func:`get_orchestrator`). All decision data is encoded in
    class-level constants.
    """

    # ── Topology ─────────────────────────────────────────────────────────
    # All nodes, in declaration order (used for node registration / guarding).
    PIPELINE: tuple[str, ...] = (
        LIAISON,
        VISION,
        IRRIGATION,
        SOIL,
        MARKET,
        CALENDAR,
        RESEARCH,
        SYNTHESIZER,
    )

    # Every node that can fan in to JOIN. At most one of the four domain
    # agents plus Research actually run in any given turn (never all five) —
    # this tuple is the superset of possible JOIN predecessors, used both for
    # path_map validation and for wiring each one's static edge to JOIN.
    PARALLEL_STAGE: tuple[str, ...] = (IRRIGATION, SOIL, MARKET, CALENDAR, RESEARCH)

    # What an image turn (Vision Agent) statically fans out to. Vision-flow
    # intent is always "vision", which never matches INTENT_NODE_MAP, so a
    # domain agent has never had anything to do on the image path — Research
    # alone reflects that rather than wiring (and always no-op-ing) all four.
    VISION_TARGETS: tuple[str, ...] = (RESEARCH,)

    JOIN: str = SYNTHESIZER

    # ── Transition table (the one real branch point: after Liaison) ──────
    # An ordered tuple of ``(flag, destination)`` rules; the first rule whose
    # ``flag`` is truthy wins, with a ``None`` default last. A *list* destination
    # fans out to several nodes that then run in parallel.
    #
    #   greeting        -> stop (warm reply already emitted)
    #   missing_slots   -> stop (slot-fill question already emitted)
    #   image_b64       -> Vision Agent (visual analysis first, then fan-out)
    #   (default)       -> [<matching domain agent>?, Research] in parallel —
    #                      computed dynamically from intent in route(), since
    #                      this is no longer a single fixed destination pair
    #                      (see route() below).
    #
    # Every transition *after* Liaison is deterministic and static (Vision
    # fans out to VISION_TARGETS; PARALLEL_STAGE fans in to JOIN; JOIN -> END),
    # so it needs no runtime decision and is wired directly in the graph builder.
    HANDOFF_RULES: dict[str, tuple[tuple[str | None, str | list[str]], ...]] = {
        LIAISON: (
            ("greeting", END),
            ("missing_slots", END),
            ("image_b64", VISION),
            (None, list(PARALLEL_STAGE)),  # superset for path_map(); route() computes the real subset
        ),
    }

    # ── Per-agent output contracts ───────────────────────────────────────
    # The ``agricultural_context`` key each agent must have produced before the
    # graph may advance past it. Checked by :meth:`validate_handoff`.
    REQUIRED_CONTEXT: dict[str, tuple[str, ...]] = {
        LIAISON: ("liaison_output",),
        VISION: ("vision_output",),
        IRRIGATION: ("calculator_output",),
        SOIL: ("calculator_output",),
        MARKET: ("calculator_output",),
        CALENDAR: ("calculator_output",),
        RESEARCH: ("research_output",),
        SYNTHESIZER: ("synthesizer_output",),
    }

    # Maps the ``sender`` label written by each node onto the canonical node id,
    # letting :meth:`route` recover "which node just ran" from state alone.
    _SENDER_TO_NODE: dict[str, str] = {
        "user": LIAISON,  # pre-pipeline seed; START -> Liaison is a static edge
        "liaison": LIAISON,
        "vision_agent": VISION,
        "irrigation_agent": IRRIGATION,
        "soil_agent": SOIL,
        "market_agent": MARKET,
        "calendar_agent": CALENDAR,
        "research_agent": RESEARCH,
        "synthesizer": SYNTHESIZER,
    }

    # Reverse map — used when synthesising a safe-fallback state update.
    _NODE_TO_SENDER: dict[str, str] = {
        LIAISON: "liaison",
        VISION: "vision_agent",
        IRRIGATION: "irrigation_agent",
        SOIL: "soil_agent",
        MARKET: "market_agent",
        CALENDAR: "calendar_agent",
        RESEARCH: "research_agent",
        SYNTHESIZER: "synthesizer",
    }

    # ── Public API ───────────────────────────────────────────────────────
    def route(self, state: "GraphState") -> str | list[str]:
        """Compute the next node(s) from the current state.

        Fully deterministic: inspects the boolean flags produced by the agents
        (:meth:`flags`) and walks :data:`HANDOFF_RULES` for whichever node last
        executed. A ``list`` return value fans out to multiple nodes that then
        run concurrently. No LLM call is involved.

        The ``None`` (default) rule is special-cased rather than returning its
        table value literally: the actual destination now depends on intent
        (which one of the four domain agents, if any, matches this turn),
        which a static flag/destination table can't express. Research always
        runs; a domain agent joins it only when intent has a match.
        """
        node = self._current_node(state)
        flags = self.flags(state)
        for flag, destination in self.HANDOFF_RULES[node]:
            if flag is None:
                if node == LIAISON:
                    domain_node = INTENT_NODE_MAP.get(self._intent(state))
                    return [domain_node, RESEARCH] if domain_node else [RESEARCH]
                return destination
            if flags.get(flag, False):
                return destination
        # Defensive: every rule tuple terminates with a ``None`` default, so
        # this is unreachable unless HANDOFF_RULES is misconfigured.
        return END

    def validate_handoff(self, from_agent: str, context: Mapping[str, Any]) -> list[str]:
        """Return the required-context keys *missing* for ``from_agent``.

        A handoff is complete (and may advance) iff the returned list is empty.
        "Missing" means the key is absent, ``None``, or empty. Booleans are
        treated as present even when ``False``.
        """
        if from_agent not in self.REQUIRED_CONTEXT:
            raise ValueError(f"AgentOrchestrator: unknown agent '{from_agent}'")

        missing: list[str] = []
        for key in self.REQUIRED_CONTEXT[from_agent]:
            value = context.get(key)
            if value is None or (not isinstance(value, bool) and not value):
                missing.append(key)
        return missing

    def path_map(self, node: str) -> dict[str, str]:
        """Return the LangGraph ``path_map`` (destination -> destination) for *node*.

        Derived from :data:`HANDOFF_RULES` (flattening any fan-out lists) so the
        graph wiring stays in lock-step with the transition table.
        """
        targets: dict[str, str] = {}
        for _, destination in self.HANDOFF_RULES[node]:
            for dest in (destination if isinstance(destination, list) else [destination]):
                targets[dest] = dest
        return targets

    def flags(self, state: "GraphState") -> dict[str, bool]:
        """Project the raw state onto the three routing flags.

        Primary source is the typed :class:`LiaisonOutput` produced by the
        Liaison node (``greeting`` / ``missing_slots`` / ``has_image``). Falls
        back to the raw ``image_base64`` input (present before Liaison runs) and,
        defensively, to legacy flat keys.
        """
        ctx = self._context(state)
        liaison = self._as_dict(ctx.get("liaison_output"))
        return {
            "greeting": bool(liaison.get("greeting") or ctx.get("is_greeting")),
            "image_b64": bool(
                liaison.get("has_image")
                or ctx.get("image_base64")
                or ctx.get("image_b64")
                or ctx.get("has_image")
            ),
            "missing_slots": bool(liaison.get("missing_slots") or ctx.get("slot_ask")),
        }

    def _intent(self, state: "GraphState") -> str:
        """The Liaison-detected intent, for the default-case domain-agent lookup."""
        ctx = self._context(state)
        liaison = self._as_dict(ctx.get("liaison_output"))
        return liaison.get("intent", "general")

    # ── Schema governance: output validation + retry/fallback ────────────
    def validate_output(self, node_id: str, payload: Any) -> AgentIO:
        """Validate ``payload`` against ``node_id``'s output schema.

        Raises :class:`pydantic.ValidationError` if the payload does not conform.
        Accepts a model instance or a mapping.
        """
        if node_id not in OUTPUT_SCHEMAS:
            raise ValueError(f"AgentOrchestrator: no output schema for '{node_id}'")
        return coerce(OUTPUT_SCHEMAS[node_id], payload)

    def guard(self, node_id: str, fn: NodeFn, *, retries: int = 1) -> NodeFn:
        """Wrap a node so its output is schema-validated at the handoff boundary.

        Governance applied on every invocation:

        1. Run the node. If it *raises*, retry up to ``retries`` times.
        2. Validate the emitted output against the node's schema. On
           :class:`ValidationError`, retry up to ``retries`` times.
        3. If still failing, install a schema-valid :func:`safe_fallback` so the
           pipeline degrades gracefully instead of propagating malformed state.

        The validated model is written back (normalised) into the state update,
        so downstream nodes always receive a canonical, typed object.
        """
        key = OUTPUT_KEYS[node_id]

        async def guarded(state: "GraphState") -> dict[str, Any]:
            last_error: Exception | None = None
            for attempt in range(retries + 1):
                try:
                    update = await fn(state)
                except Exception as exc:  # node blew up — retry then fall back
                    last_error = exc
                    log.warning(
                        "node '%s' raised (%s) attempt %d/%d",
                        node_id, type(exc).__name__, attempt + 1, retries + 1,
                    )
                    continue

                ctx = update.get("agricultural_context", {})
                try:
                    validated = self.validate_output(node_id, ctx.get(key))
                except ValidationError as exc:
                    last_error = exc
                    log.warning(
                        "node '%s' produced malformed %s (attempt %d/%d): %s",
                        node_id, key, attempt + 1, retries + 1,
                        exc.errors(include_url=False),
                    )
                    continue

                ctx[key] = validated  # normalise to a freshly-validated model
                update["agricultural_context"] = ctx
                return update

            # Retries exhausted — safe, schema-valid degradation.
            log.error(
                "node '%s' failed schema governance after %d attempts (%s) — "
                "installing safe fallback",
                node_id, retries + 1,
                type(last_error).__name__ if last_error else "unknown",
            )
            fallback = safe_fallback(node_id)
            return {
                "messages": [AIMessage(content=fallback.reply_ar, name=self._NODE_TO_SENDER[node_id])]
                if hasattr(fallback, "reply_ar")
                else [],
                "sender": self._NODE_TO_SENDER[node_id],
                "agricultural_context": {key: fallback},
            }

        guarded.__name__ = f"guarded_{self._NODE_TO_SENDER.get(node_id, node_id)}"
        return guarded

    # ── Internals ────────────────────────────────────────────────────────
    @staticmethod
    def _context(state: "GraphState") -> Mapping[str, Any]:
        return state.get("agricultural_context") or {}

    @staticmethod
    def _as_dict(value: Any) -> dict[str, Any]:
        """Coerce a stored output (Pydantic model | mapping | None) to a dict."""
        if isinstance(value, BaseModel):
            return value.model_dump()
        if isinstance(value, Mapping):
            return dict(value)
        return {}

    def _current_node(self, state: "GraphState") -> str:
        """Resolve the node that produced ``state`` from its ``sender`` label."""
        sender = state.get("sender") or "user"
        try:
            return self._SENDER_TO_NODE[sender]
        except KeyError as exc:
            raise ValueError(
                f"AgentOrchestrator: cannot route — unknown sender '{sender}'"
            ) from exc


# ── Process-wide singleton ───────────────────────────────────────────────────
_ORCHESTRATOR: AgentOrchestrator | None = None


def get_orchestrator() -> AgentOrchestrator:
    """Return the shared, stateless :class:`AgentOrchestrator` instance."""
    global _ORCHESTRATOR
    if _ORCHESTRATOR is None:
        _ORCHESTRATOR = AgentOrchestrator()
    return _ORCHESTRATOR
