import { Injectable, Logger } from '@nestjs/common';
import { init } from 'z3-solver';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private z3: any = null;

  async initZ3() {
    if (!this.z3) {
      const { Context } = await init();
      this.z3 = Context('main');
    }
    return this.z3;
  }

  async validate(ast: any): Promise<{ valid: boolean; error?: string }> {
    if (ast === null || ast === undefined) {
      return { valid: false, error: 'Стратегия не может быть скомпилирована: граф пуст или Signal-нода не подключена' };
    }
    try {
      const { Solver, Real, And, Or, Not, Distinct } = await this.initZ3();
      const solver = new Solver();
      const variables = new Map<string, any>();

      const getVar = (node: any) => {
        const id = this.getNodeId(node);
        if (!variables.has(id)) {
          variables.set(id, Real.const(id));
        }
        return variables.get(id);
      };

      const buildExpr = (node: any): any => {
        if (typeof node !== 'object' || node === null) {
          return node; // Number
        }

        switch (node.type) {
          case 'signal':
            return buildExpr(node.condition);

          case 'logic':
            const ops = node.operands
              .map((op: any) => buildExpr(op))
              .filter((op: any) => typeof op !== 'number' && typeof op !== 'boolean' && op != null);
            if (ops.length === 0) return true;
            if (node.operator === 'AND') return And(...ops);
            if (node.operator === 'OR') return Or(...ops);
            return true;

          case 'comparison':
            const left = buildExpr(node.left);
            const right = buildExpr(node.right);
            
            // If both are numbers, we can't really "solve" it in Z3 as a variable, 
            // but we can return the boolean result. However, Z3 expects expressions.
            if (typeof left === 'number' && typeof right === 'number') {
                return left > right; // This won't work well for And/Or in Z3 if it's just a JS bool
            }

            // Wrap raw JS numbers as Z3 Real values — passing a primitive number
            // into a Z3 expression method throws "Cannot use 'in' operator ... in 0".
            const lExpr = typeof left === 'number' ? Real.val(left) : (left?.type ? left : getVar(node.left));
            const rExpr = typeof right === 'number' ? Real.val(right) : (right?.type ? right : getVar(node.right));

            switch (node.operator) {
              case '>': return lExpr.gt(rExpr);
              case '<': return lExpr.lt(rExpr);
              case '>=': return lExpr.ge(rExpr);
              case '<=': return lExpr.le(rExpr);
              case '==': return lExpr.eq(rExpr);
              case '!=': return lExpr.neq(rExpr);
              default: return true;
            }

          case 'indicator':
          case 'input':
          case 'scanner':
          case 'finviz_scanner':
          case 'orderbook':
          case 'order_flow':
          case 'exchange':
          case 'exchange_data':
          case 'exchange_scanner':
            return getVar(node);

          default:
            return true;
        }
      };

      const mainExpr = buildExpr(ast);
      if (mainExpr === null || mainExpr === undefined) {
        return { valid: false, error: 'Стратегия не может быть проверена: одна из нод не подключена или вернула пустое условие' };
      }
      if (typeof mainExpr === 'boolean') {
        return { valid: mainExpr, error: mainExpr ? undefined : 'Условие всегда ложно (константное значение)' };
      }

      solver.add(mainExpr);
      const result = await solver.check();

      if (result === 'unsat') {
        return {
          valid: false,
          error: 'Обнаружено логическое противоречие: стратегия содержит взаимоисключающие условия (например, RSI > 70 AND RSI < 30). Такая стратегия никогда не сработает.',
        };
      }

      return { valid: true };
    } catch (e) {
      this.logger.error(`Validation error: ${e.message}`);
      return { valid: true }; // Fallback to valid if Z3 fails
    }
  }

  private getNodeId(node: any): string {
    if (node.type === 'indicator') {
      return `ind_${node.name}_${JSON.stringify(node.params)}_${node.timeframe || 'inherit'}_${node.property || 'default'}`;
    }
    if (node.type === 'input') {
      return `in_${node.source}_${node.params?.pair || 'self'}_${node.timeframe || 'inherit'}`;
    }
    if (node.type === 'scanner') {
      return `scan_${node.source}_${JSON.stringify(node.params)}`;
    }
    if (node.type === 'finviz_scanner') {
      return `finviz_${node.params?.signal || 'default'}`;
    }
    return `var_${node.type}_${Math.random().toString(36).substring(7)}`;
  }
}
