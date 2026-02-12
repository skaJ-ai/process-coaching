# HR Process Mining v5.0

L7 프로세스 드로잉 도구 — Visio 스타일 프로세스 맵 + AI 코칭

## v5.0 주요 변경사항 (vs v4.3)

### UI/UX 개선
- **프로세스 경계 입력 제거**: 시작/종료를 캔버스에서 자유롭게 배치 (초기 화면 간소화)
- **'저장된 플로우' 버튼 제거**: JSON 가져오기만 유지, 자동복구 토스트 추가
- **셰이프 인라인 생성**: 우클릭 → 셰이프 추가 시 prompt() 대신 즉시 생성 + 인라인 편집
- **좌표 변환 버그 수정**: screenToFlowPosition() 적용으로 줌/패닝 상태에서도 정확한 위치에 생성
- **핸들 크기 확대**: 10px → 14px (hover: 18px), connectionRadius=30 적용
- **노드 hover 시 핸들 표시**: 평소 반투명 → hover 시 선명하게
- **시작/종료 노드 인라인 편집**: 더블클릭으로 라벨 수정 가능
- **직각(step) 엣지**: smoothstep → step으로 변경, BPMN 표준에 부합
- **하위공정 BPMN 셰이프**: 좌우 세로선으로 프로세스와 시각적 구분
- **다크/라이트 테마 전환**: 툴바 ☀️/🌙 버튼

### 스윔레인 (대폭 개선)
- **다중 가로형 스윔레인**: 2개 이상 주체 지원 (기존: 단일 구분선 2영역)
- **좌측 레인 헤더**: 직접 클릭하여 주체명 인라인 편집 (prompt 없음)
- **레인 경계 드래그**: 마우스로 경계선 위치 조절
- **미니맵 레인 색상**: 노드가 속한 레인 색상으로 미니맵에 표시
- **레인 추가/삭제**: 툴바에서 + 버튼으로 레인 추가

### 챗봇 개선
- **퀵 버튼 자동 전송**: 클릭 즉시 전송 (기존: 입력란에 채우기만)
- **후속 질문 자동 생성**: 챗봇 응답마다 맥락에 맞는 follow-up 질문 버튼 표시
- **능동적 셰이프 코칭**: 셰이프 추가 시 5초 디바운스로 자동 맥락 분석 + 제안
- **/api/contextual-suggest**: 새 백엔드 엔드포인트

### JSON 하위호환
- v4.3 JSON 파일 가져오기 시 자동으로 v5 스윔레인 형식으로 변환

## 실행 방법

### 1. 백엔드 (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python app.py
# → http://localhost:8000
```

### 2. 프론트엔드 (React + Vite)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 환경 변수 (선택)
```bash
# LLM 서버 주소 (기본: 사내 Qwen3-Next)
export LLM_BASE_URL="http://10.240.248.157:8533/v1"
export LLM_MODEL="Qwen3-Next"

# Mock 모드 (LLM 없이 테스트)
export USE_MOCK="true"
```

## 기술 스택
- **Frontend**: React 18, ReactFlow 11, Zustand 4, Tailwind CSS 3, TypeScript, Vite 5
- **Backend**: FastAPI, httpx, Pydantic
- **AI**: Qwen3-Next (OpenAI-compatible API) / Mock fallback

## 단축키
| 단축키 | 기능 |
|--------|------|
| Ctrl+Z | 실행 취소 |
| Ctrl+Shift+Z | 다시 실행 |
| Ctrl+S | 임시 저장 |
| Ctrl+C/V | 복사/붙여넣기 |
| Delete | 선택 삭제 |
| F1 | 도움말 |
| 더블클릭 (노드) | 인라인 편집 |
| 더블클릭 (엣지) | 라벨 편집 |
| 우클릭 (빈 공간) | 셰이프 추가 |
| 우클릭 (노드) | 편집 메뉴 |
| Ctrl+Shift+A | 관리자 모드 (pw: pm2025) |
