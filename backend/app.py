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
class InterviewRequest(BaseModel):
    step: int; answer: str; context: dict; currentNodes: list[FlowNode] = []; currentEdges: list[FlowEdge] = []
class ContextualSuggestRequest(BaseModel):
    context: dict; currentNodes: list[FlowNode] = []; currentEdges: list[FlowEdge] = []

L7_GUIDE = """[L7 작성 원칙]
- 제3자가 설명만 보고 수행 가능해야 함
- (주어) + 목적어 + 동사 형태
- 하나의 화면 내 연속 동작 = 1개 L7
- 판단 시 명확한 기준값 포함
[표준 동사] 조회한다, 입력한다, 수정한다, 저장한다, 추출한다, 비교한다, 집계한다, 기록한다, 첨부한다, 판정한다, 승인한다, 반려한다, 결정한다, 예외로 처리한다, 요청한다, 재요청한다, 안내한다, 공지한다, 에스컬레이션한다
[금지 동사] 처리한다, 진행한다, 관리한다, 대응한다, 지원한다, 개선한다, 최적화한다, 검토한다, 확인한다, 정리한다, 공유한다, 조율한다, 협의한다, 반영한다"""

def describe_flow(nodes, edges):
    if not nodes: return "플로우 비어있음."
    lines = ["노드:"]
    for n in nodes:
        t = {"process":"태스크","decision":"분기","subprocess":"하위공정","start":"시작","end":"종료"}.get(n.type, n.type)
        meta = ""
        if n.systemName: meta += f" [SYS:{n.systemName}]"
        if n.duration: meta += f" [⏱{n.duration}]"
        if n.category and n.category != "as_is": meta += f" <{n.category}>"
        if n.swimLaneId: meta += f" [레인:{n.swimLaneId}]"
        lines.append(f"  [{n.id}] ({t}) {n.label}{meta}")
    lines.append("연결:")
    for e in edges: lines.append(f"  {e.source} → {e.target}{f' [{e.label}]' if e.label else ''}")
    return "\n".join(lines)

_llm_available: Optional[bool] = None
async def check_llm():
    global _llm_available
    if USE_MOCK == "true": _llm_available = False; return False
    if USE_MOCK == "false": _llm_available = True; return True
    if _llm_available is not None: return _llm_available
    try:
        async with httpx.AsyncClient(timeout=5.0) as c: r = await c.get(f"{LLM_BASE_URL}/models"); _llm_available = r.status_code == 200
    except: _llm_available = False
    return _llm_available

async def call_llm(system_prompt, user_message):
    if not await check_llm(): return None
    try:
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post(f"{LLM_BASE_URL}/chat/completions", json={"model": LLM_MODEL, "messages": [{"role":"system","content":system_prompt},{"role":"user","content":user_message}], "temperature": 0.7, "max_tokens": 2000})
            r.raise_for_status(); content = r.json()["choices"][0]["message"]["content"]
            if "<think>" in content: content = content.split("</think>")[-1]
            if "```json" in content: content = content.split("```json")[1].split("```")[0]
            elif "```" in content: content = content.split("```")[1].split("```")[0]
            return json.loads(content.strip())
    except Exception as e: logger.error(f"LLM error: {e}"); return None

REVIEW_SYSTEM = f"당신은 HR 프로세스 분석 전문가입니다.\n{L7_GUIDE}\n응답은 JSON: {{\"speech\":\"...\",\"suggestions\":[...],\"followUpQuestions\":[\"질문1\",\"질문2\"]}}\nfollowUpQuestions: 사용자가 추가로 궁금할 수 있는 후속 질문 2~3개"
COACH_TEMPLATE = f"당신은 HR 프로세스 설계 코치입니다.\n{L7_GUIDE}\n응답은 JSON: {{\"speech\":\"...\",\"suggestions\":[...],\"followUpQuestions\":[\"질문1\",\"질문2\"]}}\nfollowUpQuestions: 현재 플로우에서 다음으로 확인할 질문 2~3개"
L7_VALIDATE = f"당신은 L7 품질 검증 에이전트입니다.\n{L7_GUIDE}\n응답은 JSON: {{\"pass\":bool,\"score\":0-100,\"issues\":[...],\"rewriteSuggestion\":\"...\"}}"
INTERVIEW_SYSTEM = f"""당신은 HR 프로세스 인터뷰어입니다.\n{L7_GUIDE}\n응답(JSON만): {{"newNodes":[{{"label":"L7문장","type":"PROCESS|DECISION|SUBPROCESS","insertAfterNodeId":"..."}}],"nextQuestion":"다음질문","complete":false,"suggestions":[],"followUpQuestions":["질문1"]}}"""
CONTEXTUAL_SUGGEST_SYSTEM = f"""당신은 HR 프로세스 설계 코치입니다. 현재 플로우를 보고 빠진 단계나 예외를 짧게 짚어주세요.\n응답(JSON만): {{"hint":"한줄요약","followUpQuestions":["질문1","질문2"]}}"""
PDD_ANALYSIS = """당신은 HR 프로세스 자동화 전문가입니다. 각 태스크를 분석하여 카테고리를 추천하세요.\n응답(JSON만): {"recommendations":[{"nodeId":"...","nodeLabel":"...","suggestedCategory":"...","reason":"...","confidence":"high|medium|low"}],"summary":"전체 요약"}"""
INTERVIEW_QUESTIONS = ["이 업무를 시작하게 되는 트리거는?","첫 번째 행동은?","그 다음 단계는?","판단/분기 필요한 지점?","계속 말씀해 주세요.","예외 케이스?","최종 결과물/종료 상태는?"]

def mock_validate(label):
    banned = ["처리한다","진행한다","관리한다","확인한다","검토한다"]
    issues = [{"ruleId":"R-03","severity":"reject","friendlyTag":"금지 동사","message":f"'{v}'는 금지 동사","suggestion":"구체적 행위 동사로 변경"} for v in banned if v in label]
    if not label.strip().endswith("다") and not label.strip().endswith("다."):
        issues.append({"ruleId":"R-15","severity":"warning","friendlyTag":"비표준 동사","message":"'~한다' 형태로 끝나야 함","suggestion":"동사형 어미로 마무리"})
    p = len([i for i in issues if i["severity"]=="reject"])==0
    return {"pass":p,"score":90 if p and not issues else 60 if p else 40,"issues":issues,"rewriteSuggestion":None}

def mock_followup(nodes, edges):
    qs = []
    pn = [n for n in nodes if n.type=="process"]; dn = [n for n in nodes if n.type=="decision"]
    if not any(n.type=="end" for n in nodes) and len(pn)>=2: qs.append("종료 조건은 무엇인가요?")
    if not dn and len(pn)>=3: qs.append("중간에 판단/분기가 필요한 지점이 있나요?")
    if len(pn)>=2: qs.append("예외적으로 처리해야 하는 케이스가 있나요?")
    return qs[:3]

@app.post("/api/review")
async def review_flow(req: ReviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(REVIEW_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    return r or {"speech":"플로우를 살펴보았습니다.","suggestions":[],"followUpQuestions":mock_followup(req.currentNodes,req.currentEdges)}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(COACH_TEMPLATE, f"컨텍스트: {req.context}\n플로우:\n{fd}\n질문: {req.message}")
    return r or {"speech":"일반적으로 요청접수→서류검토→승인/반려→결과통보 순서입니다.","suggestions":[],"followUpQuestions":mock_followup(req.currentNodes,req.currentEdges)}

@app.post("/api/validate-l7")
async def validate_l7(req: ValidateL7Request):
    r = await call_llm(L7_VALIDATE, f"노드: [{req.nodeId}] {req.nodeType}\nL7: \"{req.label}\"\n컨텍스트: {req.context}")
    return r or mock_validate(req.label)

@app.post("/api/interview")
async def interview(req: InterviewRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    non_end = [n for n in req.currentNodes if n.type != "end"]
    last_id = non_end[-1].id if non_end else "start"
    r = await call_llm(INTERVIEW_SYSTEM, f"단계:{req.step}\n컨텍스트:{req.context}\n플로우:\n{fd}\n마지막노드:{last_id}\n답변:\"{req.answer}\"")
    if r: return r
    return {"newNodes":[{"label":req.answer,"type":"PROCESS","insertAfterNodeId":last_id}],
      "nextQuestion":INTERVIEW_QUESTIONS[min(req.step+1,len(INTERVIEW_QUESTIONS)-1)] if req.step<len(INTERVIEW_QUESTIONS)-1 else "추가할 단계가 있으면 말씀해주세요.",
      "complete":req.step>=len(INTERVIEW_QUESTIONS)-1,"suggestions":[],"followUpQuestions":mock_followup(req.currentNodes,req.currentEdges)}

@app.post("/api/contextual-suggest")
async def contextual_suggest(req: ContextualSuggestRequest):
    fd = describe_flow(req.currentNodes, req.currentEdges)
    r = await call_llm(CONTEXTUAL_SUGGEST_SYSTEM, f"컨텍스트: {req.context}\n플로우:\n{fd}")
    return r or {"hint":"","followUpQuestions":mock_followup(req.currentNodes,req.currentEdges)}

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
    import uvicorn; uvicorn.run(app, host="0.0.0.0", port=8000)
