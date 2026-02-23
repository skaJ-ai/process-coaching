import React, { useState, useEffect } from 'react';

interface GuideModalProps {
  onClose: () => void;
}

const slides = [
  {
    id: 1,
    type: 'hero' as const,
    title: 'HR Process Coaching AI 안내',
    subtitle: 'AI-Native✨ 업무 프로세스 재설계를 위한 드로잉 Tool',
  },
  {
    id: 2,
    type: 'agenda' as const,
    title: 'WHY & HOW',
    items: [
      { number: '01', title: 'Phase 1. 왜 이 Tool을 써야 하는가?', subtitle: "업무 프로세스 '재설계' 이점 공유" },
      { number: '02', title: 'Phase 2. 어떻게 Tool을 써야 하는가?', subtitle: "즉시 시작하는 '실행' 가이드" },
    ],
  },
  {
    id: 3,
    type: 'problem' as const,
    title: "지금 하는 일 중 '나만이 할 수 있는 일'은 얼마나 됩니까?",
    sections: [
      { label: 'Logs', text: 'HR 담당자의 하루는 반복·단순,\n비효율 업무로 가득 차 있습니다.' },
      { icon: '🧠', label: 'HR담당자', text: "그 안에서 정작 내가 '판단'하고 '기획'하는 시간은 얼마나 될까요?" },
      { icon: '✏️', label: 'Drawing', text: '이 툴은 그 비율을 바꾸기 위해 만들어졌습니다.' },
    ],
  },
  {
    id: 4,
    type: 'value' as const,
    title: '이 Tool로 내가 얻게 되는 것은?',
    values: [
      { icon: '👁️', title: 'Visibility', desc: '내 업무 전체를 처음으로 한 눈에 봅니다.' },
      { icon: '⚖️', title: 'Autonomy', desc: "'이 단계, 꼭 내가 해야 하나?'를 스스로 판단할 수 있습니다." },
      { icon: '🎯', title: 'Focus', desc: '반복·단순·비효율 업무는 Digital Worker(AI), SSC가 맡고\n나는 고부가가치 업무에 집중합니다.' },
      { icon: '⚡', title: 'Efficiency', desc: 'AI Coaching을 통해 쉽고 빠르게, 효과적으로\n워크플로우를 분해하고 재조립할 수 있습니다.' },
    ],
  },
  {
    id: 5,
    type: 'method' as const,
    title: "기존 업무를 단순 나열하여 고치는 것이 아니라,\n'제로(0)'에서 다시 설계합니다",
    subtitle: 'AX 가속화를 위한 업무 프로세스 재설계',
    process: [
      { label: 'HR 암묵지', sublabel: '(Implicit Knowledge)', icon: '🧠' },
      { label: 'Zero Based Re-design', sublabel: '', icon: '⚙️' },
      { label: '데이터 자산화', sublabel: '(Data Assets)', icon: '📊' },
    ],
    methods: [
      { icon: '🔍', title: 'Micro Segmentation', desc: '업무 프로세스를 분해해야 비로소\n불필요한 단계가 보입니다.' },
      { icon: '⚠️', title: 'Inefficiency Detection', desc: '전체 플로우를 그려내야 비로소\n비효율을 찾아낼 수 있습니다.' },
      { icon: '⚖️', title: 'Decision Making', desc: '내가 할 것인가?, AI(SSC)에게 맡길 것인가?,\n아니면 아예 없앨 것인가?' },
    ],
  },
  {
    id: 6,
    type: 'howto' as const,
    title: '어떻게 그리는가 — 4단계로 끝납니다',
    steps: [
      { num: 1, icon: '➕', label: '단계를 추가한다' },
      { num: 2, icon: '➡️', label: '순서대로 연결한다' },
      { num: 3, icon: '◇', label: '판단 기준을 쓴다' },
      { num: 4, icon: '✨', label: 'AI 검토를 받는다' },
    ],
    note: "복잡한 프로세스 모델링 기법(BPMN)을 배울 필요가 없습니다.\n'내가 실제로 하는 일'을 순서대로 한 동작씩 적으면 됩니다.\nCoaching AI가 내용을 보완하고 빠진 단계를 찾아줍니다.",
  },
  {
    id: 7,
    type: 'tutorial' as const,
    title: 'Step 1. 단계를 추가한다 → Step 2. 순서대로 연결한다',
    steps: [
      {
        num: 1,
        title: '단계를 추가한다',
        desc: "내가 하는 동작 하나 = 셰이프 하나입니다.\n'급여를 조회한다', '결재를 요청한다'처럼 한 동작씩 넣습니다.",
      },
      {
        num: 2,
        title: '순서대로 연결한다',
        desc: '동작들을 실제 순서대로 연결합니다.\n흐름이 보이기 시작합니다.',
      },
    ],
  },
  {
    id: 8,
    type: 'tutorial' as const,
    title: 'Step 3. 판단 기준을 쓴다 → Step 4. AI 검토를 받는다',
    steps: [
      {
        num: 3,
        title: '판단 기준을 쓴다',
        desc: '분기가 있는 곳엔 "~여부", "~인가?" 형태로 판단 기준을 명시합니다.\n기준이 보여야 AI도입 또는 SSC이관 가능 여부를 판단할 수 있습니다.',
      },
      {
        num: 4,
        title: 'AI 검토를 받는다',
        desc: "'전체 흐름 검토'를 누르면 AI가 빠진 단계와 모호한 표현을 즉시 짚어줍니다.\nProcess Coaching AI와 함께 완성해나가면 됩니다.",
      },
    ],
  },
  {
    id: 9,
    type: 'tips' as const,
    title: '이것만 기억하세요',
    tips: [
      { icon: '☝️', title: 'One Shape, One Action', desc: '한 셰이프 = 한 동작입니다.\n두 가지 일을 한 칸에 넣지 마세요.' },
      { icon: '📐', title: 'Clear Criteria', desc: '판단 노드엔 명확한 기준을 씁니다.\n기준 없는 분기는 자동화가 불가능합니다.' },
      { icon: '🤖', title: 'Ask AI', desc: '막히면 챗봇에 즉시 질문하세요.\nAI가 다음 단계를 제안합니다.' },
      { icon: '🌟', title: "Don't Stress", desc: '완벽하게 그릴 필요는 없습니다.\nAI가 부족한 부분을 함께 채워줍니다.' },
    ],
  },
  {
    id: 10,
    type: 'closing' as const,
    title: '처음으로, 내 업무 전체를 내가 설계합니다',
    message: `이 도구는 단순히 업무 프로세스를 예쁘게 그리는 도구가 아닙니다.\n
지금까지 당연하게 해왔던 일들을 펼쳐놓고,
'이 일이 정말 필요한가? 내가 해야 하는가?'를 스스로 묻는 도구입니다.\n
이 질문에서 HR과 여러분의 일하는 방식이 바뀝니다.`,
  },
];

export default function GuideModal({ onClose }: GuideModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // #1 방향키 네비게이션
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentSlide(s => Math.min(s + 1, slides.length - 1));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentSlide(s => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const goNext = () => setCurrentSlide(s => Math.min(s + 1, slides.length - 1));
  const goPrev = () => setCurrentSlide(s => Math.max(s - 1, 0));

  const slide = slides[currentSlide];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[97vw] max-w-[1600px] h-[94vh] rounded-2xl flex flex-col overflow-hidden"
        style={{ background: '#0f1729', border: '1px solid rgba(148,163,184,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <h2 className="text-lg font-bold text-slate-100">툴 소개</h2>
              <p className="text-sm text-slate-500">Process Coaching AI Guide</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">← → 방향키로 이동</span>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl px-2">✕</button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 flex-shrink-0">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / slides.length) * 100}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 py-8">

          {/* ── 1. Hero ── */}
          {slide.type === 'hero' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-8xl mb-8">🤖</div>
              <h1 className="text-5xl font-bold text-slate-100 mb-4 whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.title}</h1>
              <p className="text-xl text-slate-400 whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.subtitle}</p>
            </div>
          )}

          {/* ── 2. Agenda ── */}
          {slide.type === 'agenda' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-12 text-center whitespace-pre-line">{slide.title}</h2>
              <div className="grid grid-cols-2 gap-10 max-w-5xl mx-auto">
                {slide.items.map(item => (
                  <div
                    key={item.number}
                    className="p-10 rounded-xl border transition-all hover:scale-105"
                    style={{
                      background: item.number === '01' ? 'rgba(59,130,246,0.08)' : 'rgba(251,113,133,0.08)',
                      border: item.number === '01' ? '2px solid rgba(59,130,246,0.3)' : '2px solid rgba(251,113,133,0.3)',
                    }}
                  >
                    <div className="text-7xl font-bold mb-5" style={{ color: item.number === '01' ? '#3b82f6' : '#fb7185' }}>
                      {item.number}
                    </div>
                    <h3 className="text-xl font-bold text-slate-100 mb-3 whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{item.title}</h3>
                    <p className="text-base text-slate-400 whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. Problem ── */}
          {slide.type === 'problem' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-12 text-center max-w-4xl mx-auto whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.title}</h2>
              <div className="flex items-center justify-center gap-8 max-w-6xl mx-auto">

                {/* 왼쪽: Logs — 여러 종이 겹침 */}
                <div className="flex flex-col items-center w-72 p-6 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <div className="relative w-20 h-16 mb-5">
                    <span className="absolute text-5xl" style={{ top: 8, left: 8, opacity: 0.3, transform: 'rotate(-14deg)' }}>📄</span>
                    <span className="absolute text-5xl" style={{ top: 4, left: 4, opacity: 0.55, transform: 'rotate(-7deg)' }}>📄</span>
                    <span className="absolute text-5xl" style={{ top: 0, left: 0 }}>📄</span>
                  </div>
                  <div className="text-xl font-bold text-slate-300 mb-3">{slide.sections[0].label}</div>
                  <p className="text-base text-slate-400 leading-relaxed text-center whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.sections[0].text}</p>
                </div>

                <div className="text-5xl text-blue-500/40 font-bold">→</div>

                {/* 중앙: HR담당자 */}
                <div className="flex flex-col items-center w-96 p-8 rounded-2xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-2 border-blue-500/30 shadow-xl">
                  <div className="text-8xl mb-5">{slide.sections[1].icon}</div>
                  <div className="text-2xl font-bold text-blue-100 mb-3">{slide.sections[1].label}</div>
                  <p className="text-lg text-blue-200 leading-relaxed text-center whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.sections[1].text}</p>
                </div>

                <div className="text-5xl text-blue-500/40 font-bold">→</div>

                {/* 오른쪽: Drawing */}
                <div className="flex flex-col items-center w-72 p-6 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <div className="text-6xl mb-5">{slide.sections[2].icon}</div>
                  <div className="text-xl font-bold text-slate-300 mb-3">{slide.sections[2].label}</div>
                  <p className="text-base text-slate-400 leading-relaxed text-center whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.sections[2].text}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. Value ── */}
          {slide.type === 'value' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-12 text-center" style={{ wordBreak: 'keep-all' }}>{slide.title}</h2>
              <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto">
                {slide.values.map((val, idx) => (
                  <div key={idx} className="p-8 rounded-xl border border-slate-700 bg-slate-800/30">
                    <div className="text-5xl mb-4">{val.icon}</div>
                    <h3 className="text-xl font-bold text-slate-100 mb-3">{val.title}</h3>
                    <p className="text-base text-slate-400 leading-relaxed whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{val.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 5. Method ── */}
          {slide.type === 'method' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-3 text-center max-w-4xl mx-auto whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.title}</h2>
              <p className="text-base text-slate-500 mb-10 text-center whitespace-pre-line">{slide.subtitle}</p>
              {/* #5 process 박스에 큰 아이콘 추가 */}
              <div className="flex items-center justify-center gap-6 mb-10">
                {slide.process.map((p, idx) => (
                  <React.Fragment key={idx}>
                    <div className="text-center">
                      <div className="px-8 py-5 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 shadow-lg">
                        {p.label.includes('HR 암묵지') ? (
                          <div className="flex justify-center mb-2">
                            {/* 엉킨 실타래 SVG */}
                            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                              <circle cx="24" cy="24" r="19" fill="rgba(251,146,60,0.12)" stroke="rgba(251,146,60,0.35)" strokeWidth="1.5"/>
                              {/* 외곽 큰 코일 */}
                              <path d="M7 20 C12 8,30 6,35 16 C40 26,34 40,22 42 C10 44,4 32,8 22 C12 12,26 10,32 18 C38 26,36 38,24 40" stroke="#fb923c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                              {/* 교차 실 */}
                              <path d="M38 18 C30 6,14 8,10 18 C6 28,12 42,24 42 C36 42,44 30,40 20" stroke="#fdba74" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65"/>
                              {/* 내부 꼬임 */}
                              <path d="M14 28 C16 22,24 20,28 26 C32 32,28 38,22 36" stroke="#c2410c" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
                              {/* 추가 교차선 */}
                              <path d="M18 10 C28 14,34 22,26 30 C18 38,10 34,12 24" stroke="#fb923c" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.45"/>
                              {/* 중심 매듭 */}
                              <circle cx="24" cy="24" r="2.5" fill="#fb923c"/>
                            </svg>
                          </div>
                        ) : (
                          <div className="text-4xl mb-2">{p.icon}</div>
                        )}
                        <div className="font-bold text-slate-100 text-base" style={{ wordBreak: 'keep-all' }}>{p.label}</div>
                        {p.sublabel && <div className="text-sm text-slate-500 mt-1">{p.sublabel}</div>}
                      </div>
                    </div>
                    {idx < slide.process.length - 1 && <div className="text-4xl text-slate-500 font-bold">→</div>}
                  </React.Fragment>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-6 max-w-6xl mx-auto">
                {slide.methods.map((m, idx) => (
                  <div key={idx} className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="text-4xl mb-3">{m.icon}</div>
                    <h4 className="text-base font-bold text-slate-200 mb-2">{m.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. Howto ── */}
          {slide.type === 'howto' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-12 text-center" style={{ wordBreak: 'keep-all' }}>{slide.title}</h2>
              <div className="flex items-center justify-center gap-4 mb-10">
                {slide.steps.map((s, idx) => (
                  <React.Fragment key={s.num}>
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-3xl mb-3">
                        {s.icon}
                      </div>
                      <div className="text-base font-medium text-slate-300 text-center max-w-[140px]" style={{ wordBreak: 'keep-all' }}>{s.label}</div>
                    </div>
                    {idx < slide.steps.length - 1 && <div className="text-3xl text-slate-600 mb-6">→</div>}
                  </React.Fragment>
                ))}
              </div>
              <div className="max-w-3xl mx-auto p-8 rounded-xl bg-slate-800/40 border border-slate-700">
                <p className="text-base text-slate-300 leading-relaxed text-center whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{slide.note}</p>
              </div>
            </div>
          )}

          {/* ── 7 & 8. Tutorial ── */}
          {slide.type === 'tutorial' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-3xl font-bold text-slate-100 mb-8 text-center" style={{ wordBreak: 'keep-all' }}>{slide.title}</h2>
              <div className="grid grid-cols-2 gap-10 max-w-6xl mx-auto">
                {slide.steps.map(s => (
                  <div key={s.num} className="flex flex-col">
                    <div className="mb-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                        {s.num}
                      </div>
                      <h3 className="text-xl font-bold text-slate-100" style={{ wordBreak: 'keep-all' }}>{s.title}</h3>
                    </div>
                    <p className="text-base text-slate-400 leading-relaxed mb-5 whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{s.desc}</p>
                    <div className="flex-1 min-h-[300px] rounded-xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 border-2 border-slate-700/50 shadow-inner overflow-hidden">

                      {/* Step 1: 셰이프 추가 */}
                      {s.num === 1 && (
                        <svg viewBox="0 0 400 260" className="w-full h-full">
                          <defs>
                            <pattern id="dots1" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="2" cy="2" r="1" fill="#1e293b"/>
                            </pattern>
                            <marker id="arr1" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                              <polygon points="0 0, 6 3, 0 6" fill="#475569"/>
                            </marker>
                          </defs>
                          <rect width="400" height="260" fill="#0f172a" rx="8"/>
                          <rect width="400" height="260" fill="url(#dots1)" opacity="0.3"/>
                          {/* Start */}
                          <circle cx="200" cy="36" r="18" fill="none" stroke="#22c55e" strokeWidth="2"/>
                          <text x="200" y="41" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="600">시작</text>
                          {/* Arrow */}
                          <line x1="200" y1="54" x2="200" y2="82" stroke="#475569" strokeWidth="1.5" markerEnd="url(#arr1)"/>
                          {/* P1 */}
                          <rect x="110" y="82" width="180" height="46" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2"/>
                          <text x="200" y="110" textAnchor="middle" fill="#93c5fd" fontSize="13" fontWeight="500">요청서를 접수한다</text>
                          {/* P2 (dashed, being added) */}
                          <rect x="110" y="166" width="180" height="46" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 3" opacity="0.5"/>
                          <text x="200" y="194" textAnchor="middle" fill="#93c5fd" fontSize="13" fontWeight="500" opacity="0.5">요청 요건을 확인한다</text>
                          {/* Hand cursor */}
                          <circle cx="320" cy="195" r="18" fill="#8b5cf6" opacity="0.15"/>
                          <text x="320" y="203" textAnchor="middle" fill="#a78bfa" fontSize="22">👆</text>
                        </svg>
                      )}

                      {/* Step 2: 연결 */}
                      {s.num === 2 && (
                        <svg viewBox="0 0 400 260" className="w-full h-full">
                          <defs>
                            <pattern id="dots2" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="2" cy="2" r="1" fill="#1e293b"/>
                            </pattern>
                            <marker id="arr2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                              <polygon points="0 0, 6 3, 0 6" fill="#3b82f6"/>
                            </marker>
                          </defs>
                          <rect width="400" height="260" fill="#0f172a" rx="8"/>
                          <rect width="400" height="260" fill="url(#dots2)" opacity="0.3"/>
                          {/* P1 */}
                          <rect x="110" y="22" width="180" height="46" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2"/>
                          <text x="200" y="50" textAnchor="middle" fill="#93c5fd" fontSize="13" fontWeight="500">요청서를 접수한다</text>
                          {/* Arrow */}
                          <line x1="200" y1="68" x2="200" y2="94" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr2)"/>
                          {/* P2 */}
                          <rect x="110" y="94" width="180" height="46" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2"/>
                          <text x="200" y="122" textAnchor="middle" fill="#93c5fd" fontSize="13" fontWeight="500">요청 요건을 확인한다</text>
                          {/* Arrow */}
                          <line x1="200" y1="140" x2="200" y2="166" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr2)"/>
                          {/* P3 */}
                          <rect x="110" y="166" width="180" height="46" rx="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2"/>
                          <text x="200" y="194" textAnchor="middle" fill="#93c5fd" fontSize="13" fontWeight="500">처리 결과를 안내한다</text>
                          {/* 흐름 완성 badge */}
                          <text x="318" y="122" fill="#a78bfa" fontSize="18">✓</text>
                          <text x="308" y="140" fill="#94a3b8" fontSize="11">흐름 완성</text>
                        </svg>
                      )}

                      {/* Step 3: 판단 기준 — 다이어그램 왼쪽 이동 + 아니오 간격 확보 */}
                      {s.num === 3 && (
                        <svg viewBox="0 0 400 260" className="w-full h-full">
                          <defs>
                            <pattern id="dots3" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="2" cy="2" r="1" fill="#1e293b"/>
                            </pattern>
                            <marker id="arr3" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                              <polygon points="0 0, 6 3, 0 6" fill="#3b82f6"/>
                            </marker>
                          </defs>
                          <rect width="400" height="260" fill="#0f172a" rx="8"/>
                          <rect width="400" height="260" fill="url(#dots3)" opacity="0.3"/>
                          {/* Process: 요청 요건을 확인한다 — 중심 x=130으로 이동 */}
                          <rect x="50" y="12" width="160" height="40" rx="7" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2"/>
                          <text x="130" y="37" textAnchor="middle" fill="#93c5fd" fontSize="12" fontWeight="500">요청 요건을 확인한다</text>
                          {/* Arrow down */}
                          <line x1="130" y1="52" x2="130" y2="72" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr3)"/>
                          {/* Diamond: 승인 여부 — center (130,110), right point (190,110) */}
                          <polygon points="130,72 190,110 130,148 70,110" fill="#2d1a0f" stroke="#f59e0b" strokeWidth="2"/>
                          <text x="130" y="115" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="600">승인 여부</text>
                          {/* Arrow Yes (down) */}
                          <line x1="130" y1="148" x2="130" y2="170" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr3)"/>
                          <text x="138" y="163" fill="#22c55e" fontSize="10" fontWeight="600">예</text>
                          {/* Yes node */}
                          <rect x="50" y="170" width="160" height="40" rx="7" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2"/>
                          <text x="130" y="195" textAnchor="middle" fill="#93c5fd" fontSize="12">요청서를 승인한다</text>
                          {/* Arrow No (right) — 50px 간격으로 엣지 명확히 표시 */}
                          <line x1="190" y1="110" x2="238" y2="110" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr3)"/>
                          <text x="198" y="103" fill="#f87171" fontSize="10" fontWeight="600">아니오</text>
                          {/* No node — 충분한 너비 확보 */}
                          <rect x="240" y="89" width="152" height="42" rx="7" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2"/>
                          <text x="316" y="115" textAnchor="middle" fill="#93c5fd" fontSize="11">요청서를 반려한다</text>
                        </svg>
                      )}

                      {/* Step 4: AI 검토 */}
                      {s.num === 4 && (
                        <svg viewBox="0 0 400 260" className="w-full h-full">
                          <defs>
                            <marker id="arr4" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                              <polygon points="0 0, 5 2.5, 0 5" fill="#3b82f6"/>
                            </marker>
                          </defs>
                          <rect width="400" height="260" fill="#0f172a" rx="8"/>
                          {/* Chat panel */}
                          <rect x="218" y="18" width="164" height="210" rx="8" fill="#1a1f2e" stroke="#475569" strokeWidth="1.5"/>
                          <rect x="218" y="18" width="164" height="30" rx="8" fill="#334155"/>
                          <rect x="218" y="36" width="164" height="12" fill="#334155"/>
                          <text x="300" y="38" textAnchor="middle" fill="#cbd5e1" fontSize="12" fontWeight="600">💬 AI 코치</text>
                          {/* Chat messages */}
                          <rect x="228" y="58" width="144" height="36" rx="6" fill="#3b82f6" opacity="0.18"/>
                          <text x="238" y="73" fill="#93c5fd" fontSize="9">전체 흐름을 검토했습니다.</text>
                          <text x="238" y="86" fill="#93c5fd" fontSize="9">빠진 단계가 있어요 👇</text>
                          <rect x="228" y="100" width="144" height="26" rx="6" fill="#8b5cf6" opacity="0.18"/>
                          <text x="238" y="113" fill="#c4b5fd" fontSize="8">"승인 후 결과 통보" 단계를</text>
                          <text x="238" y="123" fill="#c4b5fd" fontSize="8">추가해 볼까요?</text>
                          <rect x="228" y="132" width="144" height="20" rx="6" fill="#f59e0b" opacity="0.18"/>
                          <text x="238" y="146" fill="#fbbf24" fontSize="8">⚠️ 모호한 표현을 발견했어요.</text>
                          {/* Mini flow */}
                          <rect x="18" y="56" width="126" height="30" rx="5" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1.5"/>
                          <text x="81" y="76" textAnchor="middle" fill="#93c5fd" fontSize="10">요청서를 접수한다</text>
                          <line x1="81" y1="86" x2="81" y2="100" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arr4)"/>
                          <rect x="18" y="100" width="126" height="30" rx="5" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1.5"/>
                          <text x="81" y="120" textAnchor="middle" fill="#93c5fd" fontSize="10">요청 요건을 확인한다</text>
                          <line x1="81" y1="130" x2="81" y2="144" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arr4)"/>
                          <polygon points="81,144 115,164 81,184 47,164" fill="#2d1a0f" stroke="#f59e0b" strokeWidth="1.5"/>
                          <text x="81" y="169" textAnchor="middle" fill="#fbbf24" fontSize="9">승인 여부</text>
                          {/* check */}
                          <circle cx="180" cy="140" r="14" fill="#22c55e" opacity="0.15"/>
                          <text x="180" y="146" textAnchor="middle" fill="#22c55e" fontSize="16">✓</text>
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 9. Tips ── */}
          {slide.type === 'tips' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-12 text-center">{slide.title}</h2>
              <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto">
                {slide.tips.map((tip, idx) => (
                  <div key={idx} className="p-8 rounded-xl border border-green-700/30 bg-green-900/10">
                    {/* #8 체크박스 대신 적합한 이모지 */}
                    <div className="text-5xl mb-4">{tip.icon}</div>
                    <h3 className="text-xl font-bold text-green-300 mb-3">{tip.title}</h3>
                    <p className="text-base text-slate-400 leading-relaxed whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 10. Closing ── */}
          {slide.type === 'closing' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h1 className="text-5xl font-bold text-slate-100 mb-10" style={{ wordBreak: 'keep-all' }}>{slide.title}</h1>
              <p className="text-xl text-slate-300 leading-relaxed max-w-4xl whitespace-pre-line mb-16" style={{ wordBreak: 'keep-all' }}>{slide.message}</p>
              <button
                onClick={onClose}
                className="px-12 py-5 rounded-xl text-xl font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', boxShadow: '0 8px 32px rgba(37,99,235,0.4)' }}
              >
                🚀 HR AX를 위한 '발자취' 남기러 가기
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-800 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={currentSlide === 0}
            className="px-5 py-2.5 rounded-lg text-base font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
          >
            ← 이전
          </button>
          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className="rounded-full transition-all"
                style={{ width: i === currentSlide ? 20 : 7, height: 7, background: i === currentSlide ? '#3b82f6' : '#334155' }}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={currentSlide === slides.length - 1}
            className="px-5 py-2.5 rounded-lg text-base font-medium disabled:opacity-30 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
          >
            다음 →
          </button>
        </div>
      </div>
    </div>
  );
}
