// ─── Process Context ───
export interface ProcessContext {
  l4: string;
  l5: string;
  processName: string;
  // v5: triggerLabel/endLabel kept optional for JSON backward compat but removed from UI
  triggerLabel?: string;
  endLabel?: string;
}

// ─── Node Types ───
export type ShapeType = 'start' | 'end' | 'process' | 'decision' | 'subprocess';

// ─── Node Category (색상 분류) ───
export type NodeCategory = 'as_is' | 'digital_worker' | 'ssc_transfer' | 'delete_target' | 'new_addition';

// ─── L7 Status (타입 안정성) ───
export type L7Status = 'none' | 'checking' | 'pass' | 'warning' | 'reject';

// ─── Suggestion from LLM ───
export interface Suggestion {
  action: 'ADD' | 'MODIFY' | 'DELETE';
  type: 'PROCESS' | 'DECISION' | 'SUBPROCESS';
  summary: string;
  reason: string;
  insertAfterNodeId?: string;
  insertBeforeNodeId?: string;
  targetNodeId?: string;
  newLabel?: string;
  branches?: {
    yes?: { summary: string; type: 'PROCESS' | 'DECISION' };
    no?: { summary: string; type: 'PROCESS' | 'DECISION' };
  };
}

// ─── L7 Validation ───
export interface L7Issue {
  ruleId: string;
  severity: 'reject' | 'warning';
  message: string;
  suggestion?: string;
  friendlyTag?: string;
}

export interface L7ReportItem {
  nodeId: string;
  nodeLabel: string;
  pass: boolean;
  score: number;
  issues: L7Issue[];
  rewriteSuggestion?: string;
}

// ─── Node Change History ───
export interface NodeChangeEntry {
  before: string;
  after: string;
  timestamp: number;
  source: 'user' | 'ai';
}

// ─── Chat ───
export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  suggestions?: Suggestion[];
  l7Report?: L7ReportItem[];
  quickQueries?: string[];
  timestamp: number;
}

// ─── Flow Node Data ───
export interface FlowNodeData {
  label: string;
  nodeType: ShapeType;
  stepNumber?: number;
  inputLabel?: string;
  outputLabel?: string;
  systemName?: string;
  duration?: string;
  category?: NodeCategory;
  swimLaneId?: string;
  // L7
  l7Status?: L7Status;
  l7Score?: number;
  l7Issues?: L7Issue[];
  l7Rewrite?: string;
  changeHistory?: NodeChangeEntry[];
  // Position lock

  // v5: auto-enter inline edit on creation
  pendingEdit?: boolean;
}

// ─── Swim Lane (v5: 다중 가로형) ───
export interface SwimLane {
  id: string;
  label: string;
  order: number;
  color: string;
}

// ─── Context Menu ───
export interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  nodeId?: string;
  edgeId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  // v5: flow position for accurate shape placement
  flowX?: number;
  flowY?: number;
}

// ─── Meta Edit Modal ───
export interface MetaEditTarget {
  nodeId: string;
  inputLabel?: string;
  outputLabel?: string;
  systemName?: string;
  duration?: string;
}

// ─── PDD Analysis ───
export interface PDDRecommendation {
  nodeId: string;
  nodeLabel: string;
  suggestedCategory: NodeCategory;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PDDAnalysisResult {
  recommendations: PDDRecommendation[];
  summary: string;
}

// ─── Loading ───
export interface LoadingState {
  active: boolean;
  message: string;
  startTime: number;
  elapsed: number;
}

// ─── Save State ───
export type SaveStatus = 'unsaved' | 'draft' | 'complete';

// ─── Theme ───


export type AppPhase = 'setup' | 'drawing';

export interface HRModule {
  l4: string;
  tasks: { l5: string; l6_activities: string[]; }[];
}
