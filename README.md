# Process Coaching AI

**HR 담당자가 자신의 업무를 스스로 재설계하도록 돕는 L7 기반 프로세스 도식화 + AI 코칭 도구**

---

## 왜 이 도구인가

HR 담당자가 매일 하는 일 중, 정말 '나만이 할 수 있는 일'은 얼마나 되는가?

대부분의 HR 업무는 반복되고, 설명되고, 이관되고, 또 반복된다. 이 도구는 그 질문에 답하기 위해 만들어졌다.

**Zero-based Redesign(ZBR)** 관점에서, 전체 HR 워크플로우를 '한 동작' 단위(아토믹 액션)까지 분해하여 그린다. 그 목록을 펼쳐놓고 하나씩 묻는다:

- 이 동작, 반드시 내가 해야 하는가?
- 디지털 워커가 대신할 수 있는가?
- SSC에 이관할 수 있는가?
- 아예 없애도 되는 단계인가?

이 도구는 그 설계를 HR 담당자 스스로 할 수 있도록 돕는다. AI가 빠진 단계를 짚고, 표현이 모호하면 바로 알려주며, 막히면 대화로 보완해준다.

> 그림을 예쁘게 그리는 도구가 아니라, HR의 일하는 방식을 실행 가능한 구조로 바꾸는 도구다.

---

## 주요 기능

### 캔버스 편집
- 시작 / 종료 / 프로세스 / 판단 / L6 서브프로세스 노드
- 우클릭 컨텍스트 메뉴, 드래그 연결, 엣지 라벨 편집
- 스윔레인 (역할 구분선 ON/OFF, 레인 라벨, 최대 4레인)
- 실행 취소/되돌리기, 자동 저장, JSON 내보내기/가져오기

### L7 검증 (규칙 엔진)
- 노드별 실시간 검증 및 배치 검증
- Reject / Warning / Suggestion 3단계 심각도
- 이슈 태그, 개선 제안, rewrite 추천
- AI 서버가 꺼져 있어도 규칙 엔진은 항상 동작

### AI 코칭
- **전체 흐름 검토**: AS-IS 문서화 품질 기준으로 누락·모호한 단계 짚기
- **채팅 Q&A**: 언제든 질문하거나 다음 단계 아이디어 요청
- **맥락 제안**: 작업 중 조용히 한 줄 가이드 제공
- **첫 노드 환영**: 시작 단계에서 프로세스 구조 제안

**챗봇 맥락 인식 (2026-02-20 개선):**
- 대화 컨텍스트 확장: 최근 10턴 + 16턴 요약 (기존 4턴 + 8턴)
- 중복 제안 방지: 기존 노드 목록 확인 필수, 유사 제안 금지
- 자기 부정 방지: 과거 제안 내용 추적, quickQuery 맥락 인지
- 기존 노드 명시: describe_flow에 현재 라벨 목록 먼저 표시
- **AI 추가 노드 보호**: AI가 추가한 노드는 `[AI추가]` 표시, 재수정 제안 금지

### 품질 대시보드
- 구조 규칙(S)·라벨 규칙(R) 위반 현황 실시간 표시
- 이슈 클릭 시 해당 셰이프로 캔버스 이동
- 전체 흐름 검토 제안 카드에서 "위치 보기" → 직접 해당 노드로 이동

---

## 기술 스택

| 구분 | 기술 |
| :--- | :--- |
| Frontend | React 18, TypeScript, Vite 5, ReactFlow 11, Zustand, TailwindCSS |
| Backend | FastAPI, Pydantic v2, httpx |
| 검증 엔진 | 프론트 룰 엔진 (l7Rules.ts, structRules.ts) — LLM 불필요 |
| AI | OpenAI 호환 API (Groq / Ollama / 사내 LLM) |

---

## 빠른 실행

### 1) Backend

```bash
cd backend
pip install -r requirements.txt
py -3 app.py
```

- 기본 포트: `8000` / 점유 시 `8002`로 자동 fallback

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

- 기본 주소: `http://127.0.0.1:5173`

---

## 환경 변수

백엔드 시작 시 아래 순서로 파일을 자동 탐색합니다.

1. `backend/.env`
2. `backend/environment.txt`
3. `.env` (프로젝트 루트)
4. `environment.txt` (프로젝트 루트)

권장 설정 방법: `backend/environment.txt.example`을 복사 → `backend/environment.txt` 생성 → 수정

```bash
LLM_BASE_URL=http://10.240.248.157:8533/v1
LLM_MODEL=Qwen3-Next
USE_MOCK=auto   # auto | true | false
```

> 셸에서 `set LLM_BASE_URL=...`으로 이미 설정했다면 셸 값이 우선됩니다.

---

## API 요약

| 엔드포인트 | 역할 |
| :--- | :--- |
| `POST /api/chat` | 챗봇 질의/응답 |
| `POST /api/review` | AS-IS 문서화 품질 점검 + 제안 |
| `POST /api/validate-l7` | 노드 L7 검증 (룰 기반) |
| `POST /api/contextual-suggest` | 맥락 기반 한 줄 가이드 |
| `POST /api/first-shape-welcome` | 첫 노드 추가 시 온보딩 |
| `POST /api/analyze-pdd` | PDD 카테고리 분류 |
| `POST /api/pdd-insights` | AI 전략 인사이트 (비효율·자동화 후보) |
| `GET  /api/health` | 상태 점검 |

---

## 프로젝트 구조

```text
process-coaching/
  backend/
    app.py                 # FastAPI 진입점 + 라우팅
    prompt_templates.py    # LLM 시스템 프롬프트 (REVIEW_SYSTEM, COACH_TEMPLATE 등)
    flow_services.py       # describe_flow, mock_validate, mock_review
    llm_service.py         # LLM 연결/호출/재시도 로직
    chat_orchestrator.py   # 멀티턴 대화 오케스트레이션
    schemas.py             # Pydantic 요청/응답 스키마
    env_config.py          # 환경변수 로드
  frontend/
    src/
      components/          # FlowChart, ChatPanel, Toolbar, SuggestionCard 등
      store.ts             # 전역 상태(Zustand) — 모든 액션 정의
      store/helpers.ts     # makeEdge, serialize 등 유틸
      types.ts             # 도메인 타입 정의
      utils/l7Rules.ts     # Tier 2 라벨 규칙 엔진
      utils/structRules.ts # Tier 1 구조 규칙 엔진
      config/
        rulesLoader.ts     # 동사 목록 단일 소스 (BANNED_VERBS 등)
        l7_rules.yaml      # 규칙 정의 문서 (rulesLoader.ts와 동기화)
    tests/goldenset/       # L7 룰 골든셋 테스트 (Jest)
```

---

## 개발 팁

```bash
# 타입 검사
cd frontend && npx tsc --noEmit

# L7 룰 골든셋 테스트
cd frontend && npm run test:goldenset

# YAML ↔ TS 동기화 검사
cd frontend && npm run sync:check
```

**.gitignore 주의**: `frontend/src/data/` (processData.ts 등 로컬 샘플)는 gitignore 대상. 커밋 전 확인.

### 자주 겪는 문제

| 증상 | 원인 / 해결 |
| :--- | :--- |
| `spawn EPERM` | 보안/샌드박스 환경 자식 프로세스 차단 |
| PowerShell에서 npm 차단 | `npm.cmd` 사용 |
| LLM 연결 지연 | `USE_MOCK=true`로 프론트 기능 먼저 점검 |
| ReactFlow handle 오류 | 구버전 저장 데이터의 handle ID(`"bottom"`) → makeEdge에서 자동 정규화 |

---

## L7 작성 가이드라인

본 가이드라인은 HR 직원이 직접 업무를 **L7 수준으로 Decomposition**할 때, 모든 HR팀이 **동일한 품질**로 작성하도록 돕기 위한 기준이다.

### 원칙

- 필수 항목은 100% 충족해야 L7으로 인정
- 이 문장만 보고 다른 사람이 그대로 업무를 수행할 수 있어야 한다
- AS-IS 기준이며, 개선·이상·자동화 관점은 포함하지 않는다
- **한 셰이프 = 한 동작** (아토믹 액션 원칙)

---

### Tier 1 · 구조 규칙 (S-Rules)

> 결정론적, 즉시 판정 — `frontend/src/utils/structRules.ts`
> 출처: bpmnlint (Camunda), 7PMG (Mendling 2010)

| Rule ID | 내용 | 수준 | 비고 |
| :--- | :--- | :--- | :--- |
| S-01 | 종료 노드가 최소 1개 있어야 한다 | Warning | 드로잉 중 품질 대시보드에서 억제 — 완료하기/전체 흐름 검토 시 안내 |
| S-03 | 연결이 없는 고아 노드가 없어야 한다 | Warning | 종료 노드 없는 작업 중엔 억제 |
| S-05 | 프로세스 노드 직접 분기 시 판단 노드를 사용해야 한다 | Warning | |
| S-06 | 동일한 출발→도착 연결이 중복되면 안 된다 | Warning | |
| S-07 | 판단 노드에서 나가는 경로가 1개뿐이면 일반 노드로 변경해야 한다 | Warning | |
| S-08 | 판단 노드의 모든 분기에 조건 라벨이 있어야 한다 | Warning | |
| S-09 | 시작 노드가 2개 이상이면 의도적 구조인지 확인해야 한다 | Warning | |
| S-10 | 판단 노드에서 4개 이상 분기 시 2단계 판단 구조를 권장한다 | Warning | |
| S-11 | 총 노드 50개 초과 시 서브프로세스로 분해를 권장한다 | Warning | |

---

### Tier 2 · 라벨 규칙 (R-Rules)

> 결정론적, 즉시 판정 — `frontend/src/utils/l7Rules.ts`
>
> 기본 플레이스홀더 라벨(`새 태스크`, `분기 조건?` 등)은 검증 대상에서 제외 — 내용 입력 전 오판정 방지

| Rule ID | 내용 | 실패 시 | 적용 노드 |
| :--- | :--- | :--- | :--- |
| R-01 | 라벨이 4자 이상이어야 한다 | Warning | 전체 |
| R-02 | 라벨이 100자 이하여야 한다 | Warning | 전체 |
| R-03a | 금지 동사를 포함하지 않아야 한다 | Reject | 전체 |
| R-03b | 구체화 권장 동사 사용 시 대안 동사를 안내한다 | Warning | Process만 |
| R-04 | 괄호/`~에서` 패턴의 시스템명은 메타데이터로 분리해야 한다 | Warning | 전체 |
| R-05 | `~하고/~하며/~한 후` 복수 동작이 없어야 한다 | Reject | Process만 |
| ~~R-06~~ | ~~스윔레인 미사용 시, 타동사+목적어가 있으면 주어를 명시해야 한다~~ | ~~Suggestion~~ | **삭제됨** (주체는 스윔레인으로 처리) |
| R-07 | 타동사 사용 시 목적어(을/를)가 있어야 한다 | Reject | Process만 |
| R-08 | 판단 기준(여부/인가/이상/이하 등)이 드러나야 한다 | Warning | Decision만 |

---

### 동사 정책 상세 (v2 — 2026-02-18 확정)

#### 금지 동사 — R-03a (Reject)

어떤 맥락에서도 제3자가 수행할 수 없는 동사. 사용 불가.

| 동사 | 동사 | 동사 |
| :--- | :--- | :--- |
| 처리한다 | 진행한다 | 관리한다 |
| 대응한다 | 지원한다 | 파악한다 |
| 준비한다 | 고도화한다 | 리드한다 |
| 수행한다 | 대화한다 | 진단한다 |
| 컨설팅한다 | | |

#### 구체화 권장 동사 — R-03b (Warning)

사용은 가능하나 더 구체적인 동사로 교체하면 명확해지는 동사.

| 동사 | 권장 대안 |
| :--- | :--- |
| 검토한다 | 비교한다, 판정한다, 검증한다 |
| 개선한다 | 수정한다, 재작성한다 |
| 최적화한다 | 수정한다, 재설정한다 |
| 정리한다 | 분류한다, 집계한다, 삭제한다 |
| 공유한다 | 안내한다, 발송한다, 공지한다 |
| 조율한다 | 요청한다, 협의한다 |
| 협의한다 | 요청한다, 회의한다 |
| 반영한다 | 입력한다, 수정한다, 저장한다 |
| 분석한다 | 집계한다, 비교한다, 추출한다 |
| 평가한다 | 판정한다, 검증한다, 비교한다 |
| 담당한다 | 조회한다, 입력한다, 구체 동작으로 교체 |
| 보조한다 | 안내한다, 요청한다, 구체 동작으로 교체 |
| 피드백한다 | 안내한다, 공지한다, 요청한다 |
| 검수한다 | 검증한다, 확인한다, 비교한다 |
| 상신한다 | 제출한다, 요청한다 |
| 결재한다 | 승인한다, 반려한다 |
| 산출한다 | 집계한다, 추출한다 |

#### 표준 동사 사전 (v2)

L7 라벨에 권장되는 동사. 목적어와 함께 사용하면 제3자가 즉시 이해·수행 가능하다.

| 카테고리 | 표준 동사 |
| :--- | :--- |
| 조회/입력/수정 | 조회한다, 입력한다, 수정한다, 저장한다, 추출한다, 확인한다, 분류한다 |
| 비교/집계/기록 | 비교한다, 집계한다, 기록한다, 첨부한다, 체크한다 |
| 승인/판정/전달 | 판정한다, 승인한다, 반려한다, 결정한다, 전송한다, 발송한다, 배포한다, 제공한다 |
| 요청/안내/공지 | 요청한다, 안내한다, 공지한다 |

---

### Tier 3 · AI 의미 분석 (LLM)

> LLM 사용 가능 시에만 실행. Rule Reject는 AI pass와 무관하게 유지된다.

| Rule ID | 내용 | 처리 |
| :--- | :--- | :--- |
| A-01 | 제3자가 라벨만 보고 수행 가능한가 (맥락 충분성) | Score |
| A-02 | 판단 노드 기준이 충분히 구체적인가 | Score |
| A-03 | 플로우에 누락된 단계가 있는가 | Score |
| A-04 | 개선된 라벨 rewrite 제안 | 제안 |
| A-05 | HR 프로세스 도메인 맥락에 맞는가 | Score |
| A-06 | 플로우 전체의 논리적 완결성 | Score |

---

### 점수 체계

**노드 단위 (감점제):**

| 위반 | 감점 |
| :--- | :--- |
| Reject 1개 | -30점 |
| Warning 1개 | -10점 |
| Suggestion 1개 | -3점 |
| 기본 | 100점 (하한 0점) |

**판정:**

| 판정 | 조건 | 표시 |
| :--- | :--- | :--- |
| 재작성 권고 | Reject 있음 | 빨간 테두리 |
| 개선 가능 | Warning만 있음 | 노란 테두리 |
| 기준 준수 | 이슈 없음 | 초록 테두리 |

---

## 이론적 배경 (v2 설계 근거)

> "우리가 느끼기에 이상한 것"이 아니라, 글로벌 기업과 학계가 데이터로 검증한 기준을 HR 맥락에 맞게 번역한 것이다.

### bpmnlint — 구조 규칙의 출처

SAP·BMW·Bosch 등 10만+ 기업이 사용하는 **Camunda**에 기본 내장된 프로세스 검증 엔진. "연결이 끊겼다", "판단 노드에 조건이 없다"를 규칙만으로 즉시 감지한다. S-01~S-11의 직접 출처.

### 7PMG — "복잡한 플로우일수록 오류가 많다"

Jan Mendling 교수(빈 경제대)가 실제 기업 604개 프로세스를 분석해 도출한 7가지 품질 원칙(2010). 분기 3개 초과 시 이해도 급락(G2), 노드 50개 초과 시 오류율 50% 이상(G7) 등을 데이터로 증명. S-09, S-10, S-11의 근거.

### BEF4LLM — 규칙과 AI의 역할 분리

2025년 발표 연구. 구조·문법·복잡도는 규칙 엔진으로 70% 이상 커버 가능하며, AI(LLM)는 "의미가 맞는가" 같은 규칙으로 판단하기 어려운 영역에만 투입해야 한다는 원칙. → **AI가 꺼져도 S/R 규칙은 항상 동작**하는 설계의 근거.

### Signavio — 구조 문제와 라벨 문제는 분리해서 보여줘야 한다

SAP가 인수한 글로벌 BPM 플랫폼의 UX 연구. "연결 끊김"(구조)과 "동사 모호"(라벨)를 섞어 보여주면 사용자가 어디서 고쳐야 할지 모른다. → 품질 대시보드에서 S-규칙과 R-규칙을 별도 그룹으로 표시하는 설계의 근거.

---

## v1 → v2 주요 변경 (팀 토의용)

| 항목 | v1 최초 가이드라인 | v2 제안 |
| :--- | :--- | :--- |
| **구조 계층** | 없음 (라벨 규칙만) | S-01~S-11 신설 (bpmnlint·7PMG 기반) |
| **동사 분류** | 피해야 할 용어 단일 목록 | 금지(Reject) / 권장(Warning) 이분화 |
| **R-07 목적어** | 필수(Reject) | Reject 유지 — 최초 가이드라인 그대로 |
| **수행 위치** | 라벨에 포함 필수 | R-04: systemName 메타데이터 필드로 분리 |
| **판단 기준** | 판단 동사→기준→결과 3단계 순차 검증 | 핵심 기준 키워드(여부/이상/이하/인가) 한 번에 확인 |
| **R-18~R-20** | 점수 산정 규칙 | Tier 3 AI 시그널로 분리 (BEF4LLM 원칙) |

### 팀 토의 필요 사항

1. **동사 목록 현장 검증** — 금지 13개·권장 17개가 실제 HR 작성 패턴과 맞는가?
2. **보조한다·담당한다** — v1 금지 → v2 Warning 완화. 지원한다(Reject)와의 일관성 재검토 필요
3. **수행 위치 처리** — 라벨 간결성 vs. 위치 명시 중 팀 우선순위 확인
4. **구조 규칙 Reject 승격** — S-01~S-11 중 Warning을 Reject으로 격상할 규칙 있는가?

---

## 알려진 기술 부채

코드 리뷰에서 발견된 항목. 기능 동작에는 문제없으나 장기적으로 개선 필요.

| # | 심각도 | 위치 | 내용 |
| :--- | :--- | :--- | :--- |
| T-01 | ~~중~~ | `backend/flow_services.py` mock_validate() | ~~R-05 판정 시 `INTENT_EXCLUDE_PATTERNS`(~하고자 한다 등) 미적용 → 의도 표현 오판정 가능~~ **수정 완료** (872333a) |
| T-02 | ~~중~~ | `backend/flow_services.py` vs `frontend/l7Rules.ts` | ~~Backend mock_validate과 Frontend 규칙 엔진 미동기화 (Decision 노드 가드 누락, R-07 severity 불일치)~~ **수정 완료** (e2efe28) |
| T-03 | ~~중~~ | `backend/prompt_templates.py` REVIEW_SYSTEM | ~~LLM 지시사항에서 "라벨명만" vs "ID 사용" 구분이 충분하지 않아 잘못된 노드 대상 제안 위험~~ **수정 완료** (e2efe28) |
| T-04 | ~~낮음~~ | `frontend/src/store.ts` applySuggestion() | ~~MODIFY action에 targetNodeId 없으면 조용히 실패 (사용자에게 피드백 없음)~~ **수정 완료** (e2efe28) |
| T-05 | ~~낮음~~ | `frontend/src/store.ts` validateAllNodes() | ~~배치 검증 중 사용자 편집 시 결과 혼동 가능~~ **수정 완료** (e2efe28) |
| T-06 | ~~낮음~~ | `frontend/src/components/QualityDashboard.tsx` | ~~프로세스 노드 0개일 때 안내 메시지 없음 (null 반환)~~ **수정 완료** (e2efe28) |
