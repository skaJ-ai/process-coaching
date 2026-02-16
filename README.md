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

실사용 대상은 HR 프로세스 설계 실무자이며, 목표는 "그리기"가 아니라 "검토 가능한 수준의 프로세스 정의"까지 빠르게 도달하는 것입니다.
