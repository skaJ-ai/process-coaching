import React, { useState } from 'react';

interface Props {
  onClose: () => void;
}

const TABS = ['라벨 규칙', '구조 규칙', '표준 동사'] as const;
type Tab = typeof TABS[number];

export default function L7GuideModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('라벨 규칙');

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[680px] rounded-2xl flex flex-col my-auto"
        style={{ background: '#0f1729', border: '1px solid rgba(148,163,184,0.15)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: 'calc(100vh - 80px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-100">L7 라벨 작성 가이드</h2>
            <p className="text-xs text-slate-500 mt-0.5">프로세스 단계를 명확하게 표현하는 기준</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg px-2">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pb-3 flex-shrink-0 border-b border-slate-800">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4 text-xs text-slate-300">
          {tab === '라벨 규칙' && (
            <>
              <Section title="기본 형식">
                <Row sev="warning" label="길이 부족" desc="4자 미만이면 의미 전달이 어렵습니다." />
                <Row sev="warning" label="길이 초과" desc="100자 초과 시 핵심 동작이 흐려집니다." />
              </Section>
              <Section title="동사 규칙">
                <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5">금지 동사 — 사용 불가</div>
                  <p className="text-slate-400 mb-2">어떤 맥락에서도 구체적 의미가 없어 제3자가 수행할 수 없는 동사입니다.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['처리한다', '진행한다', '관리한다', '대응한다', '지원한다', '파악한다', '준비한다', '고도화한다', '리드한다'].map(v => (
                      <span key={v} className="px-2 py-0.5 rounded text-[11px] bg-red-500/10 text-red-300 border border-red-500/20">{v}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
                  <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">구체화 권장 — 대안 제시</div>
                  <p className="text-slate-400 mb-2">사용은 가능하지만 더 구체적인 동사로 바꾸면 명확해집니다.</p>
                  <table className="w-full text-[11px]">
                    <thead><tr className="text-slate-500"><th className="text-left pb-1">동사</th><th className="text-left pb-1">대안</th></tr></thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {[
                        ['검토한다', '비교한다, 판정한다, 검증한다'],
                        ['개선한다', '수정한다, 재작성한다'],
                        ['정리한다', '분류한다, 집계한다, 삭제한다'],
                        ['공유한다', '안내한다, 발송한다, 공지한다'],
                        ['반영한다', '입력한다, 수정한다, 저장한다'],
                        ['분析한다', '집계한다, 비교한다, 추출한다'],
                        ['평가한다', '판정한다, 검증한다, 비교한다'],
                        ['담당한다', '조회한다, 입력한다, 구체 동작으로 교체'],
                        ['보조한다', '안내한다, 요청한다, 구체 동작으로 교체'],
                        ['피드백한다', '안내한다, 공지한다, 요청한다'],
                      ].map(([v, alt]) => (
                        <tr key={v}><td className="py-1 text-amber-300/80">{v}</td><td className="py-1 text-slate-400">{alt}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
              <Section title="구조 규칙">
                <Row sev="warning" label="시스템명 혼입" desc="괄호/브라켓 내 시스템명은 메타데이터로 분리하세요. 예: '(SAP)' → systemName 필드" />
                <Row sev="reject"  label="복수 동작" desc="~하고, ~하며, ~한 후 패턴은 별도 단계로 분리해야 합니다. 하나의 L7 = 하나의 동작" />
                <Row sev="suggest" label="주어 누락" desc="스윔레인 미사용 시, 목적어(을/를)가 있는데 주어(이/가/은/는)가 없으면 안내합니다." />
                <Row sev="reject"  label="목적어 누락" desc="타동사(조회/입력/수정/전송 등)에는 을/를 조사가 필수입니다. 예: '급여를 조회한다'" />
                <Row sev="warning" label="기준값 누락 (판단 노드)" desc="판단 노드에 여부·인가·이상·이하 등 판단 기준이 없으면 조건이 모호합니다." />
              </Section>
              <div className="rounded-lg px-4 py-3 text-[11px] text-slate-400" style={{ background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.1)' }}>
                <span className="font-medium text-slate-300">권장 형식:</span> <span className="text-blue-300">(주어) + 목적어 + 동사</span>
                <span className="ml-3 text-slate-500">예: "담당자가 급여를 조회한다" / "요청서를 승인한다"</span>
              </div>
            </>
          )}

          {tab === '구조 규칙' && (
            <>
              <p className="text-slate-500 text-[11px]">플로우 전체 구조에 대한 규칙입니다. 품질 대시보드(좌측 패널)에서 실시간으로 확인할 수 있습니다.</p>
              <Section title="필수 구조">
                <Row sev="warning" label="종료 노드 필수" desc="프로세스 범위를 명확히 하려면 종료 노드가 최소 1개 있어야 합니다." />
                <Row sev="warning" label="빈 라벨 방치" desc="'새 태스크' 같은 기본값은 반드시 구체적인 라벨로 바꿔주세요." />
                <Row sev="warning" label="고아 노드" desc="어느 단계와도 연결되지 않은 노드는 플로우에서 제외된 것과 같습니다." />
              </Section>
              <Section title="분기/연결 규칙">
                <Row sev="warning" label="암묵적 분기" desc="프로세스 노드에서 2개 이상 분기할 경우 판단 노드로 조건을 명시하세요." />
                <Row sev="warning" label="중복 연결" desc="동일한 출발→도착 연결이 2개 이상이면 하나를 삭제하세요." />
                <Row sev="warning" label="무의미 판단" desc="판단 노드에서 나가는 경로가 1개뿐이면 일반 프로세스 노드로 변경하세요." />
                <Row sev="warning" label="조건 라벨 누락" desc="판단 노드의 모든 분기에 '예/아니오' 또는 구체적 조건을 적어주세요." />
              </Section>
              <Section title="복잡도 관리">
                <Row sev="warning" label="다중 시작" desc="시작 노드가 2개 이상이면 의도적 구조인지 확인하세요." />
                <Row sev="warning" label="과다 분기" desc="판단 노드에서 4개 이상 분기 시 2단계 판단으로 나누면 가독성이 좋아집니다." />
                <Row sev="warning" label="모델 복잡도" desc="노드가 50개를 초과하면 서브프로세스로 분해하는 것을 권장합니다." />
              </Section>
            </>
          )}

          {tab === '표준 동사' && (
            <>
              <p className="text-slate-500 text-[11px] mb-3">L7 라벨에 권장되는 표준 동사 목록입니다. 이 동사들은 제3자가 즉시 이해하고 수행할 수 있는 구체적 행위를 나타냅니다.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { cat: '조회/입력/수정', verbs: ['조회한다', '입력한다', '수정한다', '저장한다', '추출한다', '확인한다'] },
                  { cat: '비교/집계/기록', verbs: ['비교한다', '집계한다', '기록한다', '첨부한다', '체크한다'] },
                  { cat: '승인/판정/전달', verbs: ['판정한다', '승인한다', '반려한다', '결정한다', '전송한다', '배포한다', '제공한다'] },
                  { cat: '요청/안내/공지', verbs: ['요청한다', '재요청한다', '안내한다', '공지한다', '에스컬레이션한다'] },
                ].map(({ cat, verbs }) => (
                  <div key={cat} className="rounded-lg p-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <div className="text-[10px] font-semibold text-green-400 mb-2 uppercase tracking-wider">{cat}</div>
                    <div className="flex flex-wrap gap-1">
                      {verbs.map(v => (
                        <span key={v} className="px-2 py-0.5 rounded text-[11px] bg-green-500/10 text-green-300 border border-green-500/15">{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg px-4 py-3 mt-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div className="text-[10px] font-semibold text-indigo-400 mb-1.5">작성 예시</div>
                <div className="space-y-1 text-[11px]">
                  <div><span className="text-green-300">✓</span> <span className="text-slate-300">급여를 조회한다</span> <span className="text-slate-500">— 목적어 + 표준동사</span></div>
                  <div><span className="text-green-300">✓</span> <span className="text-slate-300">담당자가 품의서를 승인한다</span> <span className="text-slate-500">— 주어 + 목적어 + 표준동사</span></div>
                  <div><span className="text-green-300">✓</span> <span className="text-slate-300">예산 초과 여부 판단</span> <span className="text-slate-500">— 판단 노드 형식</span></div>
                  <div><span className="text-red-400">✗</span> <span className="text-slate-400">처리한다</span> <span className="text-slate-500">— 금지 동사, 대상 불명확</span></div>
                  <div><span className="text-red-400">✗</span> <span className="text-slate-400">검토하고 저장한다</span> <span className="text-slate-500">— 복수 동작, 분리 필요</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ sev, label, desc }: { sev: 'reject' | 'warning' | 'suggest'; label: string; desc: string }) {
  const colors = {
    reject:  { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   dot: '#f87171' },
    warning: { bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)',  dot: '#fbbf24' },
    suggest: { bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', dot: '#94a3b8' },
  }[sev];
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: colors.dot }} />
      <div>
        <div className="font-medium text-slate-200 text-[11px]">{label}</div>
        <div className="text-slate-400 text-[11px] mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
