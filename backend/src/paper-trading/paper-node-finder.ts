/**
 * Находит id всех paper_trading_output-нод, достижимых вперёд (source → target)
 * от signal-нод с заданным signalType. Работает по сырому графу strategy.nodes/edges,
 * т.к. ноды после сигнала в strategy.ast не попадают.
 */
export function findPaperNodesForSignal(
  nodes: Array<{ id: string; type?: string; data?: any }>,
  edges: Array<{ source: string; target: string }>,
  signalType: string,
): string[] {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return [];

  const signalIds = nodes
    .filter((n) => n.type === 'signal' && (n.data?.signalType || 'LONG') === signalType)
    .map((n) => n.id);
  if (!signalIds.length) return [];

  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }

  const visited = new Set<string>();
  const queue = [...signalIds];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adjacency.get(id) || []) queue.push(next);
  }

  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  return [...visited].filter((id) => typeById.get(id) === 'paper_trading_output');
}
