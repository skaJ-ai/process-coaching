"""HR Process Mining Tool - Backend (v5)"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title="HR Process Mining v5")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

try:
    from .schemas import ReviewRequest, ChatRequest, ValidateL7Request, ContextualSuggestRequest
    from .llm_service import check_llm, call_llm, close_http_client, get_llm_debug_status
    from .chat_orchestrator import orchestrate_chat, get_chain_status
    from .prompt_templates import REVIEW_SYSTEM, COACH_TEMPLATE, CONTEXTUAL_SUGGEST_SYSTEM, FIRST_SHAPE_SYSTEM, PDD_ANALYSIS, PDD_INSIGHTS_SYSTEM
    from .flow_services import describe_flow, mock_review, mock_validate
except ImportError:
    from schemas import ReviewRequest, ChatRequest, ValidateL7Request, ContextualSuggestRequest
    from llm_service import check_llm, call_llm, close_http_client, get_llm_debug_status
    from chat_orchestrator import orchestrate_chat, get_chain_status
    from prompt_templates import REVIEW_SYSTEM, COACH_TEMPLATE, CONTEXTUAL_SUGGEST_SYSTEM, FIRST_SHAPE_SYSTEM, PDD_ANALYSIS, PDD_INSIGHTS_SYSTEM
    from flow_services import describe_flow, mock_review, mock_validate


@app.post("/api/review")
async def review_flow(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(REVIEW_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}",
                       max_tokens=1200, temperature=0.3)
    return r or mock_review(req.currentNodes, req.currentEdges)


@app.post("/api/pdd-insights")
async def pdd_insights(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(PDD_INSIGHTS_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    return r or {"summary": "분석에 충분한 정보가 없습니다.", "inefficiencies": [], "digitalWorker": [], "sscCandidates": [], "redesign": []}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        fd = describe_flow(req.currentNodes, req.currentEdges)
        history_lines = []
        for t in req.recentTurns[-4:]:
            role = "사용자" if t.get("role") == "user" else "코치"
            content = str(t.get("content", "")).strip()
            if content:
                history_lines.append(f"- {role}: {content}")
        history_block = "\n".join(history_lines) if history_lines else "(없음)"
        summary = req.conversationSummary or "(없음)"
        prompt = (
            f"컨텍스트: {req.context}\n"
            f"플로우:\n{fd}\n"
            f"대화 요약: {summary}\n"
            f"최근 대화 4턴:\n{history_block}\n"
            f"질문: {req.message}"
        )
        return await orchestrate_chat(COACH_TEMPLATE, prompt, req.message, req.currentNodes, req.currentEdges)
    except Exception:
        logger.exception("/api/chat 처리 중 예외 발생")
        return {"speech": "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "suggestions": [], "quickQueries": []}


@app.post("/api/validate-l7")
async def validate_l7(req: ValidateL7Request):
    # Phase 1: 실시간 L7 판정은 프론트 룰 엔진에서 처리.
    # 백엔드 validate-l7는 저장/배치/호환 용도로 룰 기반 결과만 반환.
    return mock_validate(req.label, req.nodeType, llm_failed=False)


@app.post("/api/contextual-suggest")
async def contextual_suggest(req: ContextualSuggestRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(CONTEXTUAL_SUGGEST_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    return r or {"guidance": "", "quickQueries": []}


@app.post("/api/first-shape-welcome")
async def first_shape_welcome(req: ContextualSuggestRequest):
    process_name = req.context.get("processName", "HR 프로세스")
    process_type = req.context.get("l5", "프로세스")
    r = await call_llm(FIRST_SHAPE_SYSTEM, f"프로세스명: {process_name}\n프로세스 타입: {process_type}\n\n사용자가 이 프로세스의 첫 번째 단계를 추가했습니다. 환영하고 격려해주세요.")

    if r:
        return {
            "text": f"👋 {r.get('greeting', '')}\n\n{r.get('processFlowExample', '')}\n\n{r.get('guidanceText', '')}",
            "quickQueries": r.get("quickQueries", []),
        }
    return {
        "text": f"👋 첫 단계가 추가되었네요! \"{process_name}\" 프로세스를 함께 완성해보겠습니다.\n\n다음 단계를 추가하거나 아래 질문으로 프로세스 구조를 생각해보세요.",
        "quickQueries": ["일반적인 단계는 뭐가 있나요?", "어떤 분기점이 필요할까요?", "이 프로세스의 주요 역할은 누구인가요?"],
    }


@app.post("/api/analyze-pdd")
async def analyze_pdd(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(PDD_ANALYSIS, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    if r:
        return r
    recs = []
    for n in req.currentNodes:
        if n.type in ("start", "end"):
            continue
        cat = "as_is"
        if any(k in n.label for k in ["조회", "입력", "추출", "집계"]):
            cat = "digital_worker"
        elif any(k in n.label for k in ["통보", "안내", "발송"]):
            cat = "ssc_transfer"
        recs.append({"nodeId": n.id, "nodeLabel": n.label, "suggestedCategory": cat, "reason": "규칙 기반", "confidence": "low"})
    return {"recommendations": recs, "summary": "규칙 기반 자동 분류입니다."}


@app.get("/api/health")
async def health():
    llm = await check_llm()
    return {
        "status": "ok",
        "version": "5.0",
        "llm_connected": llm,
        "mode": "live" if llm else "mock",
        "llm_debug": get_llm_debug_status(),
        "chat_chain": get_chain_status(),
    }


@app.on_event("shutdown")
async def shutdown():
    await close_http_client()


if __name__ == "__main__":
    import uvicorn

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except SystemExit:
        logger.warning("Port 8000 is busy. Trying port 8002...")
        uvicorn.run(app, host="0.0.0.0", port=8002)
