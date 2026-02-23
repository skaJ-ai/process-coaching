import React, { useState } from 'react';

interface GuideModalProps {
  onClose: () => void;
}

const slides = [
  {
    id: 1,
    type: 'hero' as const,
    title: 'HR Process Coaching AI 안내',
    subtitle: 'HR 업무 프로세스 재설계를 위한 드로잉 Tool',
  },
  {
    id: 2,
    type: 'agenda' as const,
    title: '오늘 다룰 두 가지 핵심 질문',
    items: [
      { number: '01', title: 'Phase 1. 왜 이 툴을 써야 하는가?', subtitle: "업무의 '난독'과 '각지'" },
      { number: '02', title: 'Phase 2. 어떻게 쓰는가?', subtitle: "즉시 시작하는 '실행' 가이드" },
    ],
  },
  {
    id: 3,
    type: 'problem' as const,
    title: "지금 하는 일 중, '나만이 할 수 있는 일'은 얼마나 됩니까?",
    sections: [
      { icon: '📄', label: 'Logs', text: 'HR 담당자의 하루는 반복/단순/비효율 업무로 가득 차 있습니다.' },
      { icon: '🧠', label: '사람', text: "그 안에서 정작 내가 '만약하고 기획'하는 시간은 얼마나 될까요?" },
      { icon: '✏️', label: 'Drawing', text: '이 툴은 그 비율을 바꾸기 위해 만들어졌습니다.' },
    ],
  },
  {
    id: 4,
    type: 'value' as const,
    title: '이 툴로 내가 얻게 되는 것',
    values: [
      { icon: '👁️', title: 'Visibility', desc: '내 업무 전체를 처음으로 한 눈에 봅니다.' },
      { icon: '⚖️', title: 'Autonomy', desc: "'이 단계, 내가 해야 하나?' 스스로 판단할 수 있습니다." },
      { icon: '🎯', title: 'Focus', desc: '반복/단순/비효율 업무는 AI, SSC가 맡고,\n나는 고부가가치 업무에 집중합니다.' },
      { icon: '⚡', title: 'Efficiency', desc: 'AI 코칭을 통해 쉽고 빠르게 워크 플로우를 정리할 수 있습니다.' },
    ],
  },
  {
    id: 5,
    type: 'method' as const,
    title: "기존 업무를 고치는 것이 아니라, '제로(0)'에서 다시 설계합니다",
    subtitle: 'Modern Engineering Blueprint',
    process: [
      { label: 'HR 암묵지', sublabel: '(Implicit Knowledge)' },
      { label: 'Zero Based\nRe-design', sublabel: '' },
      { label: '데이터 자산', sublabel: '(Data Assets)' },
    ],
    methods: [
      { icon: '🔍', title: 'Micro Segmentation', desc: '업무 프로세스를 동작단위 바로스 분할/모잘 단계로 만듭니다.' },
      { icon: '⚠️', title: 'Inefficiency Detection', desc: '신지 불필요한 구간단위 비효율을 찾아낸 겁니다.' },
      { icon: '⚖️', title: 'Decision Making', desc: '각 조업의 구역 단위:\n내가 할 것인가 / AI(SSC)에게 맡길 것인가' },
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
    note: "복잡한 프로세스 모델링 기법(BPMN)을 배울 필요가 없습니다.\n'내가 실제로 하는 일'을 순서대로 한 동작씩 적으면 됩니다.\nCoaching AI가 정석을 보완하고, 빠진 단계를 찾아줍니다.",
  },
  {
    id: 7,
    type: 'tutorial' as const,
    title: 'Step 1. 단계를 추가한다 → Step 2. 순서대로 연결한다',
    steps: [
      {
        num: 1,
        title: '단계를 추가한다',
        desc: "내가 하는 동작 하나 = 셰이프 하나.\n'급여를 조회한다', '결재를 요청한다' 처럼 한 동작씩 넣습니다.",
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
        desc: '분기가 있는 곳엔 "~여부", "~인가?" 형태로 판단 기준을 명시합니다.\n기준이 보여야 자동화 가능 여부를 판단할 수 있습니다.',
      },
      {
        num: 4,
        title: 'AI 검토를 받는다',
        desc: "'전체 흐름 검토'를 누르면 AI가 빠진 단계와 모호한 표현을 즉시 짚어줍니다.",
      },
    ],
  },
  {
    id: 9,
    type: 'tips' as const,
    title: '이것만 기억하세요',
    tips: [
      {
        icon: '✅',
        title: 'One Shape, One Action',
        desc: '한 셰이프 = 한 동작\n(두 가지 일을 한 칸에 넣지 마세요).',
      },
      {
        icon: '✅',
        title: 'Clear Criteria',
        desc: '판단 노드엔 명확한 기준을 쓰니다.\n기준 없는 분기는 자동화가 불가능합니다.',
      },
      {
        icon: '✅',
        title: 'Ask AI',
        desc: '막히면 챗봇에 즉시 질문하세요.\nAI가 다음 단계를 제안합니다.',
      },
      {
        icon: '✅',
        title: "Don't Stress",
        desc: '완벽하게 그릴 필요 없습니다.\nAI가 부족한 부분을 함께 채워줍니다.',
      },
    ],
  },
  {
    id: 10,
    type: 'closing' as const,
    title: '처음으로, 내 업무 전체를 내가 설계합니다',
    message: `이 도구는 그림을 예쁘게 그리는 도구가 아닙니다.
지금까지 당연하게 해왔던 일들을 펼쳐놓고,
'이 일이 정말 필요한가? 내가 해야 하는가?'를 스스로 묻는 도구입니다.
이 질문에서 HR의 일하는 방식이 바뀝니다.`,
  },
];

export default function GuideModal({ onClose }: GuideModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const goNext = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
  };

  const goPrev = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  const slide = slides[currentSlide];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[95vw] max-w-[1400px] h-[90vh] rounded-2xl flex flex-col overflow-hidden"
        style={{ background: '#0f1729', border: '1px solid rgba(148,163,184,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <h2 className="text-base font-bold text-slate-100">툴 소개</h2>
              <p className="text-xs text-slate-500">Process Coaching AI Guide</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl px-2">✕</button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 flex-shrink-0">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / slides.length) * 100}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {slide.type === 'hero' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-8xl mb-8">🤖</div>
              <h1 className="text-5xl font-bold text-slate-100 mb-4">{slide.title}</h1>
              <p className="text-2xl text-slate-400">{slide.subtitle}</p>
            </div>
          )}

          {slide.type === 'agenda' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-16 text-center">{slide.title}</h2>
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
                    <div
                      className="text-7xl font-bold mb-5"
                      style={{ color: item.number === '01' ? '#3b82f6' : '#fb7185' }}
                    >
                      {item.number}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-3">{item.title}</h3>
                    <p className="text-lg text-slate-400">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === 'problem' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-16 text-center max-w-4xl mx-auto">{slide.title}</h2>
              <div className="flex items-center justify-center gap-8 max-w-6xl mx-auto">
                {/* 왼쪽: Logs */}
                <div className="flex flex-col items-center w-64 opacity-60">
                  <div className="text-5xl mb-4">{slide.sections[0].icon}</div>
                  <div className="text-lg font-bold text-slate-400 mb-2">{slide.sections[0].label}</div>
                  <p className="text-sm text-slate-500 leading-relaxed text-center">{slide.sections[0].text}</p>
                </div>

                {/* 화살표 */}
                <div className="text-5xl text-slate-600">→</div>

                {/* 중앙: 사람 (크게) */}
                <div className="flex flex-col items-center w-80">
                  <div className="text-8xl mb-6">{slide.sections[1].icon}</div>
                  <div className="text-2xl font-bold text-slate-200 mb-3">{slide.sections[1].label}</div>
                  <p className="text-base text-slate-300 leading-relaxed text-center">{slide.sections[1].text}</p>
                </div>

                {/* 화살표 */}
                <div className="text-5xl text-slate-600">→</div>

                {/* 오른쪽: Drawing */}
                <div className="flex flex-col items-center w-64 opacity-60">
                  <div className="text-5xl mb-4">{slide.sections[2].icon}</div>
                  <div className="text-lg font-bold text-slate-400 mb-2">{slide.sections[2].label}</div>
                  <p className="text-sm text-slate-500 leading-relaxed text-center">{slide.sections[2].text}</p>
                </div>
              </div>
            </div>
          )}

          {slide.type === 'value' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-16 text-center">{slide.title}</h2>
              <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto">
                {slide.values.map((val, idx) => (
                  <div key={idx} className="p-8 rounded-xl border border-slate-700 bg-slate-800/30">
                    <div className="text-5xl mb-4">{val.icon}</div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-3">{val.title}</h3>
                    <p className="text-base text-slate-400 leading-relaxed whitespace-pre-line">{val.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === 'method' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-3xl font-bold text-slate-100 mb-3 text-center max-w-4xl mx-auto">{slide.title}</h2>
              <p className="text-base text-slate-500 mb-12 text-center">{slide.subtitle}</p>
              <div className="flex items-center justify-center gap-6 mb-12">
                {slide.process.map((p, idx) => (
                  <React.Fragment key={idx}>
                    <div className="text-center">
                      <div className="px-8 py-6 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 shadow-lg">
                        <div className="font-bold text-slate-100 text-lg whitespace-pre-line">{p.label}</div>
                        <div className="text-sm text-slate-500 mt-2">{p.sublabel}</div>
                      </div>
                    </div>
                    {idx < slide.process.length - 1 && <div className="text-5xl text-slate-500 font-bold">→</div>}
                  </React.Fragment>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-6 max-w-6xl mx-auto">
                {slide.methods.map((m, idx) => (
                  <div key={idx} className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="text-4xl mb-3">{m.icon}</div>
                    <h4 className="text-base font-bold text-slate-200 mb-2">{m.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === 'howto' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-12 text-center">{slide.title}</h2>
              <div className="flex items-center justify-center gap-4 mb-10">
                {slide.steps.map((s, idx) => (
                  <React.Fragment key={s.num}>
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-3xl mb-3">
                        {s.icon}
                      </div>
                      <div className="text-sm font-medium text-slate-300 text-center max-w-[120px]">{s.label}</div>
                    </div>
                    {idx < slide.steps.length - 1 && <div className="text-3xl text-slate-600 mb-6">→</div>}
                  </React.Fragment>
                ))}
              </div>
              <div className="max-w-3xl mx-auto p-8 rounded-xl bg-slate-800/40 border border-slate-700">
                <p className="text-base text-slate-300 leading-relaxed whitespace-pre-line text-center">{slide.note}</p>
              </div>
            </div>
          )}

          {slide.type === 'tutorial' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-3xl font-bold text-slate-100 mb-10 text-center">{slide.title}</h2>
              <div className="grid grid-cols-2 gap-10 max-w-6xl mx-auto">
                {slide.steps.map(s => (
                  <div key={s.num} className="flex flex-col">
                    <div className="mb-5 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-white font-bold text-xl">
                        {s.num}
                      </div>
                      <h3 className="text-xl font-bold text-slate-100">{s.title}</h3>
                    </div>
                    <p className="text-base text-slate-400 leading-relaxed whitespace-pre-line mb-5">{s.desc}</p>
                    <div className="flex-1 min-h-[280px] rounded-xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 border-2 border-slate-700/50 flex items-center justify-center text-slate-500 text-base shadow-inner">
                      <div className="text-center">
                        <div className="text-4xl mb-3">📸</div>
                        <div>UI 스크린샷 영역</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === 'tips' && (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-4xl font-bold text-slate-100 mb-16 text-center">{slide.title}</h2>
              <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto">
                {slide.tips.map((tip, idx) => (
                  <div key={idx} className="p-8 rounded-xl border border-green-700/30 bg-green-900/10">
                    <div className="text-5xl mb-4">{tip.icon}</div>
                    <h3 className="text-2xl font-bold text-green-300 mb-3">{tip.title}</h3>
                    <p className="text-base text-slate-400 leading-relaxed whitespace-pre-line">{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide.type === 'closing' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h1 className="text-5xl font-bold text-slate-100 mb-10">{slide.title}</h1>
              <p className="text-2xl text-slate-300 leading-relaxed max-w-4xl whitespace-pre-line mb-16">{slide.message}</p>
              <button
                onClick={onClose}
                className="px-12 py-5 rounded-xl text-xl font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', boxShadow: '0 8px 32px rgba(37,99,235,0.4)' }}
              >
                🚀 지금 시작하기
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={currentSlide === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
          >
            ← 이전
          </button>
          <div className="text-xs text-slate-500">
            {currentSlide + 1} / {slides.length}
          </div>
          <button
            onClick={goNext}
            disabled={currentSlide === slides.length - 1}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
          >
            다음 →
          </button>
        </div>
      </div>
    </div>
  );
}
