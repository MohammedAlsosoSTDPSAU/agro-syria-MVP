"""LangGraph shared state definition for the Agro-Syria agent graph.

``agricultural_context`` is the typed handoff channel between agents. Each node
writes a single strongly-typed Pydantic output model (see
``app.orchestration.schemas``) under its canonical key — e.g. ``liaison_output``,
``vision_output``, ``synthesizer_output``. The reducer below shallow-merges
successive partial updates, so the context accumulates one validated object per
agent as the pipeline advances. Values are Pydantic ``BaseModel`` instances (or,
for raw inputs like ``image_base64``, primitives); no logic-bearing unstructured
strings/dicts are passed between nodes.
"""

from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


def merge_context(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    """Shallow-merge two context snapshots (latest write wins per key).

    Both operands are plain mappings whose values may be Pydantic models; the
    merge is value-agnostic, so typed outputs pass through unchanged. Concurrent
    fan-out branches (Calculator + Research) write disjoint keys, so the merge is
    conflict-free and order-independent.
    """
    return {**a, **b}


def latest_sender(a: str, b: str) -> str:
    """Reducer for ``sender`` under parallelism.

    When the fan-out branches (Calculator + Research) complete in the same
    superstep they both write ``sender``; without a reducer LangGraph would
    reject the concurrent update. ``sender`` is telemetry only past the fan-out
    (routing after Liaison is static), so taking the latest non-empty value is
    safe and deterministic.
    """
    return b or a


class GraphState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    sender: Annotated[str, latest_sender]
    # Typed handoff channel: ``{ "<agent>_output": <AgentIO model>, ... }``.
    agricultural_context: Annotated[dict[str, Any], merge_context]
