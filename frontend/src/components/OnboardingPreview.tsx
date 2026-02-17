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
      title: '1. Add a node',
      desc: 'Right click empty canvas and create your first process node.'
    },
    {
      done: nonStartNodes.length >= 2,
      title: '2. Add one more node',
      desc: 'Create one additional node so that you can connect a flow.'
    },
    {
      done: edges.length >= 1,
      title: '3. Connect nodes',
      desc: 'Drag from source handle to target node to create one edge.'
    },
    {
      done: decisions.length === 0 ? false : hasLabeledDecision,
      title: '4. Label a decision edge',
      desc: 'If you add a decision, set edge labels such as Yes / No.'
    },
    {
      done: saveStatus !== 'unsaved',
      title: '5. Save draft',
      desc: 'Press Ctrl+S once to confirm save flow and keyboard shortcut.'
    }
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="absolute inset-0 z-[1200] flex items-start justify-center pt-16 pointer-events-none">
      <div
        className="w-[560px] rounded-2xl border shadow-2xl pointer-events-auto"
        style={{
          borderColor: 'rgba(148,163,184,0.35)',
          background:
            'linear-gradient(165deg, rgba(8,47,73,0.95) 0%, rgba(15,23,42,0.96) 48%, rgba(30,41,59,0.96) 100%)'
        }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(148,163,184,0.25)' }}>
          <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">Preview Onboarding</div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">Tool Usage Drill (Sample)</h3>
          <p className="text-xs text-slate-300 mt-1">
            This is a UI mock for onboarding flow. It focuses on tool operation, not domain template quality.
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Progress</span>
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
          <div className="text-xs text-slate-400">F1 opens the existing help guide.</div>
          <div className="flex items-center gap-2">
            <button
              onClick={hide}
              className="px-3 py-1.5 rounded-lg text-xs border text-slate-300 hover:bg-slate-700/45"
              style={{ borderColor: 'rgba(148,163,184,0.4)' }}
            >
              Close
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(90deg,#0ea5e9,#2563eb)' }}
            >
              Do not show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

