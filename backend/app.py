"""HR Process Mining Tool - Backend (v5)"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
import logging
import time

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
    error_msg = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    return JSONResponse(
        status_code=500,
        content={"message": error_msg, "speech": error_msg, "suggestions": [], "quickQueries": []},
    )

try:
    from .schemas import ReviewRequest, ChatRequest, ValidateL7Request, ContextualSuggestRequest, CategorizeNodesRequest
    from .llm_service import check_llm, call_llm, close_http_client, get_llm_debug_status
    from .chat_orchestrator import orchestrate_chat, get_chain_status, _classify_intent
    from .prompt_templates import REVIEW_SYSTEM, COACH_TEMPLATE, CONTEXTUAL_SUGGEST_SYSTEM, FIRST_SHAPE_SYSTEM, PDD_ANALYSIS, PDD_INSIGHTS_SYSTEM, KNOWLEDGE_PROMPT, CATEGORIZE_PROMPT, INTERVIEW_START_SYSTEM, FLOW_OVERVIEW_SYSTEM
    from .flow_services import describe_flow, mock_review, mock_validate
    from .l345_reference import get_l345_context
except ImportError:
    from schemas import ReviewRequest, ChatRequest, ValidateL7Request, ContextualSuggestRequest, CategorizeNodesRequest
    from llm_service import check_llm, call_llm, close_http_client, get_llm_debug_status
    from chat_orchestrator import orchestrate_chat, get_chain_status, _classify_intent
    from prompt_templates import REVIEW_SYSTEM, COACH_TEMPLATE, CONTEXTUAL_SUGGEST_SYSTEM, FIRST_SHAPE_SYSTEM, PDD_ANALYSIS, PDD_INSIGHTS_SYSTEM, KNOWLEDGE_PROMPT, CATEGORIZE_PROMPT, INTERVIEW_START_SYSTEM, FLOW_OVERVIEW_SYSTEM
    from flow_services import describe_flow, mock_review, mock_validate
    from l345_reference import get_l345_context


# ── 인터뷰 응답 TTL 캐시 (동일 컨텍스트 반복 호출 방지, TTL=5분) ──
_INTERVIEW_CACHE: dict[str, tuple[float, dict]] = {}
_INTERVIEW_CACHE_TTL = 300  # seconds


def _interview_cache_key(context: dict, start_label: str = "", end_label: str = "") -> str:
    base = f"{context.get('l4','')}/{context.get('l5','')}/{context.get('processName','')}".lower()
    _defaults = {"시작", "시작 노드", "종료", "종료 노드", "start", "end", ""}
    if start_label.strip() not in _defaults:
        base += f"/{start_label.strip()}".lower()
    if end_label.strip() not in _defaults:
        base += f"/{end_label.strip()}".lower()
    return base


def _get_interview_cache(key: str) -> Optional[dict]:
    entry = _INTERVIEW_CACHE.get(key)
    if entry and (time.time() - entry[0]) < _INTERVIEW_CACHE_TTL:
        return entry[1]
    if key in _INTERVIEW_CACHE:
        del _INTERVIEW_CACHE[key]
    return None


def _set_interview_cache(key: str, value: dict) -> None:
    _INTERVIEW_CACHE[key] = (time.time(), value)


def _calc_flow_metrics(nodes, edges) -> dict:
    """플로우 품질 메트릭 계산. contextual-suggest 진단 블록에 사용."""
    total = len(nodes)
    decision_count = sum(1 for n in nodes if n.type == "decision")
    node_ids = {n.id for n in nodes}
    connected = {e.source for e in edges} | {e.target for e in edges}
    orphan_count = len(node_ids - connected)
    decision_ratio = round(decision_count / total, 2) if total > 0 else 0.0
    return {
        "total": total,
        "decision_count": decision_count,
        "decision_ratio": decision_ratio,
        "orphan_count": orphan_count,
    }


_LANE_DEFAULTS = {"A 주체", "B 주체", "C 주체", "D 주체", ""}
_SCOPE_DEFAULTS = {"시작", "시작 노드", "종료", "종료 노드", "start", "end", ""}


def _append_actor_scope(ctx_lines: str, nodes, swim_lane_labels: list[str]) -> str:
    """스윔레인 역할명 + 시작/종료 노드 범위를 ctx_lines에 추가."""
    extras = []

    custom_labels = [l for l in swim_lane_labels if l.strip() and l.strip() not in _LANE_DEFAULTS]
    if custom_labels:
        extras.append(f"[역할]\n주체: {', '.join(custom_labels)}")

    start_label = next((n.label for n in nodes if n.type == "start"), "")
    end_label = next((n.label for n in nodes if n.type == "end"), "")
    scope_parts = []
    if start_label.strip() not in _SCOPE_DEFAULTS:
        scope_parts.append(f"시작: {start_label}")
    if end_label.strip() not in _SCOPE_DEFAULTS:
        scope_parts.append(f"종료: {end_label}")
    if scope_parts:
        extras.append("[범위]\n" + "\n".join(scope_parts))

    if extras:
        return ctx_lines + "\n" + "\n".join(extras) + "\n"
    return ctx_lines


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
    ctx_block = _append_actor_scope(ctx_block, req.currentNodes, req.swimLaneLabels)
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
    r = await call_llm(PDD_INSIGHTS_SYSTEM, f"{pdd_ctx}플로우:\n{fd}", max_tokens=1000, temperature=0.5)
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

        ctx_lines = _append_actor_scope(ctx_lines, req.currentNodes, req.swimLaneLabels)

        if intent == "flow_overview":
            process_name = req.context.get("processName", "이 업무") if isinstance(req.context, dict) else "이 업무"
            start_label = next((n.label for n in req.currentNodes if n.type == "start"), "시작")
            end_label = next((n.label for n in req.currentNodes if n.type == "end"), "종료")
            ov_prompt = (
                f"{ctx_lines}\n"
                f"시작 노드: {start_label} / 종료 노드: {end_label}\n"
                f"현재 노드 수: {len(req.currentNodes)}개\n"
                f"\n질문: {req.message}"
            )
            _default_qq = [
                "첫 단계부터 같이 그려볼까요?",
                "예외 처리는 어떻게 표현하나요?",
                "어떤 분기점이 있을까요?",
            ]
            ov_r = await call_llm(FLOW_OVERVIEW_SYSTEM, ov_prompt, allow_text_fallback=True, max_tokens=700, temperature=0.4)
            ov_text = ""
            ov_qq = _default_qq
            if ov_r:
                if isinstance(ov_r, dict):
                    ov_text = ov_r.get("speech") or ov_r.get("message") or ov_r.get("text") or ov_r.get("content") or ""
                    ov_qq = ov_r.get("quickQueries") or _default_qq
                elif isinstance(ov_r, str):
                    ov_text = ov_r
            if not ov_text:
                ov_text = f"'{process_name}' 업무의 흐름에 대해 질문해 주시면 함께 생각해볼게요."
            return {
                "message": ov_text,
                "speech": ov_text,
                "suggestions": [],
                "quickQueries": ov_qq,
                "intent": "flow_overview",
                "source": "llm" if ov_r else "fallback",
                "fallbackLevel": 0,
            }
        elif intent == "knowledge":
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
        error_msg = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        return {"message": error_msg, "speech": error_msg, "suggestions": [], "quickQueries": []}


@app.post("/api/validate-l7")
async def validate_l7(req: ValidateL7Request):
    # Phase 1: 실시간 L7 판정은 프론트 룰 엔진에서 처리.
    # 백엔드 validate-l7는 저장/배치/호환 용도로 룰 기반 결과만 반환.
    return mock_validate(req.label, req.nodeType, llm_failed=False)


@app.post("/api/contextual-suggest")
async def contextual_suggest(req: ContextualSuggestRequest):
    # 초기 가이드용이므로 요약 모드로 토큰 절약
    fd = describe_flow(req.currentNodes, req.currentEdges, summary=True)

    # 플로우 품질 메트릭 계산 → 이슈 있을 때만 진단 블록 삽입
    m = _calc_flow_metrics(req.currentNodes, req.currentEdges)
    diag_lines = []
    if m["total"] >= 5 and m["decision_ratio"] < 0.1:
        diag_lines.append(f"Decision 부족: 노드 {m['total']}개 중 분기점 {m['decision_count']}개")
    if m["orphan_count"] > 0:
        diag_lines.append(f"독립 노드: {m['orphan_count']}개 (연결 없음)")
    diag_block = ("\n[플로우 진단]\n" + "\n".join(diag_lines) + "\n") if diag_lines else ""

    r = await call_llm(CONTEXTUAL_SUGGEST_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}{diag_block}")
    if r:
        guidance = r.get("guidance", "")
        return {
            "message": guidance,  # 표준 필드
            "guidance": guidance,  # 하위 호환
            "quickQueries": r.get("quickQueries", [])
        }
    return {"message": "", "guidance": "", "quickQueries": []}


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
        text = f"👋 {r.get('greeting', '')}\n\n{r.get('processFlowExample', '')}\n\n{r.get('guidanceText', '')}"
        return {
            "message": text,
            "text": text,
            "suggestions": r.get("suggestions", []),
            "quickQueries": r.get("quickQueries", []),
        }
    text = f"👋 첫 단계가 추가되었네요! \"{process_name}\" 프로세스를 함께 완성해보겠습니다.\n\n다음에 이어질 단계를 추가하거나 아래 질문으로 흐름을 구체화해보세요."
    return {
        "message": text,
        "text": text,
        "suggestions": [],
        "quickQueries": ["다음 단계는 어떻게 되나요?", "어떤 분기점이 필요할까요?"],
    }


@app.post("/api/interview-start")
async def interview_start(req: ContextualSuggestRequest):
    """AI 인터뷰 시작: 4섹션 산문(FLOW_OVERVIEW_SYSTEM)으로 전체 흐름을 첫 버블에 바로 표시"""
    ctx = req.context if isinstance(req.context, dict) else {}
    process_name = ctx.get("processName", "HR 프로세스") or "HR 프로세스"
    l4 = ctx.get("l4", "")
    l5 = ctx.get("l5", "")

    start_label = next((n.label for n in req.currentNodes if n.type == "start"), "")
    end_label = next((n.label for n in req.currentNodes if n.type == "end"), "")

    cache_key = _interview_cache_key(ctx, start_label, end_label)
    cached = _get_interview_cache(cache_key)
    if cached:
        return cached

    l345 = _build_l345_block(ctx)
    ctx_lines = (
        f"[프로세스 컨텍스트]\n"
        f"L4: {l4 or '미설정'}\n"
        f"L5: {l5 or '미설정'}\n"
        f"L6(활동): {process_name}\n"
    )
    if l345:
        ctx_lines += f"\n{l345}\n"

    _scope_defaults = {"시작", "시작 노드", "종료", "종료 노드", "start", "end", ""}
    scope_hint = ""
    if start_label.strip() not in _scope_defaults:
        scope_hint += f"사용자 지정 시작 노드: '{start_label}'\n"
    if end_label.strip() not in _scope_defaults:
        scope_hint += f"사용자 지정 종료 노드: '{end_label}'\n"

    ov_prompt = f"{ctx_lines}{scope_hint}\n질문: {process_name}의 전체 흐름을 설명해주세요."

    _default_qq = [
        "첫 단계부터 같이 그려볼까요?",
        "예외 처리는 어떻게 표현하나요?",
        "어떤 분기점이 있을까요?",
    ]

    r = await call_llm(FLOW_OVERVIEW_SYSTEM, ov_prompt, allow_text_fallback=True, max_tokens=700, temperature=0.4)

    text = ""
    qq = _default_qq
    if r:
        if isinstance(r, dict):
            text = r.get("speech") or r.get("message") or r.get("text") or r.get("content") or ""
            qq = r.get("quickQueries") or _default_qq
        elif isinstance(r, str):
            text = r

    if not text:
        text = (
            f"▶ 이 업무의 범위\n'{process_name}' 업무의 흐름을 함께 그려봐요.\n\n"
            f"▶ 흐름의 줄기\n아직 참조 데이터가 없어요. 첫 단계부터 직접 알려주세요.\n\n"
            f"▶ 놓치기 쉬운 갈림길\n예외 상황이나 분기점을 함께 찾아볼게요.\n\n"
            f"▶ 다음으로 이어지는 것\n이 업무 이후 흐름은 진행하면서 파악해봐요."
        )

    result = {
        "message": text,
        "text": text,
        "suggestions": [],
        "quickQueries": qq,
    }
    _set_interview_cache(cache_key, result)
    return result


@app.post("/api/analyze-pdd")
async def analyze_pdd(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(PDD_ANALYSIS, f"컨텍스트: {req.context}\n플로우:\n{fd}", max_tokens=800, temperature=0.3)
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
                "category": cat,  # suggestedCategory → category
                "confidence": "low",
                "reasoning": reasoning
            })
        return {"categorizations": fallback}

    # LLM 응답을 프론트엔드 형식으로 변환
    if isinstance(result, list):
        # LLM이 배열로 반환한 경우: suggestedCategory → category
        normalized = [
            {
                "nodeId": item.get("nodeId"),
                "category": item.get("suggestedCategory") or item.get("category"),
                "confidence": item.get("confidence", "medium"),
                "reasoning": item.get("reasoning", "")
            }
            for item in result
            if item.get("nodeId")
        ]
        return {"categorizations": normalized}

    # LLM이 이미 올바른 형식으로 반환한 경우
    return result


@app.post("/api/suggest-phases")
async def suggest_phases(req: dict):
    """Phase AI 자동 추천 전용 엔드포인트.
    orchestrate_chat 를 거치지 않으므로 Circuit Breaker에 영향을 주지 않는다.
    Qwen3 등이 JSON 배열을 직접 반환해도 정상 처리.
    """
    context = req.get("context", {}) if isinstance(req, dict) else {}
    process_name = context.get("processName", "")
    l4 = context.get("l4", "")
    l5 = context.get("l5", "")

    system = "당신은 HR 업무 프로세스 전문가입니다. 요청한 형식(JSON 배열)으로만 응답하세요."
    prompt = (
        f'HR 업무 "{process_name}"(L4: {l4}, L5: {l5})의 내부를 논리적으로 3~4개 Phase로 분해해줘.\n\n'
        f'【중요 제약】이 L6 업무 자체의 내부 흐름만 Phase로 나눠야 해. '
        f'이 업무의 선행·후행에 해당하는 다른 L6(예: 신청접수, 결과통보 등)는 포함하지 마.\n\n'
        f'각 Phase 이름은 4~6글자 명사형(예: "심사기준파악", "서류검토", "합부판정"). '
        f'아래처럼 JSON 배열만 출력해 (설명 없이):\n["Phase1", "Phase2", "Phase3"]'
    )

    import json as _json
    try:
        result = await call_llm(system, prompt, allow_text_fallback=True, max_tokens=200, temperature=0.3)
    except Exception:
        logger.exception("/api/suggest-phases call_llm 실패")
        return {"text": ""}

    if result is None:
        return {"text": ""}
    # Qwen3 등이 JSON 배열을 직접 반환하는 경우
    if isinstance(result, list):
        return {"text": _json.dumps(result, ensure_ascii=False)}
    # dict 반환 (일반 LLM 응답)
    if isinstance(result, dict):
        for key in ("speech", "message", "text", "content"):
            v = result.get(key)
            if isinstance(v, str) and v.strip():
                return {"text": v}
        return {"text": ""}
    # 그 외 (str 등)
    return {"text": str(result) if result else ""}


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
