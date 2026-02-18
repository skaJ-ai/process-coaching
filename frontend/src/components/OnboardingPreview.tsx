import React from 'react';
import { Connection } from 'reactflow';
import { useStore } from '../store';

type DemoItem = {
  id: string;
  label: string;
  file: string;
  hint: string;
  action: string;
};

const DEMOS: DemoItem[] = [
  {
    id: 'add',
    label: '노드 추가',
    file: '01-add-node.gif',
    hint: '캔버스 빈 공간을 우클릭하고 Process 또는 Decision을 선택합니다.',
    action: '우클릭 -> 노드 타입 선택'
  },
  {
    id: 'connect',
    label: '연결 만들기',
    file: '02-connect-nodes.gif',
    hint: '노드 오른쪽 핸들을 드래그해서 다음 노드에 연결합니다.',
    action: '핸들 드래그 -> 다음 노드'
  },
  {
    id: 'label',
    label: '분기 라벨',
    file: '03-decision-label.gif',
    hint: 'Decision에서 나가는 선에 예/아니오 같은 조건 라벨을 달아주세요.',
    action: 'Decision 선택 -> 선 라벨 입력'
  },
  {
    id: 'save',
    label: '저장',
    file: '04-save-flow.gif',
    hint: 'Ctrl+S로 저장 후 상단 상태가 변경되는지 확인합니다.',
    action: 'Ctrl+S -> 저장 상태 확인'
  }
];

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
  const addShape = useStore((s) => s.addShape);
  const addShapeAfter = useStore((s) => s.addShapeAfter);
  const onConnect = useStore((s) => s.onConnect);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);

  const [selectedDemoId, setSelectedDemoId] = React.useState<string>(DEMOS[0].id);
  const [srcIndex, setSrcIndex] = React.useState<number>(0);
  const [retryToken, setRetryToken] = React.useState<number>(0);
  const [demoLoadFailed, setDemoLoadFailed] = React.useState<boolean>(false);
  const [demoLoading, setDemoLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!show) return;
    setDemoLoadFailed(false);
    setDemoLoading(true);
    setSrcIndex(0);
    setRetryToken((v) => v + 1);
  }, [show, selectedDemoId]);

  React.useEffect(() => {
    if (!show || !demoLoadFailed) return;
    const t = window.setTimeout(() => {
      setDemoLoadFailed(false);
      setDemoLoading(true);
      setSrcIndex(0);
      setRetryToken((v) => v + 1);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [show, demoLoadFailed]);

  if (!show) return null;

  const selectedDemo = DEMOS.find((d) => d.id === selectedDemoId) || DEMOS[0];
  const candidates = [`/flowchart/onboarding/${selectedDemo.file}`, `/onboarding/${selectedDemo.file}`];
  const demoSrc = candidates[Math.min(srcIndex, candidates.length - 1)];

  const startNode = nodes.find((n) => n.data.nodeType === 'start');
  const endNode = nodes.find((n) => n.data.nodeType === 'end');
  const nonStartNodes = nodes.filter((n) => n.data.nodeType !== 'start');
  const workNodes = nodes.filter((n) => !['start', 'end'].includes(n.data.nodeType));
  const decisions = nodes.filter((n) => n.data.nodeType === 'decision');
  const hasLabeledDecision = decisions.some((d) => edges.some((e) => e.source === d.id && !!e.label));

  const connectIfMissing = (source: string, target: string) => {
    const exists = edges.some((e) => e.source === source && e.target === target);
    if (exists) return;
    const conn: Connection = { source, target, sourceHandle: null, targetHandle: null };
    onConnect(conn);
  };

  const handleQuickStart = () => {
    if (!startNode || workNodes.length > 0) return;

    const first = addShape('process', '요청 접수', {
      x: startNode.position.x + 260,
      y: startNode.position.y + 20
    });
    const decision = addShape('decision', '정보가 충분한가?', {
      x: startNode.position.x + 560,
      y: startNode.position.y + 20
    });
    const branchNo = addShape('process', '보완 요청 전달', {
      x: startNode.position.x + 860,
      y: startNode.position.y - 80
    });
    const branchYes = addShape('process', '처리 완료', {
      x: startNode.position.x + 860,
      y: startNode.position.y + 120
    });

    connectIfMissing(startNode.id, first);
    connectIfMissing(first, decision);
    connectIfMissing(decision, branchNo);
    connectIfMissing(decision, branchYes);
    if (endNode) connectIfMissing(branchYes, endNode.id);

    setSelectedNodeId(first);
  };

  const handleAddNextStep = () => {
    const stepsOnly = nodes.filter((n) => ['process', 'decision', 'subprocess'].includes(n.data.nodeType));

    if (stepsOnly.length === 0) {
      const ref = startNode?.position || { x: 220, y: 220 };
      const first = addShape('process', '첫 업무 단계', { x: ref.x + 260, y: ref.y + 20 });
      if (startNode) connectIfMissing(startNode.id, first);
      setSelectedNodeId(first);
      return;
    }

    const anchor = [...stepsOnly].sort((a, b) => {
      if ((a.data.stepNumber || 0) !== (b.data.stepNumber || 0)) {
        return (a.data.stepNumber || 0) - (b.data.stepNumber || 0);
      }
      return a.position.y - b.position.y;
    })[stepsOnly.length - 1];

    const newNodeId = addShapeAfter('process', '다음 업무 단계', anchor.id);
    setSelectedNodeId(newNodeId);
  };

  const steps = [
    {
      done: workNodes.length >= 1,
      title: '1. 첫 노드 추가',
      desc: '프로세스 단계를 1개 이상 만들어 시작점을 확보하세요.'
    },
    {
      done: workNodes.length >= 2,
      title: '2. 두 번째 단계 만들기',
      desc: '후속 단계를 이어서 만들면 흐름이 보이기 시작합니다.'
    },
    {
      done: edges.length >= 1,
      title: '3. 노드 연결',
      desc: '단계 간 선을 연결해 전후 관계를 명확히 하세요.'
    },
    {
      done: decisions.length > 0 && hasLabeledDecision,
      title: '4. 분기 라벨 작성',
      desc: 'Decision을 썼다면 분기 조건 라벨을 반드시 입력하세요.'
    },
    {
      done: saveStatus !== 'unsaved',
      title: '5. 저장 완료',
      desc: 'Ctrl+S로 저장해 작업 상태를 고정하세요.'
    }
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  const nextAction =
    workNodes.length === 0
      ? '빠른 시작 자동 생성으로 30초 안에 기본 흐름을 만든 뒤, 실제 업무명으로 라벨만 바꿔보세요.'
      : edges.length === 0
        ? '이제 노드 간 선을 1개만 연결해 보세요. 연결 1회가 온보딩 이탈을 크게 줄입니다.'
        : decisions.length > 0 && !hasLabeledDecision
          ? 'Decision 분기선 라벨(예/아니오)을 먼저 채우면 리뷰 품질이 바로 좋아집니다.'
          : saveStatus === 'unsaved'
            ? '현재 변경사항이 저장 전입니다. Ctrl+S로 한 번 저장해 세션을 고정하세요.'
            : '좋습니다. 기본 온보딩 목표를 달성했습니다. 다음은 L7 검증 또는 리뷰 요청입니다.';

  return (
    <div className="absolute top-20 right-4 z-[1200] pointer-events-none">
      <div
        className="w-[440px] rounded-2xl border shadow-2xl pointer-events-auto"
        style={{
          borderColor: 'rgba(148,163,184,0.35)',
          background:
            'linear-gradient(165deg, rgba(8,47,73,0.95) 0%, rgba(15,23,42,0.96) 48%, rgba(30,41,59,0.96) 100%)'
        }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(148,163,184,0.25)' }}>
          <div className="text-[11px] tracking-[0.16em] text-cyan-300">ONBOARDING</div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">첫 3분 세션 가이드</h3>
          <p className="text-xs text-slate-300 mt-1">
            설명만 보는 방식 대신, 바로 실행해서 결과를 만드는 흐름으로 바꿨습니다.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={handleQuickStart}
              disabled={!startNode || workNodes.length > 0}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(90deg,#0ea5e9,#2563eb)' }}
              title="노드가 없는 상태에서만 실행됩니다"
            >
              빠른 시작 자동 생성
            </button>
            <button
              onClick={handleAddNextStep}
              className="px-3 py-2 rounded-lg text-xs border text-slate-200 hover:bg-slate-700/45"
              style={{ borderColor: 'rgba(148,163,184,0.45)' }}
            >
              다음 단계 추가
            </button>
          </div>

          <div className="mt-2 rounded-lg border px-3 py-2 text-xs text-cyan-100" style={{ borderColor: 'rgba(34,211,238,0.35)', background: 'rgba(2,132,199,0.12)' }}>
            {nextAction}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {DEMOS.map((demo) => (
              <button
                key={demo.id}
                onClick={() => {
                  setSelectedDemoId(demo.id);
                }}
                className={`px-2 py-1 text-[11px] rounded-md border ${
                  selectedDemo.id === demo.id
                    ? 'text-cyan-200 border-cyan-400/60 bg-cyan-500/10'
                    : 'text-slate-300 border-slate-500/40 bg-slate-700/30'
                }`}
              >
                {demo.label}
              </button>
            ))}
          </div>

          <div className="mt-2 rounded-lg border overflow-hidden relative" style={{ borderColor: 'rgba(148,163,184,0.25)' }}>
            {!demoLoadFailed ? (
              <>
                <img
                  key={`${demoSrc}-${retryToken}`}
                  src={demoSrc}
                  alt={`${selectedDemo.label} 데모`}
                  className="w-full h-[182px] object-contain bg-slate-950/60"
                  onLoad={() => {
                    setDemoLoading(false);
                    setDemoLoadFailed(false);
                  }}
                  onError={() => {
                    if (srcIndex < candidates.length - 1) {
                      setDemoLoading(true);
                      setSrcIndex((v) => v + 1);
                      setRetryToken((v) => v + 1);
                      return;
                    }
                    setDemoLoading(false);
                    setDemoLoadFailed(true);
                  }}
                />
                {demoLoading && (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-xs text-slate-200 bg-slate-950/45"
                    style={{ backdropFilter: 'blur(1px)' }}
                  >
                    GIF 불러오는 중...
                  </div>
                )}
                <div className="px-3 py-2.5 border-t text-xs" style={{ borderColor: 'rgba(148,163,184,0.2)', background: 'rgba(2,6,23,0.65)' }}>
                  <div className="text-cyan-200 font-semibold">핵심 동작: {selectedDemo.action}</div>
                  <div className="text-slate-300 mt-1">{selectedDemo.hint}</div>
                </div>
              </>
            ) : (
              <div className="h-[182px] px-3 py-2 text-xs text-slate-300 bg-slate-900/50">
                <div className="font-semibold text-slate-200">GIF 로딩 실패</div>
                <div className="mt-1 break-all text-slate-400">시도 경로: {demoSrc}</div>
                <div className="mt-1 text-slate-400">정적 파일 경로를 확인한 뒤 다시 시도해 주세요.</div>
                <button
                  onClick={() => {
                    setDemoLoadFailed(false);
                    setDemoLoading(true);
                    setSrcIndex(0);
                    setRetryToken((v) => v + 1);
                  }}
                  className="mt-2 px-2 py-1 rounded text-[11px] border border-slate-500/40 text-slate-200 hover:bg-slate-700/40"
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>진행률</span>
              <span>
                {doneCount} / {steps.length} ({progress}%)
              </span>
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

        <div
          className="px-5 py-3 border-t flex items-center justify-between"
          style={{ borderColor: 'rgba(148,163,184,0.25)' }}
        >
          <div className="text-xs text-slate-400">F1 도움말에서도 온보딩 핵심을 확인할 수 있습니다.</div>
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
