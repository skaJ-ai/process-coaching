import os
import time
from typing import Any

try:
    from .flow_services import mock_review
    from .llm_service import call_llm
except ImportError:
    from flow_services import mock_review
    from llm_service import call_llm

CHAT_CHAIN_ENABLED = os.getenv("CHAT_CHAIN_ENABLED", "true").lower() != "false"
RULE_COACH_ENABLED = os.getenv("RULE_COACH_ENABLED", "true").lower() != "false"
MOCK_COACH_ENABLED = os.getenv("MOCK_COACH_ENABLED", "true").lower() != "false"
LLM_CB_FAIL_THRESHOLD = int(os.getenv("LLM_CB_FAIL_THRESHOLD", "3"))
LLM_CB_COOLDOWN_SEC = int(os.getenv("LLM_CB_COOLDOWN_SEC", "90"))

_llm_fail_count = 0
_llm_cooldown_until = 0.0


def _extract_text(payload: Any) -> str:
    if not payload:
        return ""
    if isinstance(payload, dict):
        for key in ("speech", "message", "guidance", "text", "content", "answer"):
            v = payload.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        try:
            v = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
            if isinstance(v, str) and v.strip():
                return v.strip()
        except Exception:
            pass
    return ""


def _infer_suggestion_type(s: dict) -> str:
    """type 필드가 없을 때 label/summary 키워드로 추론"""
    if s.get("type"):
        return s["type"]
    text = " ".join(filter(None, [s.get("labelSuggestion", ""), s.get("summary", "")])).lower()
    if any(k in text for k in ["종료", "완료", "끝", "end", "finish"]):
        return "END"
    if any(k in text for k in ["시작", "start", "begin"]):
        return "START"
    if any(k in text for k in ["판단", "결정", "여부", "분기", "decision", "승인", "반려"]):
        return "DECISION"
    if any(k in text for k in ["subprocess", "서브", "하위"]):
        return "SUBPROCESS"
    return "PROCESS"


def _normalize(payload: Any) -> dict:
    text = _extract_text(payload)
    suggestions = []
    quick_queries = []
    if isinstance(payload, dict):
        raw_suggestions = payload.get("suggestions") or []
        if isinstance(raw_suggestions, list):
            suggestions = [{**s, "type": _infer_suggestion_type(s)} for s in raw_suggestions if isinstance(s, dict)]
        raw_quick = payload.get("quickQueries") or []
        if isinstance(raw_quick, list):
            quick_queries = raw_quick
    return {
        "speech": text,
        "suggestions": suggestions,
        "quickQueries": quick_queries,
    }


def _intent(message: str) -> str:
    q = (message or "").strip()
    if any(k in q for k in ["다음", "next", "이어", "후속"]):
        return "next"
    if any(k in q for k in ["누락", "빠진", "missing", "없어", "보강"]):
        return "missing"
    if any(k in q for k in ["분기", "승인", "반려", "조건", "예외"]):
        return "decision"
    if any(k in q for k in ["요약", "정리", "summary"]):
        return "summary"
    if any(k in q for k in ["검토", "개선", "리뷰", "review"]):
        return "review"
    return "general"


def _flow_signals(nodes, edges) -> dict:
    node_ids = {n.id for n in nodes}
    source_ids = {e.source for e in edges}
    target_ids = {e.target for e in edges}
    orphan_ids = list(node_ids - source_ids - target_ids)
    has_start = any(n.type == "start" for n in nodes)
    has_end = any(n.type == "end" for n in nodes)
    decision_count = sum(1 for n in nodes if n.type == "decision")
    process_count = sum(1 for n in nodes if n.type == "process")
    return {
        "has_start": has_start,
        "has_end": has_end,
        "orphan_ids": orphan_ids,
        "decision_count": decision_count,
        "process_count": process_count,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


def _rule_coach(message: str, nodes, edges) -> dict:
    s = _flow_signals(nodes, edges)
    intent = _intent(message)
    issues = []
    if not s["has_start"]:
        issues.append("시작 노드가 없습니다")
    if not s["has_end"]:
        issues.append("종료 노드가 없습니다")
    if s["orphan_ids"]:
        issues.append(f"연결되지 않은 노드 {len(s['orphan_ids'])}개")
    if s["process_count"] >= 3 and s["decision_count"] == 0:
        issues.append("분기 노드가 없어 예외/판단 경로가 누락될 수 있습니다")

    if intent == "next":
        speech = "다음 단계는 현재 마지막 업무 이후의 검토/승인 또는 종료 조건을 명확히 두는 것입니다."
    elif intent == "missing":
        speech = "누락 가능성이 큰 항목은 종료 조건, 예외 분기, 그리고 연결되지 않은 노드입니다."
    elif intent == "decision":
        speech = "분기 기준은 '~여부' 형태로 명확히 두고 Yes/No 후속 단계를 각각 연결하는 방식이 안전합니다."
    elif intent == "summary":
        speech = f"현재 플로우는 노드 {s['node_count']}개, 연결 {s['edge_count']}개이며 핵심 점검 항목은 종료 조건과 분기 완결성입니다."
    elif intent == "review":
        speech = "구조 점검 관점에서 시작/종료, orphan 노드, 분기 기준 명확성을 우선 검토하세요."
    else:
        speech = "현재 구조 기준으로 다음 액션은 누락 노드 보완, 분기 기준 명확화, 종료 조건 확정입니다."

    if issues:
        speech += "\n\n점검 결과: " + " / ".join(issues)

    suggestions = []
    if not s["has_end"]:
        suggestions.append({
            "action": "ADD",
            "type": "END",
            "summary": "종료 노드 추가",
            "labelSuggestion": "종료",
            "confidence": "high",
            "reason": "프로세스 완료 조건 명확화",
        })
    if s["process_count"] >= 3 and s["decision_count"] == 0:
        suggestions.append({
            "action": "ADD",
            "type": "DECISION",
            "summary": "분기 노드 추가",
            "labelSuggestion": "승인 여부를 판단한다",
            "confidence": "medium",
            "reason": "예외/판단 경로 명확화",
        })

    return {
        "speech": speech,
        "suggestions": suggestions,
        "quickQueries": [
            "다음 단계로 무엇을 추가하면 좋을까요?",
            "누락된 종료 조건이 있나요?",
            "분기 기준을 어떻게 적으면 좋을까요?",
        ],
    }


def _mock_coach(message: str, nodes, edges) -> dict:
    base = mock_review(nodes, edges)
    if not base.get("speech"):
        base["speech"] = "테스트 모드입니다. 질문 의도를 기준으로 기본 코칭을 제공합니다."
    if not base.get("quickQueries"):
        base["quickQueries"] = ["다음 단계 제안", "누락 항목 점검", "분기 기준 작성법"]
    return _normalize(base)


def _llm_available_now() -> bool:
    return time.time() >= _llm_cooldown_until


def _mark_llm_failure() -> None:
    global _llm_fail_count, _llm_cooldown_until
    _llm_fail_count += 1
    if _llm_fail_count >= LLM_CB_FAIL_THRESHOLD:
        _llm_cooldown_until = time.time() + max(0, LLM_CB_COOLDOWN_SEC)


def _mark_llm_success() -> None:
    global _llm_fail_count, _llm_cooldown_until
    _llm_fail_count = 0
    _llm_cooldown_until = 0.0


def get_chain_status() -> dict:
    cooldown_left = max(0, int(_llm_cooldown_until - time.time()))
    return {
        "enabled": CHAT_CHAIN_ENABLED,
        "llm_fail_count": _llm_fail_count,
        "llm_cooldown_left_sec": cooldown_left,
        "rule_enabled": RULE_COACH_ENABLED,
        "mock_enabled": MOCK_COACH_ENABLED,
    }


async def orchestrate_chat(system_prompt: str, prompt: str, message: str, nodes, edges) -> dict:
    if not CHAT_CHAIN_ENABLED:
        r = await call_llm(system_prompt, prompt, allow_text_fallback=True)
        n = _normalize(r)
        if n["speech"]:
            n["source"] = "llm"
            n["fallbackLevel"] = 0
            return n

    if _llm_available_now():
        r = await call_llm(system_prompt, prompt, allow_text_fallback=True)
        n = _normalize(r)
        if n["speech"] or n["suggestions"]:
            _mark_llm_success()
            n["source"] = "llm"
            n["fallbackLevel"] = 0
            return n
        _mark_llm_failure()

    if RULE_COACH_ENABLED:
        r2 = _rule_coach(message, nodes, edges)
        n2 = _normalize(r2)
        if n2["speech"] or n2["suggestions"]:
            n2["source"] = "rules"
            n2["fallbackLevel"] = 1
            return n2

    if MOCK_COACH_ENABLED:
        r3 = _mock_coach(message, nodes, edges)
        n3 = _normalize(r3)
        n3["source"] = "mock"
        n3["fallbackLevel"] = 2
        return n3

    return {
        "speech": "현재 코치 체인을 사용할 수 없습니다. 설정을 확인해주세요.",
        "suggestions": [],
        "quickQueries": [],
        "source": "none",
        "fallbackLevel": 3,
    }
