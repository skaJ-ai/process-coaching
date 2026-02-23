import { NodeCategory } from './types';

export const API_BASE_URL = '/api';

export const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  process: { width: 280, height: 60 },
  decision: { width: 160, height: 160 },
  subprocess: { width: 280, height: 60 },
  start: { width: 80, height: 80 },  // 동적 크기 평균값
  end: { width: 80, height: 80 },    // 동적 크기 평균값
};

export const LAYOUT_CONFIG = {
  nodesep: 120,
  ranksep: 160,
  rankdir: 'LR' as const,
  marginx: 40,
  marginy: 40,
};

export const L7_CONCURRENCY = 4;
export const SWIMLANE_MIN_HEIGHT = 200;

export const SWIMLANE_COLORS = [
  { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa', label: '#93c5fd' },
  { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', text: '#a855f7', label: '#c084fc' },
  { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)', text: '#22c55e', label: '#86efac' },
  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b', label: '#fcd34d' },
  { bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.3)', text: '#ec4899', label: '#f9a8d4' },
  { bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.3)', text: '#14b8a6', label: '#5eead4' },
];

export const CATEGORY_COLORS: Record<NodeCategory | string, { bg: string; border: string; label: string; gradient: string }> = {
  as_is: { bg: '#1e3a5f', border: '#2a4a6b', label: 'As-Is 유지', gradient: 'linear-gradient(135deg, #1e3a5f, #1e293b)' },
  digital_worker: { bg: '#3b1f6e', border: '#7c3aed', label: 'Digital Worker', gradient: 'linear-gradient(135deg, #3b1f6e, #2e1065)' },
  ssc_transfer: { bg: '#064e3b', border: '#10b981', label: 'SSC 이관', gradient: 'linear-gradient(135deg, #064e3b, #022c22)' },
  delete_target: { bg: '#7f1d1d', border: '#ef4444', label: '삭제 대상', gradient: 'linear-gradient(135deg, #7f1d1d, #450a0a)' },
  new_addition: { bg: '#713f12', border: '#eab308', label: '신규 추가', gradient: 'linear-gradient(135deg, #713f12, #422006)' },
};
