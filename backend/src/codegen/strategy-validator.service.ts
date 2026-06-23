import { Injectable } from '@nestjs/common';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  nodeId?: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: {
    totalNodes: number;
    connectedNodes: number;
    orphanNodes: number;
  };
}

@Injectable()
export class StrategyValidatorService {
  /**
   * Validates a strategy graph before code generation.
   * Returns errors (blockers) and warnings (non-blocking).
   */
  validate(nodes: any[], edges: any[]): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (!nodes || nodes.length === 0) {
      issues.push({ severity: 'error', message: 'Стратегия пуста — добавьте ноды в конструкторе', code: 'NO_NODES' });
      return this.buildResult(issues, nodes?.length || 0, edges);
    }

    // 1. Must have a Signal node
    const signalNodes = nodes.filter(n => n.type === 'signal');
    if (signalNodes.length === 0) {
      issues.push({ severity: 'error', message: 'Отсутствует нода «Signal» — она задаёт тип сигнала (LONG/SHORT)', code: 'NO_SIGNAL' });
    } else if (signalNodes.length > 1) {
      issues.push({ severity: 'warning', message: 'Найдено несколько нод Signal — будет использована первая', code: 'MULTI_SIGNAL' });
    }

    // 2. Signal node must have an input connection
    if (signalNodes.length > 0) {
      const signalNode = signalNodes[0];
      const signalInputs = edges.filter(e => e.target === signalNode.id);
      if (signalInputs.length === 0) {
        issues.push({
          severity: 'error',
          nodeId: signalNode.id,
          message: 'Нода Signal не подключена — соедините к ней логику стратегии',
          code: 'SIGNAL_NO_INPUT',
        });
      }
    }

    // 3. Check for orphan nodes (not connected to anything)
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    const orphanNodes = nodes.filter(n => !connectedNodeIds.has(n.id));
    if (orphanNodes.length > 0) {
      for (const orphan of orphanNodes) {
        const label = orphan.data?.name || orphan.data?.label || orphan.type;
        issues.push({
          severity: 'warning',
          nodeId: orphan.id,
          message: `Нода «${label}» не подключена и будет проигнорирована`,
          code: 'ORPHAN_NODE',
        });
      }
    }

    // 4. Logic nodes (AND/OR) must have at least 2 inputs
    const logicNodes = nodes.filter(n => n.type === 'logic');
    for (const ln of logicNodes) {
      const inputs = edges.filter(e => e.target === ln.id);
      if (inputs.length < 2) {
        issues.push({
          severity: 'error',
          nodeId: ln.id,
          message: `Нода «${ln.data?.operator || 'AND'}» требует минимум 2 входа (подключено: ${inputs.length})`,
          code: 'LOGIC_FEW_INPUTS',
        });
      }
    }

    // 5. Comparison nodes must have left and right operands
    const comparisonNodes = nodes.filter(n => n.type === 'comparison');
    for (const cn of comparisonNodes) {
      const inputs = edges.filter(e => e.target === cn.id);
      if (inputs.length < 2) {
        const hasLeft = inputs.some(e => e.targetHandle === 'a' || !e.targetHandle);
        const hasRight = inputs.some(e => e.targetHandle === 'b');
        if (!hasLeft || !hasRight) {
          issues.push({
            severity: 'warning',
            nodeId: cn.id,
            message: `Нода сравнения «${cn.data?.operator || '>'}» — не все входы подключены, будут использованы значения по умолчанию`,
            code: 'COMPARISON_MISSING_INPUT',
          });
        }
      }
    }

    // 6. Cross nodes must have A and B
    const crossNodes = nodes.filter(n => n.type === 'cross');
    for (const cn of crossNodes) {
      const inputs = edges.filter(e => e.target === cn.id);
      if (inputs.length < 2) {
        issues.push({
          severity: 'error',
          nodeId: cn.id,
          message: 'Нода «Cross» требует два входа (A и B) для определения пересечения',
          code: 'CROSS_MISSING_INPUT',
        });
      }
    }

    // 7. Check for circular references (simple DFS)
    if (this.hasCycle(nodes, edges)) {
      issues.push({
        severity: 'error',
        message: 'Обнаружен цикл в графе стратегии — это приведёт к бесконечному циклу',
        code: 'CYCLE_DETECTED',
      });
    }

    // 8. Verify reachability from Signal node
    if (signalNodes.length > 0) {
      const signalNode = signalNodes[0];
      const reachable = this.getReachableNodes(signalNode.id, nodes, edges);
      const unreachableConnected = nodes.filter(
        n => n.id !== signalNode.id && connectedNodeIds.has(n.id) && !reachable.has(n.id),
      );
      if (unreachableConnected.length > 0) {
        issues.push({
          severity: 'warning',
          message: `${unreachableConnected.length} нод(а/ы) подключены, но не ведут к Signal — они не повлияют на результат`,
          code: 'UNREACHABLE_NODES',
        });
      }
    }

    return this.buildResult(issues, nodes.length, edges);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private buildResult(issues: ValidationIssue[], totalNodes: number, edges: any[]): ValidationResult {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    const connectedIds = new Set<string>();
    for (const e of (edges || [])) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalNodes,
        connectedNodes: connectedIds.size,
        orphanNodes: Math.max(0, totalNodes - connectedIds.size),
      },
    };
  }

  private hasCycle(nodes: any[], edges: any[]): boolean {
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (stack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      stack.add(nodeId);
      for (const neighbor of adj.get(nodeId) || []) {
        if (dfs(neighbor)) return true;
      }
      stack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (dfs(node.id)) return true;
    }
    return false;
  }

  private getReachableNodes(signalId: string, nodes: any[], edges: any[]): Set<string> {
    // Walk backwards from signal node
    const reverseAdj = new Map<string, string[]>();
    for (const e of edges) {
      if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, []);
      reverseAdj.get(e.target)!.push(e.source);
    }

    const reachable = new Set<string>();
    const queue = [signalId];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const parent of reverseAdj.get(current) || []) {
        queue.push(parent);
      }
    }
    return reachable;
  }
}
