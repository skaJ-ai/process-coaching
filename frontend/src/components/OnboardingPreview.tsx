import React from 'react';
import { useStore } from '../store';

function Item({ done, title, desc }: { done: boolean; title: string; desc: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 border"
      style={{
        borderColor: done ? 'rgba(34,197,94,0.5)' : 'rgba(148,163,184,0.25)',
        background: done ? 'rgba(34,197,94,0.10)' : 'rgba(15,23,42,0.65)'
      }}
    >
      <div className="text-sm font-semibold flex items-center gap-2">
        <span
          className="inline-flex w-5 h-5 rounded-full items-center justify-center text-[11px]"
          style={{
            background: done ? 'rgba(34,197,94,0.22)' : 'rgba(148,163,184,0.18)',
            color: done ? '#86efac' : '#cbd5e1'
          }}
        >
          {done ? 'OK' : '...'}
        </span>
        <span style={{ color: done ? '#dcfce7' : '#e2e8f0' }}>{title}</span>
      </div>
      <p className="text-xs mt-1" style={{ color: done ? '#bbf7d0' : '#94a3b8' }}>
        {desc}
      </p>
    </div>
  );
}

export default function OnboardingPreview() {
  const show = useStore((s) => s.showOnboarding);
  const hide = useStore((s) => s.hideOnboarding);
  const dismiss = useStore((s) => s.dismissOnboarding);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const saveStatus = useStore((s) => s.saveStatus);

  if (!show) return null;

  const nonStartNodes = nodes.filter((n) => n.data.nodeType !== 'start');
  const decisions = nodes.filter((n) => n.data.nodeType === 'decision');
  const hasLabeledDecision = decisions.some((d) => edges.some((e) => e.source === d.id && !!e.label));

  const steps = [
    {
      done: nonStartNodes.length >= 1,
      title: '1. 노드 1개 추가',
      desc: '빈 캔버스에서 우클릭 후 첫 프로세스 노드를 추가해 보세요.'
    },
    {
      done: nonStartNodes.length >= 2,
      title: '2. 노드 하나 더 추가',
      desc: '흐름 연결을 위해 노드를 1개 더 만들어 주세요.'
    },
    {
      done: edges.length >= 1,
      title: '3. 노드 연결',
      desc: '노드 핸들을 드래그해서 연결선(엣지)을 1개 생성하세요.'
    },
    {
      done: decisions.length === 0 ? false : hasLabeledDecision,
      title: '4. 분기 라벨 입력',
      desc: 'Decision 노드를 썼다면 연결선 라벨(예/아니오 등)을 입력하세요.'
    },
    {
      done: saveStatus !== 'unsaved',
      title: '5. 저장 실행',
      desc: 'Ctrl+S를 눌러 저장이 동작하는지 확인하세요.'
    }
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="absolute top-20 right-4 z-[1200] pointer-events-none">
      <div
        className="w-[380px] rounded-2xl border shadow-2xl pointer-events-auto"
        style={{
          borderColor: 'rgba(148,163,184,0.35)',
          background:
            'linear-gradient(165deg, rgba(8,47,73,0.95) 0%, rgba(15,23,42,0.96) 48%, rgba(30,41,59,0.96) 100%)'
        }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(148,163,184,0.25)' }}>
          <div className="text-[11px] tracking-[0.16em] text-cyan-300">온보딩 미리보기</div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">툴 사용법 연습</h3>
          <p className="text-xs text-slate-300 mt-1">
            도메인 추천이 아니라 조작법 숙련에 집중한 예시 화면입니다.
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>진행률</span>
              <span>{doneCount} / {steps.length} ({progress}%)</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#22d3ee,#22c55e)' }}
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-2">
          {steps.map((s) => (
            <Item key={s.title} done={s.done} title={s.title} desc={s.desc} />
          ))}
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(148,163,184,0.25)' }}>
          <div className="text-xs text-slate-400">도움말은 F1에서 열 수 있습니다.</div>
          <div className="flex items-center gap-2">
            <button
              onClick={hide}
              className="px-3 py-1.5 rounded-lg text-xs border text-slate-300 hover:bg-slate-700/45"
              style={{ borderColor: 'rgba(148,163,184,0.4)' }}
            >
              닫기
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(90deg,#0ea5e9,#2563eb)' }}
            >
              다시 보지 않기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
