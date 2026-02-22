from pydantic import BaseModel, Field
from typing import Optional


class FlowNode(BaseModel):
    id: str
    type: str
    label: str
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    inputLabel: Optional[str] = None
    outputLabel: Optional[str] = None
    systemName: Optional[str] = None
    duration: Optional[str] = None
    category: Optional[str] = None
    swimLaneId: Optional[str] = None


class FlowEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class ReviewRequest(BaseModel):
    currentNodes: list[FlowNode]
    currentEdges: list[FlowEdge]
    userMessage: str = ""
    context: dict


class ChatRequest(BaseModel):
    message: str
    context: dict
    currentNodes: list[FlowNode] = []
    currentEdges: list[FlowEdge] = []
    recentTurns: list[dict] = []
    conversationSummary: Optional[str] = None


class ValidateL7Request(BaseModel):
    nodeId: str
    label: str
    nodeType: str
    context: dict
    currentNodes: list[FlowNode] = []
    currentEdges: list[FlowEdge] = []


class ContextualSuggestRequest(BaseModel):
    context: dict
    currentNodes: list[FlowNode] = []
    currentEdges: list[FlowEdge] = []


class CategorizeNodesRequest(BaseModel):
    context: dict
    nodes: list[FlowNode]
