"""HR Process Mining Tool - Backend (v5)"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title="Process Coaching AI 베타버전")

# Import CORS configuration
try:
    from .env_config import ALLOWED_ORIGINS
except ImportError:
    from env_config import ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"speech": "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "suggestions": [], "quickQueries": []},
    )

try:
    from .schemas import ReviewRequest, ChatRequest, ValidateL7Request, ContextualSuggestRequest, CategorizeNodesRequest
    from .llm_service import check_llm, call_llm, close_http_client, get_llm_debug_status
    from .chat_orchestrator import orchestrate_chat, get_chain_status, _classify_intent
    from .prompt_templates import REVIEW_SYSTEM, COACH_TEMPLATE, CONTEXTUAL_SUGGEST_SYSTEM, FIRST_SHAPE_SYSTEM, PDD_ANALYSIS, PDD_INSIGHTS_SYSTEM, KNOWLEDGE_PROMPT, CATEGORIZE_PROMPT
    from .flow_services import describe_flow, mock_review, mock_validate
    from .l345_reference import get_l345_context
except ImportError:
    from schemas import ReviewRequest, ChatRequest, ValidateL7Request, ContextualSuggestRequest, CategorizeNodesRequest
    from llm_service import check_llm, call_llm, close_http_client, get_llm_debug_status
    from chat_orchestrator import orchestrate_chat, get_chain_status, _classify_intent
    from prompt_templates import REVIEW_SYSTEM, COACH_TEMPLATE, CONTEXTUAL_SUGGEST_SYSTEM, FIRST_SHAPE_SYSTEM, PDD_ANALYSIS, PDD_INSIGHTS_SYSTEM, KNOWLEDGE_PROMPT, CATEGORIZE_PROMPT
    from flow_services import describe_flow, mock_review, mock_validate
    from l345_reference import get_l345_context


def _build_l345_block(context: dict) -> str:
    """req.context에서 L345 참조 블록 생성. 매칭 실패 시 빈 문자열."""
    if not isinstance(context, dict):
        return ""
    return get_l345_context(
        context.get("l4", ""),
        context.get("l5", ""),
        context.get("processName", ""),
    )


@app.post("/api/review")
async def review_flow(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    l345 = _build_l345_block(req.context) if isinstance(req.context, dict) else ""
    ctx_block = (
        f"[프로세스 컨텍스트]\n"
        f"L4: {req.context.get('l4', '미설정') if isinstance(req.context, dict) else req.context}\n"
        f"L5: {req.context.get('l5', '미설정') if isinstance(req.context, dict) else ''}\n"
        f"L6(활동): {req.context.get('processName', '미설정') if isinstance(req.context, dict) else ''}\n"
    )
    if l345:
        ctx_block += f"\n{l345}\n"
    r = await call_llm(REVIEW_SYSTEM, f"{ctx_block}\n플로우:\n{fd}",
                       max_tokens=1200, temperature=0.3)
    return r or mock_review(req.currentNodes, req.currentEdges)


@app.post("/api/pdd-insights")
async def pdd_insights(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    l345 = _build_l345_block(req.context) if isinstance(req.context, dict) else ""
    pdd_ctx = f"컨텍스트: {req.context}\n"
    if l345:
        pdd_ctx += f"\n{l345}\n"
    r = await call_llm(PDD_INSIGHTS_SYSTEM, f"{pdd_ctx}플로우:\n{fd}")
    return r or {"summary": "분석에 충분한 정보가 없습니다.", "inefficiencies": [], "digitalWorker": [], "sscCandidates": [], "redesign": []}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        intent = _classify_intent(req.message)
        history_lines = []
        for t in req.recentTurns[-10:]:
            role = "사용자" if t.get("role") == "user" else "코치"
            content = str(t.get("content", "")).strip()
            if content:
                history_lines.append(f"- {role}: {content}")
        history_block = "\n".join(history_lines) if history_lines else "(없음)"
        summary = req.conversationSummary or "(없음)"

        l345 = _build_l345_block(req.context) if isinstance(req.context, dict) else ""
        ctx_lines = (
            f"[프로세스 컨텍스트]\n"
            f"L4: {req.context.get('l4', '미설정') if isinstance(req.context, dict) else req.context}\n"
            f"L5: {req.context.get('l5', '미설정') if isinstance(req.context, dict) else ''}\n"
            f"L6(활동): {req.context.get('processName', '미설정') if isinstance(req.context, dict) else ''}\n"
        )
        if l345:
            ctx_lines += f"\n{l345}\n"

        if intent == "knowledge":
            # 지식 질문: 플로우 상세 생략, 노드 수만 전달하여 토큰 절약
            node_count = len(req.currentNodes)
            prompt = (
                f"{ctx_lines}\n"
                f"현재 플로우: 노드 {node_count}개\n"
                f"최근 대화:\n{history_block}\n"
                f"질문: {req.message}"
            )
        else:
            fd = describe_flow(req.currentNodes, req.currentEdges)
            prompt = (
                f"{ctx_lines}\n"
                f"플로우:\n{fd}\n"
                f"대화 요약: {summary}\n"
                f"최근 대화:\n{history_block}\n"
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
    # 초기 가이드용이므로 요약 모드로 토큰 절약
    fd = describe_flow(req.currentNodes, req.currentEdges, summary=True)
    r = await call_llm(CONTEXTUAL_SUGGEST_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    return r or {"guidance": "", "quickQueries": []}


@app.post("/api/first-shape-welcome")
async def first_shape_welcome(req: ContextualSuggestRequest):
    process_name = req.context.get("processName", "HR 프로세스")
    process_type = req.context.get("l5", "프로세스")
    l345 = _build_l345_block(req.context) if isinstance(req.context, dict) else ""
    welcome_prompt = f"프로세스명: {process_name}\n프로세스 타입: {process_type}\n"
    if l345:
        welcome_prompt += f"\n{l345}\n"
    welcome_prompt += "\n사용자가 이 프로세스의 첫 번째 단계를 추가했습니다. 환영하고 격려해주세요."
    r = await call_llm(FIRST_SHAPE_SYSTEM, welcome_prompt)

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


@app.post("/api/categorize-nodes")
async def categorize_nodes(req: CategorizeNodesRequest):
    """ZBR 기준으로 노드의 카테고리 추천 (TO-BE 모드 전용)"""
    # Prepare node descriptions
    node_descriptions = []
    for n in req.nodes:
        if n.type in ("start", "end"):
            continue
        desc = f"- {n.label} (ID: {n.id}, 타입: {n.type})"
        if n.systemName:
            desc += f", 시스템: {n.systemName}"
        if n.duration:
            desc += f", 소요시간: {n.duration}"
        node_descriptions.append(desc)

    if not node_descriptions:
        return []

    prompt = f"""프로세스: {req.context.get('processName', 'Unknown')}
L4 모듈: {req.context.get('l4', 'Unknown')}
L5 단위업무: {req.context.get('l5', 'Unknown')}

[분류 대상 노드 목록]
{chr(10).join(node_descriptions)}

위 노드들을 ZBR 4가지 질문 기준으로 분류하고 JSON 배열로 반환하세요."""

    result = await call_llm(CATEGORIZE_PROMPT, prompt)

    # Fallback: 규칙 기반 분류
    if not result:
        fallback = []
        for n in req.nodes:
            if n.type in ("start", "end"):
                continue
            cat = "as_is"
            reasoning = "LLM 실패로 규칙 기반 분류"

            if any(k in n.label for k in ["조회", "입력", "추출", "집계", "계산", "전송"]):
                cat = "digital_worker"
                reasoning = "데이터 처리 작업으로 자동화 가능"
            elif any(k in n.label for k in ["통보", "안내", "발송", "접수", "정산"]):
                cat = "ssc_transfer"
                reasoning = "표준화 가능한 공통 업무"
            elif any(k in n.label for k in ["확인", "검토"]) and "승인" not in n.label:
                cat = "delete_target"
                reasoning = "형식적 확인 단계로 통합 또는 제거 검토"

            fallback.append({
                "nodeId": n.id,
                "suggestedCategory": cat,
                "confidence": "low",
                "reasoning": reasoning
            })
        return fallback

    return result


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
