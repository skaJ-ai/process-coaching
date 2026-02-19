# Process Coaching AI

L7 기반 HR 프로세스 설계를 위한 시각화 + 코칭 도구입니다.
ReactFlow 캔버스에서 프로세스를 그리고, FastAPI 백엔드의 AI 코칭/검증을 받아 단계 품질을 높이는 것이 목적입니다.

## 핵심 기능

- 플로우 차트 편집
  - 시작/종료/프로세스/판단/L6 프로세스 노드
  - 우클릭 컨텍스트 메뉴, 드래그 연결, 엣지 라벨 편집
- 스윔레인
  - 역할 구분선 ON/OFF
  - 레인 라벨 편집
  - 구분선 드래그/삭제
- L7 검증
  - 노드별 검증 및 배치 검증
  - 이슈 태그, 개선 제안, rewrite 추천
- AI 코칭
  - 플로우 리뷰, 채팅 Q&A, 맥락 제안(contextual suggest)
  - 제안 summary와 실제 라벨(labelSuggestion) 분리 적용
- 품질/운영 보조
  - 자동 저장, 내보내기/가져오기(JSON)
  - PDD 초안 생성

## 기술 스택

- Frontend
  - React 18, TypeScript, Vite 5
  - ReactFlow 11, Zustand
  - TailwindCSS
- Backend
  - FastAPI, Pydantic, httpx

## 빠른 실행

### 1) Backend

```bash
cd backend
pip install -r requirements.txt
py -3 app.py
```

- 기본 포트: `8000`
- 8000 점유 시 코드에서 `8002`로 fallback 실행

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

- 기본 주소: `http://127.0.0.1:5173`

## 환경 변수

백엔드 시작 시 아래 파일들을 자동으로 읽습니다(위에서 아래 순서로 확인).

- `backend/.env`
- `backend/environment.txt`
- `.env` (프로젝트 루트)
- `environment.txt` (프로젝트 루트)

권장 방식:

1. `backend/environment.txt.example`를 복사해서 `backend/environment.txt` 생성
2. 주소/모델만 수정
3. 백엔드 재시작

- `LLM_BASE_URL` (default: `http://10.240.248.157:8533/v1`)
- `LLM_MODEL` (default: `Qwen3-Next`)
- `USE_MOCK`
  - `auto`: LLM 연결 확인 후 자동
  - `true`: 항상 mock 응답
  - `false`: 항상 LLM 사용 시도

예시:

```bash
# backend/environment.txt
LLM_BASE_URL=http://10.240.248.157:8533/v1
LLM_MODEL=Qwen3-Next
USE_MOCK=auto
```

참고: 셸에서 같은 키를 이미 설정했다면(`set LLM_BASE_URL=...`) 셸 값이 우선됩니다.

## API 요약

백엔드 주요 엔드포인트:

- `POST /api/chat` : 챗봇 질의/응답
- `POST /api/review` : 플로우 분석 + 제안
- `POST /api/validate-l7` : 노드 L7 검증
- `POST /api/contextual-suggest` : 맥락 기반 한 줄 가이드
- `POST /api/first-shape-welcome` : 첫 노드 추가 시 온보딩 메시지
- `POST /api/analyze-pdd` : PDD 추천 분석
- `GET /api/health` : 상태 점검

## 프로젝트 구조

```text
process-coaching/
  backend/
    app.py                 # FastAPI 진입점 + LLM 프롬프트/검증 로직
    requirements.txt
  frontend/
    src/
      components/          # FlowChart, ChatPanel, Toolbar 등 UI
      store.ts             # 전역 상태/액션(Zustand)
      types.ts             # 도메인 타입
      utils/               # 라벨/레이아웃 유틸
    package.json
```

## 주요 설계 포인트

- 제안 데이터 분리
  - `summary`: 사용자에게 보여줄 설명
  - `labelSuggestion`: 실제 셰이프 라벨
- L7 태그 정합성
  - 백엔드 ruleId와 프론트 friendlyTag 매핑 일치
- 스윔레인 UX
  - 레인 라벨은 좌측 고정 오버레이
  - 드래그 바는 우측 고정 오버레이
  - 드래그 종료(`mouseup`, `buttons===0`) 안정화

## 자주 겪는 문제

- 프론트 실행 시 `spawn EPERM`
  - 보안/샌드박스 환경에서 자식 프로세스 생성이 막힐 때 발생
- PowerShell 실행 정책으로 `npm`/`codex`가 막힘
  - `npm.cmd`, `codex.cmd` 사용
- LLM 연결 지연
  - `USE_MOCK=true`로 프론트 기능/UX 먼저 점검 가능

## 개발 팁

- 커밋 전 확인

```bash
cd frontend
npx tsc --noEmit
```

- `.vite` 캐시는 커밋 대상이 아닙니다.

---

## L7 검증 가이드라인

> 실무자가 L7 기준의 프로세스를 작성하도록 돕는 검증 엔진의 설계 원칙과 규칙 목록입니다.
> 팀원과의 토의 자료로 활용해 주세요.

### 배경 — v1의 한계

초기 버전(v1)은 7개 규칙으로 시작했습니다. 대부분 LLM 프롬프트에 의존했고, LLM이 비활성 상태이면 룰이 실행되지 않거나 결과가 일관되지 않는 문제가 있었습니다.

| Rule ID | 이름 | 조건 | v1 구현 위치 |
|---------|------|------|-------------|
| R-01 | 길이 부족 | < 4자 | backend |
| R-02 | 길이 초과 | > 100자 | backend |
| R-03 | 모호 동사 | 14개 동사 일괄 warning | backend |
| R-04 | 시스템명 혼입 | 괄호 감지 | backend |
| R-05 | 복수 동작 | 접속사 패턴 | frontend만 |
| R-08 | 기준값 누락 | decision 노드 | LLM 프롬프트만 |
| R-15 | 표준 형식 | ~한다 종결 | backend |

**핵심 문제:**
- LLM 실패 시 구조/라벨 품질 검증이 사실상 불가
- R-03 금지 동사 14개가 동일 수준으로 묶여 있어 오탐 높음
- 구조 규칙(연결 완결성, 중복 연결 등) 전혀 없음

---

### 고도화 근거 — 업계 Best Practice

아래 4개 레퍼런스를 기반으로 v2를 설계했습니다.

**1. bpmnlint (Camunda)** — 구조 규칙의 표준
19개 결정론적 구조 규칙. 모두 O(n) 복잡도로 LLM 없이 즉시 판정 가능.
Camunda Modeler에 내장되어 10만+ 사용자 검증.
→ S-01~S-11 구조 규칙의 직접 출처

**2. 7PMG (Mendling et al., 2010)** — 학술 근거
프로세스 모델 품질 7대 원칙 중 우리에게 적용 가능한 3개:
- **G2**: 분기 3개 초과 시 이해도 급락 → S-10 과다 분기
- **G3**: 시작점 2개 이상 → S-09 다중 시작 확인
- **G7**: 50개 초과 모델의 오류율 50%+ → S-11 복잡도 경고

**3. BEF4LLM (2025)** — Rule vs AI 분리 원칙
품질 차원을 4가지로 분류 — Validity(구조), Syntactic(문법), Pragmatic(복잡도)는 결정론적 룰로, Semantic(의미)는 LLM으로.
→ **LLM 없이도 70% 커버 가능한 구조** 확보의 근거

**4. Signavio** — 4범주 컨벤션
"구조 이상"과 "라벨 품질 문제"를 분리해 사용자가 개선 우선순위를 파악하도록 설계.
→ 품질 대시보드에서 S(구조) 규칙과 R(라벨) 규칙을 별도 표시하는 설계의 근거

---

### 현행 규칙 (v2 — 2026-02-18 확정)

#### Tier 1 · 구조 규칙 (Structure Rules)

> 결정론적, 즉시 판정. `frontend/src/utils/structRules.ts`

| ID | 이름 | 조건 | 수준 | 근거 |
|----|------|------|------|------|
| S-01 | 종료 노드 필수 | 종료 노드 0개 | warning | bpmnlint |
| S-02 | 빈 라벨 방치 | 기본값("새 태스크") 유지 | warning | bpmnlint |
| S-03 | 고아 노드 | 연결 없는 노드 | warning | bpmnlint |
| S-04 | 흐름 끊김 | ~~나가는 연결 없음~~ | ~~warning~~ | **억제됨** — 연결이 1개라도 있으면 OK 정책 |
| S-05 | 암묵적 분기 | process 노드에서 2개+ outgoing | warning | bpmnlint |
| S-06 | 중복 연결 | 동일 source→target 2개+ | warning | bpmnlint |
| S-07 | 무의미 판단 | decision outgoing 1개만 | warning | bpmnlint |
| S-08 | 조건 라벨 누락 | decision outgoing에 라벨 없음 | warning | bpmnlint |
| S-09 | 다중 시작 확인 | 시작 노드 2개+ | warning | 7PMG G3 |
| S-10 | 과다 분기 | decision outgoing 4개+ | warning | 7PMG G2 |
| S-11 | 모델 복잡도 | 총 노드 50개 초과 | warning | 7PMG G7 |

#### Tier 2 · 라벨 규칙 (Label Rules)

> 결정론적, 즉시 판정. `frontend/src/utils/l7Rules.ts` + `frontend/src/config/rulesLoader.ts`

| ID | 이름 | 조건 | 심각도 | v1 대비 |
|----|------|------|--------|---------|
| R-01 | 길이 부족 | < 4자 | warning | 유지 |
| R-02 | 길이 초과 | > 100자 | warning | 유지 |
| R-03a | 금지 동사 | 5개 — 처리/진행/관리/대응/지원 | **reject** | v1의 14개에서 분리 — 어떤 맥락에서도 대체 필수 |
| R-03b | 구체화 권장 | 9개 — 확인/검토/개선/최적화/정리/공유/조율/협의/반영 | warning | v1의 14개에서 분리 — 대안 동사와 함께 제안 |
| R-04 | 시스템명 혼입 | 괄호/`~에서` 패턴, 영문 대문자 or 시스템 키워드 조건 | warning | 강화 — 오탐 방지 조건 추가 |
| R-05 | 복수 동작 | `~하고/~하며/~한 후` 패턴 | **reject** | frontend + backend 반영 |
| R-06 | 주어 누락 | 스윔레인 미사용 + 목적어 있음 + 주어 없음 | **suggestion** | **v2 신규** — 조건부, 스윔레인 활성 시 비활성 |
| R-07 | 목적어 누락 | 타동사(12개) + `을/를` 없음 | warning | **v2 신규** |
| R-08 | 기준값 누락 | decision 노드에 판단 기준 없음 | warning | Rule 레벨 유지 |

> **R-03 분리 이유**: "확인한다", "검토한다"는 "품의서를 검토한다"처럼 목적어와 결합하면 충분히 구체적일 수 있습니다. 이를 reject으로 잡으면 오탐이 많아 사용자 반발이 생기므로 warning으로 분리했습니다.
>
> **R-15(표준 형식 ~한다) 제거 이유**: 실무에서 "급여 검토", "접수 완료" 등 다양한 종결 형식이 사용됩니다. 모든 경우를 warning으로 잡으면 오탐률이 높아 신뢰를 잃으므로 제거했습니다. 팀에서 재도입이 필요하다고 판단하면 suggestion 레벨로 복구 가능합니다.

#### Tier 3 · AI 의미 분석 (LLM)

> LLM 사용 가능 시에만 실행. Rule reject는 AI pass와 관계없이 유지됩니다.

| ID | 이름 | 판단 내용 |
|----|------|-----------|
| A-01 | 맥락 충분성 | 제3자가 라벨만 보고 수행 가능한가 |
| A-02 | 판단 기준 구체성 | decision 노드 기준이 충분한가 |
| A-03 | 누락 단계 감지 | 플로우에 빠진 단계가 있는가 |
| A-04 | rewrite 제안 | 개선된 라벨 생성 |
| A-05 | 도메인 적합성 | HR 프로세스 맥락에 맞는가 |
| A-06 | 전체 논리 완결성 | 플로우가 논리적으로 완결인가 |

---

### 점수 체계

**노드 단위:**
```
기본 100점
  reject 1개당: -30점
  warning 1개당: -10점
  suggestion 1개당: -3점
  하한: 0점
```

**판정:**
```
reject 있음  → 재작성 권고 (빨간 테두리)
warning만    → 개선 가능 (노란 테두리)
없음         → 준수 (초록 테두리)
```

**플로우 종합 점수 (향후 로드맵):**
```
Flow Quality Score = Structure(30%) + Label(40%) + Semantic(30%)
LLM 미사용 시 Semantic 제외, "미평가" 표시
```

---

### 팀 토의 요청 사항

아래 항목은 구현 확정 전 팀 합의가 필요합니다:

1. **R-03a/R-03b 동사 분류** — 금지 5개 / 구체화 권장 9개 분류가 현장에 맞는가?
   - 특히: "확인한다", "검토한다"를 금지→권장으로 낮춘 것에 동의하는가?
2. **R-07 타동사 목록** — 조회/입력/수정/저장/추출/비교/집계/기록/첨부/판정/승인/반려 (12개)
3. **R-06 주어 조건** — 스윔레인 미사용 시 suggestion 안내 방식이 적절한가?
4. **구조 규칙 코칭 수준** — S-01~S-11 중 어떤 것을 warning → reject으로 승격할지?
5. **플로우 종합 점수 가중치** — Structure 30% / Label 40% / Semantic 30% 비율

---

실사용 대상은 HR 프로세스 설계 실무자이며, 목표는 "그리기"가 아니라 "검토 가능한 수준의 프로세스 정의"까지 빠르게 도달하는 것입니다.
