"""LangGraph shared state definition for the Agro-Syria agent graph."""

from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


def _merge_dicts(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    return {**a, **b}


class GraphState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    sender: str
    agricultural_context: Annotated[dict[str, Any], _merge_dicts]
