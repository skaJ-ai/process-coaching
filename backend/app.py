"""HR Process Mining Tool - Backend (v5)"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import httpx, json, os, logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title="HR Process Mining v5")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://10.240.248.157:8533/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen3-Next")
# LLM_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"  # Gemini OpenAI compatible endpoint
# LLM_MODEL = "gemini-1.5-flash"
GEMINI_API_KEY = "AIzaSyBDxyMb9qgsiiCTQfmlm7CZFpCn6h4JOZc"
USE_MOCK = os.getenv("USE_MOCK", "auto")

class FlowNode(BaseModel):
    id: str; type: str; label: str; position: dict = Field(default_factory=lambda:{"x":0,"y":0})
    inputLabel: Optional[str] = None; outputLabel: Optional[str] = None; systemName: Optional[str] = None
    duration: Optional[str] = None; category: Optional[str] = None; swimLaneId: Optional[str] = None
class FlowEdge(BaseModel):
    id: str; source: str; target: str; label: Optional[str] = None
    sourceHandle: Optional[str] = None; targetHandle: Optional[str] = None
class ReviewRequest(BaseModel):
    currentNodes: list[FlowNode]; currentEdges: list[FlowEdge]; userMessage: str = ""; context: dict
class ChatRequest(BaseModel):
    message: str; context: dict; currentNodes: list[FlowNode] = []; currentEdges: list[FlowEdge] = []
class ValidateL7Request(BaseModel):
    nodeId: str; label: str; nodeType: str; context: dict; currentNodes: list[FlowNode] = []; currentEdges: list[FlowEdge] = []

class ContextualSuggestRequest(BaseModel):
    context: dict; currentNodes: list[FlowNode] = []; currentEdges: list[FlowEdge] = []

# Collaborative Coaching Tone Guidelines
COACHING_TONE = """
[어조 원칙]
- 제안형 표현 사용: "고려해 보세요", "~하면 어떨까요?", "~할 수 있어요"
- 절대적 표현 회피: "반드시", "금지", "must" 대신 "권장합니다", "더 명확할 수 있습니다"
- 공감 표현 포함: "이해합니다", "복잡할 수 있습니다"
- 이유 설명: 모든 제안에 "왜 중요한지", "어떤 이점이 있는지" 포함
- 조건형 언어: "~할 수 있습니다", "~일 수 있습니다"
- 질문형 제안: 가능한 경우 "~하는 것은 어떨까요?"
"""

L7_GUIDE = """[L7 작성 원칙]
제3자가 이해할 수 있도록:
- 명확한 주어와 목적어 포함을 권장합니다
- 하나의 화면 내 연속 동작은 1개 L7로 표현하면 좋습니다
- 판단 시 명확한 기준값을 포함하면 의사결정이 명확해집니다

[권장 동사]
조회한다, 입력한다, 수정한다, 저장한다, 추출한다, 비교한다, 집계한다,
기록한다, 첨부한다, 판정한다, 승인한다, 반려한다, 결정한다,
예외로 처리한다, 요청한다, 재요청한다, 안내한다, 공지한다, 에스컬레이션한다

[구체화가 필요한 동사]
처리한다, 진행한다, 관리한다, 대응한다, 지원한다, 개선한다, 최적화한다,
검토한다, 확인한다, 정리한다, 공유한다, 조율한다, 협의한다, 반영한다
→ 이러한 동사는 구체적인 행위로 바꾸면 더 명확해질 수 있습니다

참고: 시스템명은 라벨이 아닌 노드 메타데이터로 관리하면 깔끔합니다."""

def describe_flow(nodes, edges):
    if not nodes: return "플로우 비어있음."

    # ─── Flow Statistics ───
    node_types = {"start": 0, "end": 0, "process": 0, "decision": 0, "subprocess": 0}
    for n in nodes:
        if hasattr(n, 'data'):
            node_types[n.data.get('nodeType', 'process')] += 1
        elif hasattr(n, 'nodeType'):
            node_types[getattr(n, 'nodeType', 'process')] += 1
        else:
            node_types['process'] += 1

    total_nodes = len(nodes)
    total_edges = len(edges)
    has_swim_lanes = any(getattr(n, 'swimLaneId', None) or (hasattr(n, 'data') and n.data.get('swimLaneId')) for n in nodes)

    # ─── Phase Detection ───
    if total_nodes <= 2:
        phase = "초기 단계"
    elif total_nodes <= 5 or not any(n_id for n_id, e in [(e['source'], e) for e in edges]
                                      for tgt in [e['target'] for e in edges]
                                      if node_types.get('end', 0) == 0):
        phase = "진행 중"
    else:
        phase = "완성 단계"

    # ─── Structural Analysis ───
    all_node_ids = {n.id if hasattr(n, 'id') else getattr(n, 'id', None) for n in nodes}
    source_ids = {e['source'] if isinstance(e, dict) else e.source for e in edges}
    target_ids = {e['target'] if isinstance(e, dict) else e.target for e in edges}

    orphan_count = len(all_node_ids - source_ids - target_ids)
    orphan_nodes = list(all_node_ids - source_ids - target_ids)

    has_start = node_types.get('start', 0) > 0
    has_end = node_types.get('end', 0) > 0
    start_connected = any(e.get('source') if isinstance(e, dict) else e.source
                         for n in nodes
                         if (getattr(n, 'nodeType', None) or (hasattr(n, 'data') and n.data.get('nodeType'))) == 'start'
                         for e in edges)

    disconnected_ends = [(n.id if hasattr(n, 'id') else None) for n in nodes
                         if (getattr(n, 'nodeType', None) or (hasattr(n, 'data') and n.data.get('nodeType'))) == 'end'
                         and (n.id if hasattr(n, 'id') else None) not in target_ids]

    # ─── HR Process Checkpoints ───
    hr_keywords = {'승인': 0, '결재': 0, '예외': 0, '검토': 0, '판정': 0, '요청': 0}
    for n in nodes:
        label = getattr(n, 'label', '') or (n.data.get('label', '') if hasattr(n, 'data') else '')
        for kw in hr_keywords:
            if kw in label:
                hr_keywords[kw] += 1

    has_hr_checkpoints = any(v > 0 for v in hr_keywords.values())
    hr_coverage = ", ".join([f"{kw}({v}건)" for kw, v in hr_keywords.items() if v > 0]) or "없음"

    # ─── Generate Rich Description ───
    lines = [
        f"[플로우 통계] 총 {total_nodes}개 노드, {total_edges}개 연결",
        f"  구성: 시작({node_types['start']}) > 태스크({node_types['process']}) / 분기({node_types['decision']}) / 하위공정({node_types['subprocess']}) > 종료({node_types['end']})",
        f"  수영레인: {'사용 중' if has_swim_lanes else '미사용'}",
        f"[진행도] {phase}",
        f"[구조 상태] 시작({has_start}), 종료({has_end}), 고아({orphan_count}), 연결율({100*total_edges//max(total_nodes-1,1)}%)",
    ]

    if orphan_count > 0:
        lines.append(f"  ⚠ {orphan_count}개 연결안됨: {orphan_nodes}")
    if not has_end:
        lines.append(f"  ⚠ 종료 노드 없음")
    if disconnected_ends:
        lines.append(f"  ⚠ {len(disconnected_ends)}개 종료 노드 연결 안됨")

    lines.append(f"[HR 프로세스 요소] {hr_coverage}")
    lines.append("")
    lines.append("노드 목록:")

    for n in nodes:
        node_id = n.id if hasattr(n, 'id') else getattr(n, 'id', '?')
        node_type = getattr(n, 'nodeType', None) or (n.data.get('nodeType') if hasattr(n, 'data') else 'process')
        label = getattr(n, 'label', '') or (n.data.get('label', '') if hasattr(n, 'data') else '')
        t = {"process":"태스크","decision":"분기","subprocess":"하위공정","start":"시작","end":"종료"}.get(node_type, node_type)

        meta = ""
        if hasattr(n, 'systemName') and n.systemName:
            meta += f" [SYS:{n.systemName}]"
        elif hasattr(n, 'data') and n.data.get('systemName'):
            meta += f" [SYS:{n.data.get('systemName')}]"

        if hasattr(n, 'duration') and n.duration:
            meta += f" [⏱{n.duration}]"
        elif hasattr(n, 'data') and n.data.get('duration'):
            meta += f" [⏱{n.data.get('duration')}]"

        category = getattr(n, 'category', None) or (n.data.get('category') if hasattr(n, 'data') else None)
        if category and category != "as_is":
            meta += f" <{category}>"

        swimlane = getattr(n, 'swimLaneId', None) or (n.data.get('swimLaneId') if hasattr(n, 'data') else None)
        if swimlane:
            meta += f" [레인:{swimlane}]"

        lines.append(f"  [{node_id}] ({t}) {label}{meta}")

    lines.append("연결 구조:")
    for e in edges:
        source = e['source'] if isinstance(e, dict) else e.source
        target = e['target'] if isinstance(e, dict) else e.target
        label = e.get('label', '') if isinstance(e, dict) else (e.label if hasattr(e, 'label') else '')
        lines.append(f"  {source} → {target}{f' [{label}]' if label else ''}")

    return "\n".join(lines)

_llm_available: Optional[bool] = None
async def check_llm():
    global _llm_available
    if USE_MOCK == "true": _llm_available = False; return False
    if USE_MOCK == "false": _llm_available = True; return True
    if _llm_available is not None: return _llm_available
    try:
        headers = {"Authorization": f"Bearer {GEMINI_API_KEY}"} if "googleapis.com" in LLM_BASE_URL else None
        async with httpx.AsyncClient(timeout=5.0) as c: 
            r = await c.get(f"{LLM_BASE_URL}/models", headers=headers)
            if r.status_code != 200: logger.error(f"LLM check failed: {r.status_code} {r.text}")
            _llm_available = r.status_code == 200
    except Exception as e: logger.error(f"LLM check error: {e}"); _llm_available = False
    return _llm_available

async def call_llm(system_prompt, user_message):
    if not await check_llm(): return None
    try:
        headers = {"Authorization": f"Bearer {GEMINI_API_KEY}"} if "googleapis.com" in LLM_BASE_URL else None
        async with httpx.AsyncClient(timeout=None) as c:
            r = await c.post(f"{LLM_BASE_URL}/chat/completions", json={"model": LLM_MODEL, "messages": [{"role":"system","content":system_prompt},{"role":"user","content":user_message}], "temperature": 0.7, "max_tokens": 2000}, headers=headers)
            r.raise_for_status(); content = r.json()["choices"][0]["message"]["content"]
            if "<think>" in content: content = content.split("</think>")[-1]
            if "```json" in content: content = content.split("```json")[1].split("```")[0]
            elif "```" in content: content = content.split("```")[1].split("```")[0]
            return json.loads(content.strip())
    except Exception as e: logger.error(f"LLM error: {e}"); return None

REVIEW_SYSTEM = f"""당신은 HR 프로세스 설계를 돕는 협력적 코치입니다.

{COACHING_TONE}
{L7_GUIDE}

역할: 플로우를 분석하고 개선 아이디어를 제안합니다. 명령이 아닌 제안으로 표현하세요.

응답 형식 (JSON):
{{
  "speech": "분석 결과를 친근하게 요약 (예: '좋은 시작입니다! 몇 가지 고려사항을 공유드릴게요')",
  "suggestions": [
    {{
      "action": "ADD|MODIFY|DELETE",
      "summary": "제안 내용",
      "reason": "왜 이것이 도움이 되는지 구체적 이유. '~하면 더 명확해질 수 있습니다' 형태",
      "confidence": "high|medium|low",
      ...
    }}
  ],
  "quickQueries": ["후속 질문1", "후속 질문2"]
}}

중요: 모든 제안은 제안형 어조로 작성하세요 (예: "추가하면 좋을 것 같아요", "고려해 보시겠어요?").
"""

COACH_TEMPLATE = f"""당신은 HR 프로세스 설계를 함께 만들어가는 코치입니다.

{COACHING_TONE}
{L7_GUIDE}

역할: 사용자 질문에 공감하며 답변하고, 구체적 개선 방향을 제안합니다.

응답 형식 (JSON):
{{
  "speech": "공감하며 답변 (예: '좋은 질문입니다. 이런 관점에서 생각해볼 수 있어요')",
  "suggestions": [...],
  "quickQueries": ["다음으로 확인할 질문2~3개"]
}}

중요:
- 모든 문장을 제안형으로 ("~하면 어떨까요?", "~를 고려해보세요")
- 부정적 표현 회피 ("문제", "틀렸다" 대신 "개선 기회", "더 나은 방법")
"""

L7_VALIDATE = f"""당신은 L7 작성을 돕는 품질 코치입니다.

{COACHING_TONE}
{L7_GUIDE}

역할: L7 라벨을 검토하고 개선 방향을 제안합니다. 비판이 아닌 코칭으로 접근하세요.

응답 형식 (JSON):
{{
  "pass": true/false,
  "score": 0-100,
  "confidence": "high|medium|low",
  "issues": [
    {{
      "ruleId": "R-XX",
      "severity": "reject|warning",
      "friendlyTag": "간단한 태그 (예: '구체화 권장')",
      "message": "제안형 메시지 (예: '더 구체적인 동사를 사용하면 명확해질 수 있어요')",
      "suggestion": "개선 방향",
      "reasoning": "왜 이 개선이 도움되는지"
    }}
  ],
  "rewriteSuggestion": "개선된 라벨 제안",
  "encouragement": "긍정적 피드백 (예: '좋은 방향입니다! 조금만 더 구체화하면 완벽해요')"
}}

중요: "금지", "틀렸다" 같은 부정 표현 금지. 항상 개선의 이유와 이점 설명.
"""

CONTEXTUAL_SUGGEST_SYSTEM = f"""당신은 조용히 지켜보다가 필요한 순간 한마디 건네는 사려깊은 코치입니다.

{COACHING_TONE}
{L7_GUIDE}

역할: 현재 플로우를 보고 빠진 단계나 예외를 짧고 부드럽게 짚어줍니다.

응답 형식 (JSON만):
{{
  "guidance": "한 줄 제안 (예: '예외 처리 단계를 추가하면 더 완벽해질 것 같아요')",
  "tone": "gentle",
  "quickQueries": ["궁금할만한 질문1", "질문2"]
}}

중요: 너무 빈번하거나 강압적이지 않게. 작업 중단을 최소화.
"""

FIRST_SHAPE_SYSTEM = f"""당신은 HR 프로세스 설계를 처음 시작하는 사용자를 환영하고 격려하는 친절한 코치입니다.

{COACHING_TONE}

역할: 첫 번째 프로세스 단계를 추가한 사용자에게:
1. 따뜻한 환영 인사
2. 해당 프로세스의 일반적인 흐름을 제시
3. 고려할 사항(예: 예외 처리, 승인 분기)
4. 다음 단계에 대한 포괄적인 제안

응답 형식 (JSON):
{{
  "greeting": "환영 인사 (예: '좋은 시작입니다! 함께 프로세스를 완성해보겠습니다')",
  "processFlowExample": "일반적인 프로세스 흐름 (→로 단계를 연결)",
  "guidanceText": "이 프로세스에서 고려할 점들을 포함한 친절한 설명 (2-3문장)",
  "quickQueries": ["후속 질문1", "후속 질문2", "후속 질문3"]
}}

중요: 모든 표현을 제안형 어조로 작성하세요.
"""

PDD_ANALYSIS = """당신은 HR 프로세스 자동화 전문가입니다. 각 태스크를 분석하여 카테고리를 추천하세요.\n응답(JSON만): {"recommendations":[{"nodeId":"...","nodeLabel":"...","suggestedCategory":"...","reason":"...","confidence":"high|medium|low"}],"summary":"전체 요약"}"""


def mock_validate(label):
    """Mock L7 validation with gentle, suggestive feedback"""
    need_specificity = ["처리한다","진행한다","관리한다","확인한다","검토한다"]
    issues = []

    for v in need_specificity:
        if v in label:
            issues.append({
                "ruleId": "R-03",
                "severity": "warning",
                "friendlyTag": "구체화 권장",
                "message": f"'{v}' 대신 더 구체적인 동사를 사용하면 명확해질 수 있어요",
                "suggestion": "예: 조회한다, 입력한다, 저장한다, 승인한다 등",
                "reasoning": "구체적 동사는 제3자가 정확히 이해할 수 있도록 도와줍니다"
            })

    if not label.strip().endswith("다") and not label.strip().endswith("다."):
        issues.append({
            "ruleId": "R-15",
            "severity": "warning",
            "friendlyTag": "표준 형식",
            "message": "'~한다' 형태로 마무리하면 일관성이 좋아집니다",
            "suggestion": "동사형 어미 사용을 권장드려요",
            "reasoning": "표준 형식은 플로우 전체의 가독성을 높입니다"
        })

    has_critical = len([i for i in issues if i["severity"] == "reject"]) == 0
    score = 90 if has_critical and not issues else 70 if has_critical else 50
    encouragement = "잘 작성하셨어요!" if not issues else "좋은 시작입니다. 조금만 더 다듬으면 완벽해요!"

    return {
        "pass": has_critical,
        "score": score,
        "confidence": "medium",
        "issues": issues,
        "rewriteSuggestion": None,
        "encouragement": encouragement
    }

def mock_quick_queries(nodes, edges):
    """Generate follow-up questions in suggestive tone"""
    qs = []
    pn = [n for n in nodes if n.type=="process"]
    dn = [n for n in nodes if n.type=="decision"]

    if not any(n.type=="end" for n in nodes) and len(pn)>=2:
        qs.append("어떤 상황에서 이 프로세스가 완료되나요?")

    if not dn and len(pn)>=3:
        qs.append("중간에 판단이나 승인이 필요한 지점이 있을까요?")

    if len(pn)>=2:
        qs.append("예외적으로 처리해야 하는 상황은 어떤 것들이 있을까요?")

    if any(n.systemName for n in nodes):
        qs.append("시스템 간 데이터 연계는 어떻게 이루어지나요?")

    return qs[:3]

def mock_review(nodes, edges):
    """Mock flow review with encouraging, suggestive tone"""
    suggestions = []
    end_nodes = [n for n in nodes if n.type == 'end']

    if not end_nodes:
        suggestions.append({
            "action": "ADD",
            "type": "END",
            "summary": "종료 노드 추가",
            "reason": "플로우의 끝을 명확히 표시하면 완결성이 높아집니다",
            "reasoning": "프로세스의 시작과 끝이 명확하면 제3자가 전체 범위를 이해하기 쉬워집니다. HR 프로세스에서는 특히 완료 조건(예: 결과 저장, 알림)을 명시하는 것이 중요합니다.",
            "confidence": "high",
            "newLabel": "종료"
        })

    orphans = [n for n in nodes if n.type not in ('start','end') and not any(e.source == n.id or e.target == n.id for e in edges)]
    if orphans:
        suggestions.append({
            "action": "MODIFY",
            "summary": f"연결되지 않은 노드 {len(orphans)}개 발견",
            "reason": "모든 단계를 연결하면 플로우가 더 명확해집니다",
            "reasoning": f"독립적으로 떠있는 노드는 실행 순서가 불명확합니다. 어느 단계 이후에 수행되는지, 또는 병렬로 진행되는지를 표현하면 운영 효율성이 높아집니다.",
            "confidence": "high"
        })

    decisions = [n for n in nodes if n.type == 'decision']
    if not decisions and len(nodes) > 5:
        suggestions.append({
            "action": "ADD",
            "type": "DECISION",
            "summary": "분기점 추가 고려",
            "reason": "승인/반려 같은 판단 지점을 추가하면 실제 프로세스에 더 가까워집니다",
            "reasoning": "HR 프로세스는 대부분 조건부 분기를 포함합니다(예: 조건 검토 → 승인/반려 결정). 5개 이상의 단계가 있는데 분기가 없다면, 예외 처리나 검토 프로세스를 추가하는 것이 좋습니다.",
            "confidence": "medium"
        })

    # Positive framing
    tone = "긍정적" if len(suggestions) < 2 else "건설적"
    speech = f"총 {len(nodes)}개 단계로 잘 구성되셨네요! " if len(nodes) > 2 else "좋은 시작입니다! "

    if suggestions:
        speech += f"{len(suggestions)}가지 개선 아이디어를 공유드릴게요."
    else:
        speech += "구조적으로 탄탄합니다. 세부 내용을 다듬어가시면 됩니다!"

    return {
        "speech": speech,
        "suggestions": suggestions,
        "quickQueries": mock_quick_queries(nodes, edges),
        "tone": tone
    }

@app.post("/api/review")
async def review_flow(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(REVIEW_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    return r or mock_review(req.currentNodes, req.currentEdges)

@app.post("/api/chat")
async def chat(req: ChatRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(COACH_TEMPLATE, f"컨텍스트: {req.context}\n플로우:\n{fd}\n질문: {req.message}")
    return r or {"speech":"AI 연결 상태가 원활하지 않아 답변을 드릴 수 없습니다. 관리자에게 문의하거나 잠시 후 다시 시도해주세요.","suggestions":[],"quickQueries":[]}

@app.post("/api/validate-l7")
async def validate_l7(req: ValidateL7Request):
    r = await call_llm(L7_VALIDATE, f"노드: [{req.nodeId}] {req.nodeType}\nL7: \"{req.label}\"\n컨텍스트: {req.context}")
    return r or mock_validate(req.label)



@app.post("/api/contextual-suggest")
async def contextual_suggest(req: ContextualSuggestRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(CONTEXTUAL_SUGGEST_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    return r or {"guidance":"","quickQueries":[]}

@app.post("/api/first-shape-welcome")
async def first_shape_welcome(req: ContextualSuggestRequest):
    process_name = req.context.get("processName", "HR 프로세스")
    process_type = req.context.get("l5", "프로세스")
    r = await call_llm(FIRST_SHAPE_SYSTEM, f"프로세스명: {process_name}\n프로세스 타입: {process_type}\n\n사용자가 이 프로세스의 첫 번째 단계를 추가했습니다. 환영하고 격려해주세요.")

    if r:
        return {
            "text": f"👋 {r.get('greeting', '')}\n\n{r.get('processFlowExample', '')}\n\n{r.get('guidanceText', '')}",
            "quickQueries": r.get('quickQueries', [])
        }
    return {
        "text": f"👋 좋은 시작입니다! \"{process_name}\" 프로세스를 함께 완성해보겠습니다.",
        "quickQueries": ["일반적인 단계는 뭐가 있나요?", "어떤 분기점이 필요할까요?"]
    }

@app.post("/api/analyze-pdd")
async def analyze_pdd(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(PDD_ANALYSIS, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    if r: return r
    recs = []
    for n in req.currentNodes:
        if n.type in ('start','end'): continue
        cat = 'as_is'
        if any(k in n.label for k in ['조회','입력','추출','집계']): cat = 'digital_worker'
        elif any(k in n.label for k in ['통보','안내','발송']): cat = 'ssc_transfer'
        recs.append({"nodeId":n.id,"nodeLabel":n.label,"suggestedCategory":cat,"reason":"규칙 기반","confidence":"low"})
    return {"recommendations":recs,"summary":"규칙 기반 자동 분류입니다."}

@app.get("/api/health")
async def health():
    llm = await check_llm()
    return {"status":"ok","version":"5.0","llm_connected":llm,"mode":"live" if llm else "mock"}

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except SystemExit:
        logger.warning("Port 8000 is busy. Trying port 8002...")
        uvicorn.run(app, host="0.0.0.0", port=8002)
