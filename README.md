# L7 검증 UX 개선 계획
 
## 코드 분석 기반 8가지 이슈 검토
 
---
 
## 1) L7 검증 응답 대기 UX 개선 — 스트리밍 + 초 표시 제거
 
### 현재 문제
- `backend/app.py:225-280` — `call_llm()`이 전체 응답을 한 번에 받아옴 (non-streaming). timeout 60초, 재시도 3회.
- `LoadingIndicator.tsx:13` — 5초 이후부터 `(N초)` 표시, 15초 이후 "AI가 열심히 답변을 고민 중입니다!" 메시지.
- `store.ts:285` — validateAllNodes에서 배치 4개씩 처리하면서 `L7 검증 (X/N)...` 으로 진행률 표시.
 
### 솔직한 의견
초 카운터가 유저에게 스트레스를 준다는 지적에 동의한다. "23초... 24초..." 이렇게 올라가면 기다리는 게 체감상 더 길게 느껴진다. 다만 **LLM 응답을 끊어서 받는 것(streaming)**은 현 구조에서 구현 비용 대비 효과가 애매하다. 이유:
 
1. L7 검증은 JSON 구조화된 응답을 받아야 한다. streaming으로 받으면 부분 JSON을 파싱하다 깨질 위험이 있다.
2. 진짜 필요한 것은 **"답변이 올 때마다 개별 노드 결과를 즉시 보여주는 것"**이지, 하나의 답변을 chunk로 보여주는 것이 아니다.
 
### 제안 구현 방안
 
**A. 초 카운터 제거 + 단계별 진행 UX로 변경**
 
`LoadingIndicator.tsx` 수정:
- 초 표시 완전 제거
- 대신 **진행 단계 메시지** 방식으로 변경:
  - 0~5초: "분석 중..." (바운싱 닷)
  - 5~15초: "라벨 품질을 꼼꼼히 살펴보는 중..."
  - 15~30초: "거의 다 됐어요. 마지막 검토 중..."
  - 30초+: "조금 더 걸릴 수 있어요. 복잡한 내용을 분석하고 있어요."
- 프로그레스 바는 유지하되, 초가 아닌 **단계 기반 애니메이션**으로.
 
**B. 배치 검증 시 노드별 즉시 팝업**
 
`store.ts:280-313` 수정:
- 현재: 전체 배치 완료 후 한꺼번에 l7Report 메시지 추가
- 변경: **각 노드 검증 완료 시마다 즉시 개별 토스트/팝업**으로 결과 표시
- 이렇게 하면 "기다리는 느낌" 없이 결과가 하나씩 뜨므로 UX가 훨씬 개선됨
- 구현: `validateNode` 완료 시 개별 `addMessage` or 토스트 알림
 
**C. (선택) SSE 기반 노드별 스트리밍**
 
장기적으로 backend에서 SSE(Server-Sent Events) endpoint를 만들어, 노드별 검증이 완료될 때마다 프론트에 push하는 방식. 하지만 현 단계에서는 B만으로 충분하다.
 
### 수정 파일
- `frontend/src/components/LoadingIndicator.tsx` — 초 카운터 제거, 단계 메시지화
- `frontend/src/store.ts` (validateAllNodes) — 노드별 즉시 결과 반영
 
---
 
## 2) 스윔레인 고정 + 아이콘 위치/직관성 문제
 
### 현재 문제
- `FlowChart.tsx:13-96` — `SwimLaneOverlay`가 ReactFlow 내부에 `<div>`로 렌더링됨
- 핵심 버그: 스윔레인 라인이 **flow 좌표**로 absolute positioning되고 있는데, ReactFlow의 viewport transform(zoom/pan)이 적용되지 않는 듯 보임. 실제로 `dividerYs`는 flow 좌표 값인데, overlay div는 ReactFlow의 내부 viewport transform 안에 있으므로 zoom 시 위치가 틀어질 수 있다.
- `FlowChart.tsx:62` — `left: -10000, width: 20000` 하드코딩으로 수평 범위를 잡고 있음. zoom/pan에 따라 이게 부족하거나 넘칠 수 있음.
- `FlowChart.tsx:92-93` — 스윔레인 추가 버튼이 `right: 20, bottom: 20`으로 고정. ReactFlow의 `Controls` 컴포넌트가 `position="bottom-right"` (line 229). 즉, **추가 버튼과 Controls가 겹친다**.
- Toolbar의 구분선 토글 버튼: `🏊 구분선 ◆/○` — 이모지+기호 조합이 직관적이지 않다는 지적은 맞다.
 
### 솔직한 의견
스윔레인 구현이 현재 "overlay div를 flow 좌표에 놓는" 방식인데, **ReactFlow에서 SwimLaneOverlay가 `<ReactFlow>` 자식으로 렌더링**되고 있어서, ReactFlow의 내부 transform이 적용된다. 문제는:
 
1. **라인은 flow 좌표로 렌더링되어 노드와 함께 zoom/pan됨** — 이건 의도된 동작이고, 셰이프와 함께 움직여야 맞다.
2. 그런데 **drag handle, remove button, label, add button**도 같은 transform을 받으므로 zoom-out하면 함께 작아지고, zoom-in하면 함께 커진다. 이게 "위치가 바뀐다"는 불편함의 원인일 수 있다.
 
실제로 진짜 문제는: drag handle(`right: 20`)과 label(`left: 20`)이 **viewport 기준이 아니라 flow 좌표 기준**이라 zoom하면 화면 밖으로 나가거나 엉뚱한 곳에 붙는 것이다.
 
### 제안 구현 방안
 
**A. 스윔레인 라인을 ReactFlow Background처럼 완전 고정**
 
- 라인 자체는 현재처럼 flow 좌표에 두되, `width: 20000`을 `width: 99999` 이상으로 확장하거나 viewport width 기반으로 동적 계산
- 핵심: **drag handle, label, add button은 ReactFlow 외부로 분리** — 별도 `position: fixed` 또는 `screen 좌표 기반` overlay로 변경
- `rfInstance.flowToScreenPosition()`을 사용해서 UI 컨트롤의 screen 좌표를 매 렌더마다 계산
 
**B. 스윔레인 추가 버튼 위치 분리**
 
- 현재 `right: 20, bottom: 20` (flow 좌표) → ReactFlow Controls와 겹침
- 해결: **Toolbar에 스윔레인 추가 버튼 이동** 또는 **ReactFlow 외부에 별도 패널**로 분리
- Controls 위치를 `bottom-right`에서 `bottom-left` 등으로 이동하거나, 스윔레인 버튼을 좌측으로
 
**C. 아이콘 직관성 개선**
 
- `🏊 구분선 ◆/○` → `━━ 역할 구분선` 또는 아이콘을 수평선 아이콘(≡)으로 변경
- 추가 버튼 `+` → `━━+ 구분선 추가` 텍스트 포함
 
### 수정 파일
- `frontend/src/components/FlowChart.tsx` — SwimLaneOverlay 전면 재설계
- `frontend/src/components/Toolbar.tsx` — 스윔레인 관련 버튼 통합/아이콘 개선
 
---
 
## 3) ★핵심★ L7 검증 가이드라인 맹점 분석 및 개선안
 
### 현재 가이드라인 구조 분석
 
**backend/app.py의 L7_GUIDE (line 52-68):**
```
- 명확한 주어와 목적어 포함 권장
- 하나의 화면 내 연속 동작은 1개 L7로 표현
- 판단 시 명확한 기준값 포함
- 권장 동사 목록 (19개)
- 구체화 필요 동사 목록 (14개)
```
 
**mock_validate (line 398-476):** R-01(길이), R-02(길이초과), R-03(모호동사), R-04(괄호), R-15(표준형식)
 
**friendlyTag 매핑 (store.ts:682-691):** R-01~R-17 총 17개 룰 정의, 그 중 **12개가 미구현**
 
### 발견된 충돌/모순/맹점
 
**1. R-01 friendlyTag와 실제 로직의 불일치**
- `friendlyTag('R-01')` = `'복수 동사'` — 이건 "하나의 셰이프에 동사가 2개 이상"을 의미
- 실제 `mock_validate`의 R-01은 **길이 < 4** 체크 → 완전히 다른 룰
- **이건 명백한 버그.** friendlyTag 매핑이 전부 틀려있을 가능성이 높음
 
**2. friendlyTag 전체 불일치 목록:**
 
| Rule ID | friendlyTag 라벨 | mock_validate 실제 동작 | 불일치? |
|---------|-----------------|----------------------|--------|
| R-01 | '복수 동사' | 길이 < 4 체크 | **불일치** |
| R-02 | '목적어 누락' | 길이 > 100 체크 | **불일치** |
| R-03 | '금지 동사' | 모호 동사 체크 | **불일치** (금지≠모호) |
| R-04 | '복합 동사' | 괄호/시스템명 체크 | **불일치** |
| R-15 | '비표준 동사' | ~다 어미 체크 | **불일치** |
 
→ **5개 구현된 룰 중 5개 모두 friendlyTag가 잘못됨.** LLM이 응답할 때 ruleId를 보내면, 프론트에서 엉뚱한 태그를 보여주고 있을 것.
 
다만 실제로는 LLM 응답에 `friendlyTag` 필드가 포함되므로, `store.ts:276`에서 `i.friendlyTag || friendlyTag(i.ruleId)` — LLM이 friendlyTag를 주면 괜찮고, 안 주면 잘못된 fallback이 뜨는 구조.
 
**3. 가이드라인 자체의 모순**
 
- **"하나의 화면 내 연속 동작은 1개 L7"** vs **"명확한 주어와 목적어 포함 권장"**
  - "지원서를 접수하고, 합격여부를 판정한다" — 이게 하나의 화면이면 1개 L7? 하지만 이러면 복합문이 됨
  - 가이드가 "언제 쪼개고 언제 합치는지"에 대한 명확한 기준이 없음
 
- **모호동사 판정 기준의 모순**
  - "검토한다", "확인한다"가 '구체화 필요' 목록에 있음
  - 그런데 HR 프로세스에서 "서류 검토" "적격 확인"은 실제로 매우 일반적이고 명확한 표현
  - "확인한다"를 무조건 경고하면 유저 입장에서 납득이 안 됨
  - **문맥 무시 판정**이 문제. "급여 확인한다"와 "서류 확인한다"는 의미가 매우 다른데 동일 경고
 
- **권장 동사 목록의 누락**
  - "통보한다", "발송한다", "배포한다", "전환한다", "등록한다", "삭제한다", "복사한다", "이관한다", "검수한다" 등 실무에서 빈번히 쓰이는 동사가 없음
  - "예외로 처리한다"는 있지만 "예외 처리한다"(일반적 표현)와 다른 형태
 
- **판단 노드(decision)에 대한 가이드 부재**
  - L7_GUIDE는 process 노드 기준으로만 작성됨
  - decision 노드는 "~인가?" 형태가 자연스러운데, R-15("~다" 어미 체크)에 걸림
  - 현재 `validateNode`에서 decision도 검증 대상 (`line 268, 282`)
 
- **subprocess에 대한 검증 스킵 근거 부재**
  - `store.ts:268` — subprocess는 검증 스킵. 이유가 코드에 설명 없음
  - subprocess도 라벨 품질이 중요할 수 있는데 무조건 스킵
 
**4. LLM 프롬프트의 구조적 문제**
 
- `L7_VALIDATE` 프롬프트에 **구체적 ruleId 정의가 없음** (line 326-355)
  - LLM이 "R-XX"를 자유롭게 생성 → 프론트의 friendlyTag 매핑과 무관한 ID가 올 수 있음
  - LLM이 R-18, R-25 같은 존재하지 않는 ruleId를 만들 수 있음
 
- 프롬프트에 **"pass/fail 기준"이 명시되어 있지 않음**
  - 어떤 경우에 pass: true/false인지 LLM 재량 → 일관성 없는 결과
 
- `"score": 0-100` — 점수 기준 없음. LLM이 매번 다른 기준으로 채점
 
### 제안 개선안
 
**A. friendlyTag 매핑 전면 수정** (즉시 수정 필요)
 
```typescript
'R-01': '길이 부족',
'R-02': '길이 초과',
'R-03': '구체화 권장',  // "금지"가 아니라 "구체화 권장"
'R-04': '시스템명 분리',
'R-05': '복수 동작',    // 한 셰이프에 2개 이상 동작
'R-06': '주어 누락',
'R-07': '목적어 누락',
'R-08': '기준값 누락',  // decision 노드용
'R-09': '어미 불일치',
'R-10': '맥락 부족',
'R-11': '복합문 감지',  // "~하고, ~한다" 패턴
```
 
**B. L7_VALIDATE 프롬프트에 명시적 Rule 정의 추가**
 
```
[검증 규칙]
R-01: 길이 부족 — 라벨이 4자 미만이면 warning
R-02: 길이 초과 — 라벨이 50자 초과면 warning
R-03: 구체화 권장 — 모호 동사(처리, 진행, 관리, 확인, 검토 등) 사용 시, 단 문맥상 명확하면 pass
R-04: 시스템명 혼입 — 괄호나 시스템명이 라벨에 포함
R-05: 복수 동작 — 하나의 라벨에 2개 이상의 독립 동작 (쉼표, "~하고" 패턴)
R-06: 주어 누락 — 누가 하는 행위인지 불명확
R-07: 목적어 누락 — 무엇을 대상으로 하는지 불명확
R-08: 판단 기준 누락 — decision 노드에 판단 기준이 불명확
R-09: 어미 불일치 — process는 "~한다", decision은 "~인가?"
R-11: 복합문 — "~하고, ~한다" 패턴으로 2개 셰이프로 분리 필요
 
[pass/fail 기준]
- R-05(복수 동작), R-11(복합문)이 있으면 → pass: false
- 그 외는 모두 warning 수준 → pass: true + issues
- score: issues 0개=95, 1개=80, 2개=65, 3개+=50
```
 
**C. decision 노드 별도 검증 로직**
 
- decision 노드는 "~인가?" "~여부" 형태를 정상으로 취급
- R-15(~다 어미) 검증에서 decision 노드 제외
- R-08(판단 기준 누락) 추가: "승인?" → "서류 적격 기준 충족 여부?"
 
**D. 모호동사 문맥 감지**
 
- "확인한다" 앞에 구체적 목적어가 있으면 OK: "급여명세서를 확인한다" → pass
- "확인한다" 단독이면 경고: "확인한다" → R-03
- mock_validate에 이 로직 추가 (정규식으로 목적어 존재 여부 체크)
 
### 수정 파일
- `backend/app.py` — L7_GUIDE 전면 개정, L7_VALIDATE 프롬프트에 Rule 명세 추가, mock_validate 로직 확장
- `frontend/src/store.ts` — friendlyTag 매핑 전면 수정
- 새 파일 권장: `backend/l7_rules.py` — Rule 정의를 별도 모듈로 분리하여 관리
 
---
 
## 4) AI 추천 적용 시 복합문 → 셰이프 분리 가이드
 
### 현재 문제
- `store.ts:244-263` — `applySuggestion` MODIFY 액션은 단순히 `updateNodeLabel`만 호출
- LLM이 "지원서를 접수하고, 적격여부를 판정한다" 같은 복합문을 추천할 수 있음
- 이걸 그대로 적용하면 가이드라인 R-05(복수동작) 위반이 되는 아이러니
 
### 솔직한 의견
이건 **AI 추천 자체가 가이드라인을 위반**하는 근본적 모순이다. `rewriteSuggestion`이 복합문인 경우를 사전에 탐지해야 한다.
 
### 제안 구현 방안
 
**A. 복합문 감지 함수 추가**
 
프론트엔드에 유틸 함수:
```typescript
function detectCompoundAction(label: string): { isCompound: boolean; parts: string[] } {
  // "~하고, ~한다" / "~하며, ~한다" / "~한 후 ~한다" 패턴 감지
  const patterns = [/(.+하고),?\s*(.+한다)/, /(.+하며),?\s*(.+한다)/, /(.+한 후)\s*(.+한다)/];
  for (const p of patterns) {
    const m = label.match(p);
    if (m) return { isCompound: true, parts: [m[1] + '다', m[2]] };
  }
  return { isCompound: false, parts: [label] };
}
```
 
**B. 적용 시 분리 안내 notice**
 
`applyL7Rewrite` / `applySuggestion` 수정:
1. 적용 전 `detectCompoundAction` 호출
2. 복합문이면:
   - 토스트/모달로 안내: "이 추천에는 2개의 동작이 포함되어 있어요. 셰이프를 나누어 적용할까요?"
   - 옵션 3개: "그대로 적용" / "분리하여 적용" / "취소"
   - "분리하여 적용" 선택 시: 첫 번째 동작은 현재 셰이프에, 두 번째 동작은 `addShapeAfter`로 새 셰이프 생성
 
**C. 백엔드에서 사전 방지**
 
`L7_VALIDATE` 프롬프트에 추가:
```
중요: rewriteSuggestion은 반드시 단일 동작만 포함. "~하고 ~한다" 형태 금지.
복수 동작이 필요한 경우, rewriteSuggestion은 첫 번째 동작만 작성하고,
issues에 R-05(복수동작) 또는 R-11(복합문)을 포함하여 분리를 제안하세요.
```
 
### 수정 파일
- `frontend/src/store.ts` — applySuggestion, applyL7Rewrite에 복합문 감지/분리 로직
- `backend/app.py` — L7_VALIDATE 프롬프트 보강
- 새 유틸: `frontend/src/utils/labelUtils.ts` — detectCompoundAction 등
 
---
 
## 5) 하위공정 셰이프 이름 'L6 프로세스'로 변경
 
### 현재 상태
- `ContextMenu.tsx:46` — defaults: `subprocess: '하위공정'`
- `ContextMenu.tsx:58` — 메뉴 표시: `▣ 하위공정`
- `backend/app.py:130,151` — describe_flow에서 `하위공정`으로 표현
- `store.ts:188,206` — ID prefix: `sub`
 
### 솔직한 의견
단순 텍스트 변경이라 간단하다. 다만 "L6 프로세스"로 변경하면 L4→L5→L6→L7 체계에서의 위치가 명확해지므로 좋은 변경이다. 기존 저장된 플로우 파일에는 nodeType이 `subprocess`로 저장되어 있으므로 내부 type은 유지하고 **표시 라벨만 변경**하면 된다.
 
### 수정 위치
- `frontend/src/components/ContextMenu.tsx:46` — `subprocess: 'L6 프로세스'`
- `frontend/src/components/ContextMenu.tsx:58` — `▣ L6 프로세스`
- `backend/app.py:130` — `하위공정({node_types['subprocess']})` → `L6 프로세스({node_types['subprocess']})`
- `backend/app.py:151` — type 매핑: `"subprocess":"L6 프로세스"`
 
---
 
## 6) 챗봇 '좋은 시작입니다!' '좋은 질문입니다!' 어색함 개선
 
### 현재 상태 — 해당 표현이 나오는 모든 위치:
1. `backend/app.py:291` — REVIEW_SYSTEM 예시: `"좋은 시작입니다! 몇 가지 고려사항을 공유드릴게요"`
2. `backend/app.py:316` — COACH_TEMPLATE 예시: `"좋은 질문입니다. 이런 관점에서 생각해볼 수 있어요"`
3. `backend/app.py:386` — FIRST_SHAPE_SYSTEM 예시: `"좋은 시작입니다! 함께 프로세스를 완성해보겠습니다"`
4. `backend/app.py:461` — mock_validate: `"좋은 시작입니다. 조금만 더 다듬으면 완벽해요!"`
5. `backend/app.py:537` — mock_review: `"좋은 시작입니다! "` (2개 이하 노드일 때)
6. `backend/app.py:591` — first_shape_welcome fallback: `"좋은 시작입니다!"`
 
### 솔직한 의견
맞다. "좋은 질문입니다!"는 한국어에서 선생님이 학생한테 하는 말처럼 들리고, "좋은 시작입니다!"는 매번 나오면 로봇 같다. 특히 LLM 프롬프트의 예시에 "좋은 시작입니다", "좋은 질문입니다"가 들어 있으면 LLM이 그걸 따라하므로, **프롬프트 예시를 바꿔야 LLM 출력도 바뀐다**.
 
### 제안 — 자연스러운 대체 표현
 
**"좋은 시작입니다!" 대체:**
- "프로세스 설계를 시작해볼게요." (중립)
- "함께 만들어 보겠습니다." (협력)
- "첫 단계가 추가되었네요." (사실 기반)
 
**"좋은 질문입니다!" 대체:**
- 아예 삭제하고 바로 답변으로 시작
- "이런 관점에서 살펴볼 수 있어요:" (바로 본론)
- "그 부분은 이렇게 생각해볼 수 있어요." (답변형)
 
### 수정 파일
- `backend/app.py` — 6개 위치의 프롬프트 예시 및 하드코딩 문구 전면 수정
 
구체적 변경:
```python
# REVIEW_SYSTEM (line 291)
"speech": "분석 결과를 공유드릴게요. 몇 가지 고려사항이 있어요."
 
# COACH_TEMPLATE (line 316)
"speech": "그 부분은 이렇게 접근해볼 수 있어요."
 
# FIRST_SHAPE_SYSTEM (line 386)
"greeting": "첫 단계가 추가되었네요! 함께 프로세스를 완성해보겠습니다."
 
# mock_validate (line 461)
encouragement = "잘 작성하셨어요!" if not issues else "방향이 잘 잡혔어요. 조금만 더 다듬어 볼까요?"
 
# mock_review (line 537)
speech = "좋은 구조예요! " if len(nodes) > 2 else "프로세스 설계를 시작해볼게요. "
 
# first_shape_welcome fallback (line 591)
"👋 첫 단계가 추가되었네요! \"{process_name}\" 프로세스를 함께 완성해보겠습니다."
```
 
---
 
## 7) 셰이프 클릭 팝업(NodeDetailPanel)에 'AI 추천 수정' 버튼 추가
 
### 현재 상태
- `NodeDetailPanel.tsx:41-43` — AI 추천(`l7Rewrite`) 표시 시 **"적용" 버튼만** 존재
- `L7ReportCard.tsx:63-66` — 여기는 **"적용" + "수정" 버튼 둘 다** 있음
- 즉, ChatPanel의 L7ReportCard에서는 수정 가능하지만, 셰이프 클릭 시 나타나는 NodeDetailPanel에서는 수정 불가
 
### 솔직한 의견
명백한 기능 누락이다. NodeDetailPanel과 L7ReportCard의 AI 추천 UI가 불일치한 것은 UX 일관성 문제. NodeDetailPanel에도 L7ReportCard와 동일하게 "수정" 버튼을 추가해야 한다.
 
### 구현
 
`NodeDetailPanel.tsx:41-43` 수정 — 현재:
```tsx
<button onClick={() => applyRewrite(node.id)}>적용</button>
```
 
변경:
```tsx
const [editing, setEditing] = useState(false);
const [editText, setEditText] = useState(l7Rewrite || '');
 
{!editing ? (
  <>
    <div>{l7Rewrite}</div>
    <button onClick={() => applyRewrite(node.id)}>적용</button>
    <button onClick={() => { setEditText(l7Rewrite || ''); setEditing(true); }}>수정</button>
  </>
) : (
  <>
    <input value={editText} onChange={e => setEditText(e.target.value)} />
    <button onClick={() => { updateLabel(node.id, editText, 'user'); setEditing(false); }}>적용</button>
    <button onClick={() => setEditing(false)}>취소</button>
  </>
)}
```
 
### 수정 파일
- `frontend/src/components/NodeDetailPanel.tsx` — 수정 버튼 및 인라인 에디터 추가
 
---
 
## 8) 플로우 분석 추천이 "챗봇 가이드"가 그대로 셰이프에 반영되는 문제
 
### 현재 문제
- `backend/app.py:282-305` — REVIEW_SYSTEM의 suggestion에 `summary` 필드가 있음
- `store.ts:260` — applySuggestion ADD 시 `s.summary`가 그대로 셰이프 라벨이 됨
- LLM이 "~절차를 명시하세요" 같은 **지시형 문장**을 summary에 넣으면, 그게 그대로 셰이프 라벨이 됨
- REVIEW_SYSTEM 프롬프트에 "summary는 셰이프 라벨로 사용될 수 있으니 라벨 형식으로 작성" 같은 지시가 없음
 
### 솔직한 의견
이건 **프롬프트 설계 결함**이다. suggestion의 `summary`가 두 가지 역할을 하고 있다:
1. 챗봇 UI에서 제안 설명으로 표시
2. "추가" 클릭 시 셰이프 라벨로 사용
 
이 두 역할이 충돌한다. "예외 처리 절차를 명시하세요"는 설명으로는 맞지만 셰이프 라벨로는 부적절하다.
 
### 제안 구현 방안
 
**A. Suggestion 스키마에 `labelSuggestion` 필드 추가**
 
```typescript
interface Suggestion {
  action: 'ADD' | 'MODIFY' | 'DELETE';
  summary: string;          // 사용자에게 보여줄 제안 설명
  labelSuggestion?: string; // 셰이프에 실제 적용될 라벨 (L7 형식)
  ...
}
```
 
- `summary`: "예외 처리 절차를 추가하는 것이 좋겠어요" (설명형)
- `labelSuggestion`: "예외 사항을 확인한다" (L7 형식)
 
**B. 프롬프트 수정**
 
REVIEW_SYSTEM, COACH_TEMPLATE에:
```
suggestion 작성 시:
- "summary": 사용자에게 보여줄 제안 설명 (자연어)
- "labelSuggestion": 셰이프에 적용될 라벨 (L7 형식: "~한다" 반말, 단일 동작)
- summary와 labelSuggestion은 반드시 구분하세요. summary는 설명, labelSuggestion은 라벨.
```
 
**C. applySuggestion 수정**
 
```typescript
// store.ts applySuggestion ADD 부분
const label = s.labelSuggestion || s.newLabel || s.summary;
if (afterId) get().addShapeAfter(st, label, afterId);
```
 
**D. SuggestionCard에서 두 텍스트 구분 표시**
 
- summary를 제안 설명으로 보여주고
- labelSuggestion이 있으면 "셰이프 라벨: ..." 으로 별도 표시
- 적용 시 labelSuggestion 사용
 
### 수정 파일
- `frontend/src/types.ts` — Suggestion에 `labelSuggestion` 추가
- `backend/app.py` — REVIEW_SYSTEM, COACH_TEMPLATE, CONTEXTUAL_SUGGEST_SYSTEM 프롬프트 수정
- `frontend/src/store.ts` — applySuggestion 로직 수정
- `frontend/src/components/SuggestionCard.tsx` — 라벨 미리보기 표시
 
---
 
## 우선순위 요약
 
| # | 이슈 | 긴급도 | 난이도 | 비고 |
|---|------|--------|--------|------|
| 3 | L7 가이드라인 맹점 | **최고** | 높음 | friendlyTag 버그 즉시 수정 필요 |
| 8 | 가이드→셰이프 혼입 | **높음** | 중간 | 프롬프트 + 스키마 변경 |
| 4 | 복합문 분리 가이드 | **높음** | 중간 | 3번과 연동 |
| 1 | 대기 UX 개선 | 중간 | 낮음 | 초 카운터 제거만으로도 효과 |
| 6 | 어색한 인사말 제거 | 중간 | 낮음 | 텍스트 수정만 |
| 7 | 수정 버튼 추가 | 중간 | 낮음 | 기능 누락 보완 |
| 5 | 하위공정→L6 이름변경 | 낮음 | 낮음 | 단순 텍스트 변경 |
| 2 | 스윔레인 고정 | 낮음 | **높음** | ReactFlow 구조 변경 필요 |