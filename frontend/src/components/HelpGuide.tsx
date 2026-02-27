import React, { useState } from 'react';

interface Props { onClose: () => void; }

const tabs = [
  { id: 'basic', label: '기본 사용법', icon: '📖' },
  { id: 'advanced', label: '고급 기능', icon: '⚡' },
  { id: 'shortcuts', label: '단축키', icon: '⌨️' },
];

const content: Record<string, { title: string; desc: string }[]> = {
  basic: [
    { title: '셰이프 추가', desc: '캔버스 빈 공간에서 우클릭 → 원하는 셰이프 선택 → 이름 입력' },
    { title: '셰이프 연결', desc: '셰이프 가장자리의 파란 점(핸들)을 드래그하여 다른 셰이프에 놓기. 상하좌우 4방향 모두 가능.' },
    { title: '이름 편집', desc: '셰이프 더블클릭으로 인라인 편집. 또는 우클릭 → 이름 변경.' },
    { title: '엣지 라벨', desc: '연결선 더블클릭으로 라벨 입력 (예: "적격", "부적격").' },
    { title: '인풋/아웃풋', desc: '셰이프 우클릭 → 📋 인풋/아웃풋 → 모달에서 3개 필드 한번에 입력.' },
    { title: '삭제', desc: '셰이프 또는 연결선 우클릭 → 삭제. 셰이프 삭제 시 연결선 자동 재연결.' },
    { title: '병렬(+) 게이트웨이', desc: '병렬로 동시에 실행되는 흐름을 표현. ⊕ 셰이프로 분기(Split)하고, 같은 ⊕ 셰이프로 합류(Join). Split/Join은 반드시 쌍으로 사용하세요.' },
    { title: 'AI 챗봇', desc: '좌측 패널에서 질문 입력. "빠진 단계 있을까?", "예외 케이스는?" 등.' },
    { title: '저장', desc: 'Ctrl+S 또는 💾 버튼. 30초 무조작 시 자동저장.' },
  ],
  advanced: [
    { title: '역할 구분선', desc: '툴바 🏊 레인 → 레인 추가. 역할별 영역 구분. 노드를 드래그하면 자동으로 해당 레인에 소속.' },
    { title: '분류 색상', desc: '셰이프 우클릭 → 분류 색상. As-Is / Digital Worker / SSC 이관 / 삭제 대상 / 신규 추가.' },
    { title: 'L7 자동 검증', desc: '노드 추가/수정 후 3초 뒤 자동 검증 시작. 상단 품질 대시보드에서 현황 확인.' },
    { title: '셀프 루프', desc: '셰이프에서 같은 셰이프로 연결하면 루프 화살표 자동 표시.' },
    { title: 'PDD 생성', desc: 'TO-BE 설계 모드에서 좌측 패널 상단의 📄 PDD 버튼으로 프로세스 정의서 자동 생성.' },
    { title: '다중 선택', desc: 'Shift + 클릭으로 여러 셰이프 선택. 파란 글로우 효과.' },
    { title: '가져오기/내보내기', desc: '📤 내보내기(JSON). 셋업 화면에서 📂 JSON 가져오기.' },
  ],
  shortcuts: [
    { title: 'Ctrl + S', desc: '임시 저장' },
    { title: 'Ctrl + Z', desc: '실행 취소 (Undo)' },
    { title: 'Ctrl + Shift + Z', desc: '다시 실행 (Redo)' },
    { title: 'Shift + 클릭', desc: '다중 선택' },
    { title: 'F1 또는 ?', desc: '이 도움말 열기/닫기' },
    { title: '더블클릭 (노드)', desc: '인라인 이름 편집' },
    { title: '더블클릭 (엣지)', desc: '라벨 편집' },
    { title: '우클릭 (빈 공간)', desc: '셰이프 팔레트' },
    { title: '우클릭 (노드)', desc: '편집 메뉴 + 분류 색상' },
  ],
};

export default function HelpGuide({ onClose }: Props) {
  const [tab, setTab] = useState('basic');

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-[600px] max-h-[75vh] rounded-xl overflow-hidden flex flex-col animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <h3 className="text-base font-bold text-slate-200">✏️ 드로잉 가이드</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>
        <div className="flex gap-1 px-6 pt-3">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/30 border border-transparent'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {content[tab].map((item, i) => (
            <div key={i} className="flex gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(30,41,59,0.5)' }}>
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-blue-600/20 flex items-center justify-center text-[10px] text-blue-400 font-bold mt-0.5">{i + 1}</div>
              <div>
                <div className="text-sm font-medium text-slate-200">{item.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 text-center" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <label htmlFor="help-hide-on-start" className="flex items-center justify-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input id="help-hide-on-start" name="help_hide_on_start" type="checkbox" onChange={e => { if (e.target.checked) localStorage.setItem('pm-v5-help-dismissed', '1'); }} className="rounded" />
            시작 시 자동 표시하지 않기
          </label>
        </div>
      </div>
    </div>
  );
}
