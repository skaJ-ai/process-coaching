import dagre from 'dagre';
import { Node, Edge } from 'reactflow';
import { NODE_DIMENSIONS, LAYOUT_CONFIG } from '../constants';
import { FlowNodeData } from '../types';

export function applyDagreLayout(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    nodesep: LAYOUT_CONFIG.nodesep,
    ranksep: LAYOUT_CONFIG.ranksep,
    rankdir: LAYOUT_CONFIG.rankdir,
    marginx: LAYOUT_CONFIG.marginx,
    marginy: LAYOUT_CONFIG.marginy,
  });

  const lockedIds = new Set(nodes.filter(n => n.data.positionLocked).map(n => n.id));

  nodes.forEach((node) => {
    const dims = NODE_DIMENSIONS[node.data.nodeType] || NODE_DIMENSIONS.process;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  let layoutedNodes = nodes.map((node) => {
    if (lockedIds.has(node.id)) return node;
    const pos = g.node(node.id);
    const dims = NODE_DIMENSIONS[node.data.nodeType] || NODE_DIMENSIONS.process;
    return {
      ...node,
      position: { x: pos.x - dims.width / 2, y: pos.y - dims.height / 2 },
    };
  });

  const unlocked = layoutedNodes.filter(n => !lockedIds.has(n.id));
  if (unlocked.length > 0) {
    const minX = Math.min(...unlocked.map(n => n.position.x));
    const leftPad = 100;
    const shift = leftPad - minX;
    if (Math.abs(shift) > 1) {
      layoutedNodes = layoutedNodes.map(n =>
        lockedIds.has(n.id) ? n : { ...n, position: { ...n.position, x: n.position.x + shift } }
      );
    }
  }

  return { nodes: layoutedNodes, edges };
}

/** Reindex step numbers by Y then X position */
export function reindexByPosition(nodes: Node<FlowNodeData>[]): Node<FlowNodeData>[] {
  const indexable = nodes.filter(n => n.data.nodeType === 'process' || n.data.nodeType === 'decision' || n.data.nodeType === 'subprocess');
  const sorted = [...indexable].sort((a, b) => {
    const dy = a.position.y - b.position.y;
    return dy !== 0 ? dy : a.position.x - b.position.x;
  });
  const map = new Map<string, number>();
  sorted.forEach((n, i) => map.set(n.id, i + 1));
  return nodes.map(n => map.has(n.id) ? { ...n, data: { ...n.data, stepNumber: map.get(n.id) } } : n);
}

let _counter = 0;
export function generateId(prefix = 'node'): string {
  _counter++;
  return `${prefix}-${Date.now()}-${_counter}`;
}
