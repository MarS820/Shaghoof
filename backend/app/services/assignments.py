from __future__ import annotations
import os
import logging
from typing import Literal, Optional, TypedDict

from ..core.config import settings

logger = logging.getLogger(__name__)

try:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_groq import ChatGroq
    from langgraph.graph import END, START, StateGraph
    from pydantic import BaseModel, Field
except ImportError:
    ChatGroq = None  # type: ignore[assignment,misc]
    StateGraph = None  # type: ignore[assignment,misc]


class _AssignmentState(TypedDict):
    topic: str
    source_data: str
    student_level: str
    assignment_type: str
    difficulty: str
    number_of_questions: int
    draft_assignment: str
    review_feedback: str
    approved: bool
    final_assignment: str


class _ReviewResult(BaseModel):
    approved: bool = Field(description="True when all requirements are met.")
    feedback: str = Field(description="Corrections or approval message.")


def _build_graph(model, api_key: str):
    reviewer_model = model.with_structured_output(_ReviewResult)

    def generate_node(state: _AssignmentState):
        resp = model.invoke([
            SystemMessage(content=(
                "You are a professional educational assignment designer. "
                "Create an assignment using only the supplied source material. "
                "Do not use outside information. Do not provide answers. Return only the assignment."
            )),
            HumanMessage(content=f"""
TOPIC: {state['topic']}
SOURCE MATERIAL: {state['source_data']}
STUDENT LEVEL: {state['student_level']}
ASSIGNMENT TYPE: {state['assignment_type']}
DIFFICULTY: {state['difficulty']}
NUMBER OF QUESTIONS: {state['number_of_questions']}

Create an assignment with: title, learning objectives, instructions,
exactly {state['number_of_questions']} numbered questions with marks,
total marks, and a short grading rubric.
"""),
        ])
        return {"draft_assignment": str(resp.content).strip(), "review_feedback": "",
                "approved": False, "final_assignment": ""}

    def review_node(state: _AssignmentState):
        review = reviewer_model.invoke([
            SystemMessage(content=(
                "You are a strict educational assignment reviewer. "
                "Approve only when every requirement is satisfied."
            )),
            HumanMessage(content=f"""
SOURCE: {state['source_data']}
ASSIGNMENT: {state['draft_assignment']}
Check: topic={state['topic']}, level={state['student_level']}, type={state['assignment_type']},
difficulty={state['difficulty']}, exactly {state['number_of_questions']} questions, marks included,
rubric included, no answers, source-supported only.
"""),
        ])
        return {"approved": review.approved, "review_feedback": review.feedback.strip(),
                "final_assignment": state["draft_assignment"] if review.approved else ""}

    def improve_node(state: _AssignmentState):
        resp = model.invoke([
            SystemMessage(content="Correct the assignment using reviewer feedback. Use only source material."),
            HumanMessage(content=f"SOURCE: {state['source_data']}\nORIGINAL: {state['draft_assignment']}\nFEEDBACK: {state['review_feedback']}"),
        ])
        return {"final_assignment": str(resp.content).strip()}

    def route(state: _AssignmentState) -> Literal["finish", "improve"]:
        return "finish" if state["approved"] else "improve"

    g = StateGraph(_AssignmentState)
    g.add_node("generate", generate_node)
    g.add_node("review", review_node)
    g.add_node("improve", improve_node)
    g.add_edge(START, "generate")
    g.add_edge("generate", "review")
    g.add_conditional_edges("review", route, {"finish": END, "improve": "improve"})
    g.add_edge("improve", END)
    return g.compile()


def generate_assignment(
    topic: str,
    source: str = "",
    student_level: str = "intermediate",
    assignment_type: str = "mixed",
    difficulty: str = "medium",
    count: int = 5,
    api_key: Optional[str] = None,
) -> str:
    topic = (topic or "").strip()
    if not topic:
        raise ValueError("`topic` must be non-empty.")
    count = max(1, min(count, 20))

    key = api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
    if not key or ChatGroq is None or StateGraph is None:
        return f"Assignment for {topic} — AI service unavailable. Please configure GROQ_API_KEY."

    try:
        model = ChatGroq(api_key=key, model="llama-3.3-70b-versatile",
                         temperature=0.2, timeout=60, max_retries=2)
        graph = _build_graph(model, key)
        result = graph.invoke({
            "topic": topic, "source_data": source, "student_level": student_level,
            "assignment_type": assignment_type, "difficulty": difficulty.title(),
            "number_of_questions": count, "draft_assignment": "",
            "review_feedback": "", "approved": False, "final_assignment": "",
        })
        return (result.get("final_assignment") or result.get("draft_assignment") or "").strip()
    except Exception as exc:
        logger.warning("Assignment generation failed: %s", exc)
        return f"Assignment for {topic} — generation failed: {exc}"
