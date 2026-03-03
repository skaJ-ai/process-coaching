import { Edge, Node } from 'reactflow';
import { API_BASE_URL } from '../constants';
import { ChatMessage, FlowNodeData, L7Status, LoadingState, ProcessContext } from '../types';
import { validateL7Label } from '../utils/l7Rules';
import { buildConversationSummary, buildRecentTurns, serialize } from './helpers';

type AddMessage = (message: ChatMessage) => void;

interface StoreSlice {
  processContext: ProcessContext | null;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  messages: ChatMessage[];
  dividerYs: number[];
  swimLaneLabels: string[];
  loadingState: LoadingState;
  addMessage: AddMessage;
  _lastCoachingTrigger: Record<string, number>;
  checkImplicitBranch: () => void;
}

type StoreSet = (partial: Partial<Omit<StoreSlice, 'checkImplicitBranch'>> | ((state: StoreSlice) => Partial<Omit<StoreSlice, 'checkImplicitBranch'>>)) => void;
type StoreGet = () => StoreSlice & { setLoadingMessage: (message: string) => void };

interface ChatActionDeps {
  generateId: (prefix?: string) => string;
  debugTrace: (event: string, payload?: Record<string, unknown>) => void;
  extractBotText: (data: unknown) => string;
  friendlyTag: (ruleId: string) => string;
}

const PLACEHOLDER_LABELS = new Set(['새 태스크', '새 단계', '분기 조건?', '판단 조건', 'L6 프로세스', '하위 절차']);

export function createChatActions(set: StoreSet, get: StoreGet, deps: ChatActionDeps) {
  const { generateId, debugTrace, extractBotText, friendlyTag } = deps;

  return {
    validateNode: async (id: string) => {
      const { nodes } = get();
      const node = nodes.find((n) => n.id === id);
      if (!node || ['start', 'end', 'subprocess', 'parallel'].includes(node.data.nodeType)) return null;
      if (PLACEHOLDER_LABELS.has((node.data.label || '').trim())) {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status } } : n,
          ),
        });
        return null;
      }

      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, l7Status: 'checking' as L7Status } } : n,
        ),
      });

      try {
        debugTrace('validateNode:start', { id, label: node.data.label, type: node.data.nodeType });
        const hasSwimLane = get().dividerYs.length > 0;
        const data = validateL7Label(node.data.label || '', node.data.nodeType, hasSwimLane);
        debugTrace('validateNode:success', {
          id,
          pass: !!data.pass,
          score: data.score ?? null,
          issues: (data.issues || []).length,
        });

        set({
          nodes: get().nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    l7Status: (
                      data.pass
                        ? data.issues?.some((issue: any) => issue.severity === 'warning')
                          ? 'warning'
                          : 'pass'
                        : 'reject'
                    ) as L7Status,
                    l7Score: data.score ?? 0,
                    l7Issues: (data.issues || []).map((issue: any) => ({
                      ...issue,
                      friendlyTag: issue.friendlyTag || friendlyTag(issue.ruleId),
                    })),
                    l7Rewrite: data.rewriteSuggestion || undefined,
                  },
                }
              : n,
          ),
        });
        return data;
      } catch {
        debugTrace('validateNode:error', { id });
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status } } : n,
          ),
        });
        return null;
      }
    },

    sendChat: async (msg: string) => {
      const { processContext: ctx, nodes, edges, addMessage, loadingState, dividerYs, swimLaneLabels } = get();
      addMessage({ id: generateId('msg'), role: 'user', text: msg, timestamp: Date.now() });
      let newCount = (loadingState.requestCount || 0) + 1;
      set({
        loadingState: {
          active: true,
          message: '응답 생성 중...',
          startTime: Date.now(),
          elapsed: 0,
          requestCount: newCount,
        },
      });

      try {
        debugTrace('chat:start', { messageLength: msg.length, nodeCount: nodes.length, edgeCount: edges.length });
        const { nodes: serializedNodes, edges: serializedEdges } = serialize(nodes, edges);
        const recentTurns = buildRecentTurns(get().messages);
        const conversationSummary = buildConversationSummary(get().messages);
        const activeLaneLabels = dividerYs.length > 0 ? swimLaneLabels.slice(0, dividerYs.length + 1) : [];
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msg,
            context: ctx || {},
            currentNodes: serializedNodes,
            currentEdges: serializedEdges,
            recentTurns,
            conversationSummary,
            swimLaneLabels: activeLaneLabels,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText} ${errorText.slice(0, 300)}`);
        }

        const data = await response.json();
        const validSuggestions = (data.suggestions || []).filter(
          (suggestion: any) =>
            suggestion.summary?.trim() || suggestion.newLabel?.trim() || suggestion.labelSuggestion?.trim(),
        );
        debugTrace('chat:success', {
          hasText: !!(data.message || data.speech || data.guidance),
          suggestions: validSuggestions.length,
          quickQueries: (data.quickQueries || []).length,
        });

        addMessage({
          id: generateId('msg'),
          role: 'bot',
          text: extractBotText(data),
          suggestions: validSuggestions.map((suggestion: any) => ({ action: suggestion.action || 'ADD', ...suggestion })),
          quickQueries: data.quickQueries || [],
          timestamp: Date.now(),
        });
      } catch {
        debugTrace('chat:error');
        addMessage({
          id: generateId('msg'),
          role: 'bot',
          timestamp: Date.now(),
          text: '⚠️ AI 서버와 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.\n\n문제가 지속되면 관리자에게 문의하세요.',
          quickQueries: ['다시 시도'],
        });
      } finally {
        const currentLoading = get().loadingState;
        newCount = Math.max(0, (currentLoading.requestCount || 1) - 1);
        set({ loadingState: { ...currentLoading, active: newCount > 0, requestCount: newCount } });
      }
    },

    requestReview: async () => {
      const { processContext: ctx, nodes, edges, addMessage, loadingState, dividerYs, swimLaneLabels } = get();
      let newCount = (loadingState.requestCount || 0) + 1;
      set({
        loadingState: {
          active: true,
          message: '플로우 분석 중...',
          startTime: Date.now(),
          elapsed: 0,
          requestCount: newCount,
        },
      });
      addMessage({ id: generateId('msg'), role: 'user', text: '🔍 전체 흐름 검토 요청', timestamp: Date.now() });

      try {
        debugTrace('review:start', { nodeCount: nodes.length, edgeCount: edges.length });
        const { nodes: serializedNodes, edges: serializedEdges } = serialize(nodes, edges);
        const activeLaneLabels = dividerYs.length > 0 ? swimLaneLabels.slice(0, dividerYs.length + 1) : [];
        const response = await fetch(`${API_BASE_URL}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentNodes: serializedNodes,
            currentEdges: serializedEdges,
            userMessage: '프로세스 분석 + 제안',
            context: ctx || {},
            swimLaneLabels: activeLaneLabels,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText} ${errorText.slice(0, 300)}`);
        }

        const data = await response.json();
        // labelSuggestion/newLabel에서 설명 텍스트 제거: "라벨 — 설명" 또는 "라벨 (설명)" 패턴
        const cleanLabel = (s: string | undefined): string | undefined => {
          if (!s) return s;
          return s.replace(/\s*[—–-]\s*.+$/, '').replace(/\s*\([^)]*\)\s*$/, '').split('\n')[0].trim() || undefined;
        };
        const validSuggestions = (data.suggestions || []).filter(
          (suggestion: any) =>
            suggestion.summary?.trim() || suggestion.newLabel?.trim() || suggestion.labelSuggestion?.trim(),
        );
        debugTrace('review:success', {
          hasText: !!(data.speech || data.message),
          suggestions: validSuggestions.length,
          quickQueries: (data.quickQueries || []).length,
        });

        addMessage({
          id: generateId('msg'),
          role: 'bot',
          text: extractBotText(data) || '리뷰 완료',
          suggestions: validSuggestions.map((s: any) => ({
            action: s.action || 'ADD',
            ...s,
            labelSuggestion: cleanLabel(s.labelSuggestion),
            newLabel: cleanLabel(s.newLabel),
          })),
          quickQueries: data.quickQueries || [],
          timestamp: Date.now(),
        });
        // 리뷰 후 병렬 게이트웨이 누락 체크 (dedup 리셋 후 강제 실행)
        const trigger = get()._lastCoachingTrigger;
        set({ _lastCoachingTrigger: { ...trigger, implicitSplit: 0, implicitJoin: 0 } });
        setTimeout(() => get().checkImplicitBranch(), 600);
      } catch {
        debugTrace('review:error');
        addMessage({
          id: generateId('msg'),
          role: 'bot',
          timestamp: Date.now(),
          text: '⚠️ AI 서버와 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.\n\n문제가 지속되면 관리자에게 문의하세요.',
          quickQueries: ['🔍 플로우 분석 다시 시도'],
        });
      } finally {
        const currentLoading = get().loadingState;
        newCount = Math.max(0, (currentLoading.requestCount || 1) - 1);
        set({ loadingState: { ...currentLoading, active: newCount > 0, requestCount: newCount } });
      }
    },
  };
}
