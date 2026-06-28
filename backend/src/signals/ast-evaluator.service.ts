import { Injectable, Logger } from '@nestjs/common';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';

/**
 * Lightweight AST evaluator for backtest.
 * In the main app (AppModule) it delegates to the full SignalsEngineService.
 * In the worker (WorkerModule) it works standalone — optional services
 * that are not provided simply cause their AST nodes to return defaults.
 */
@Injectable()
export class AstEvaluatorService {
  private readonly logger = new Logger(AstEvaluatorService.name);

  constructor(
    private readonly candlesService: CandlesService,
    private readonly indicatorsService: IndicatorsService,
  ) {}

  async evaluateNode(
    node: any,
    candles: any[],
    getHistory = false,
    context?: any,
    options?: { backtestMode?: boolean },
  ): Promise<any> {
    const ctx = options?.backtestMode !== false
      ? { ...context, isBacktest: true }
      : context;
    return this.evaluateNodeStandalone(node, candles, getHistory, ctx);
  }

  private async evaluateNodeStandalone(node: any, candles: any[], getHistory = false, context?: any): Promise<any> {
    if (typeof node !== 'object' || node === null) return getHistory ? [node] : node;

    if (!candles || candles.length === 0) return getHistory ? [null] : null;

    const closes = candles.map(c => parseFloat(c.close)).reverse();

    switch (node.type) {
      case 'signal':
        return this.evaluateNodeStandalone(node.condition, candles, getHistory, context);

      case 'mtf':
        if (!node.condition) return true;
        return this.evaluateNodeStandalone(node.condition, candles, getHistory, context);

      case 'logic': {
        const results = await Promise.all(
          node.operands.map((op: any) => this.evaluateNodeStandalone(op, candles, getHistory, context))
        );
        if (node.operator === 'AND') return results.every(r => !!r);
        if (node.operator === 'OR') return results.some(r => !!r);
        return false;
      }

      case 'comparison': {
        const left = await this.evaluateNodeStandalone(node.left, candles, false, context);
        const right = await this.evaluateNodeStandalone(node.right, candles, false, context);
        switch (node.operator) {
          case '>': return left > right;
          case '<': return left < right;
          case '>=': return left >= right;
          case '<=': return left <= right;
          case '==': return left == right;
          case 'cross_above': {
            const hL = await this.evaluateNodeStandalone(node.left, candles, true, context);
            const hR = await this.evaluateNodeStandalone(node.right, candles, true, context);
            if (!Array.isArray(hL) || !Array.isArray(hR) || hL.length < 2 || hR.length < 2) return false;
            return hL[hL.length - 2] <= hR[hR.length - 2] && hL[hL.length - 1] > hR[hR.length - 1];
          }
          case 'cross_below': {
            const hL = await this.evaluateNodeStandalone(node.left, candles, true, context);
            const hR = await this.evaluateNodeStandalone(node.right, candles, true, context);
            if (!Array.isArray(hL) || !Array.isArray(hR) || hL.length < 2 || hR.length < 2) return false;
            return hL[hL.length - 2] >= hR[hR.length - 2] && hL[hL.length - 1] < hR[hR.length - 1];
          }
        }
        return false;
      }

      case 'cross': {
        const valA = await this.evaluateNodeStandalone(node.a, candles, true, context);
        const valB = await this.evaluateNodeStandalone(node.b, candles, true, context);
        if (!Array.isArray(valA) || !Array.isArray(valB) || valA.length < 2 || valB.length < 2) return false;
        if (node.direction === 'above') return valA[valA.length - 2] <= valB[valB.length - 2] && valA[valA.length - 1] > valB[valB.length - 1];
        return valA[valA.length - 2] >= valB[valB.length - 2] && valA[valA.length - 1] < valB[valB.length - 1];
      }

      // ── Indicators (pure computation) ──
      case 'indicator': {
        const period = node.period || 14;
        const source = node.source || 'close';
        const values = candles.map(c => parseFloat(c[source] || c.close)).reverse();
        let result: number[];

        switch (node.indicator) {
          case 'RSI': result = this.indicatorsService.calculateRSI(values, period); break;
          case 'SMA': result = this.indicatorsService.calculateSMA(values, period); break;
          case 'EMA': result = this.indicatorsService.calculateEMA(values, period); break;
          case 'ATR': {
            const highs = candles.map(c => parseFloat(c.high)).reverse();
            const lows = candles.map(c => parseFloat(c.low)).reverse();
            result = this.indicatorsService.calculateATR(highs, lows, values, period);
            break;
          }
          default: result = this.indicatorsService.calculateSMA(values, period);
        }
        if (!result || result.length === 0) return getHistory ? [0] : 0;
        return getHistory ? result : result[result.length - 1];
      }

      case 'input':
        return getHistory ? closes : closes[closes.length - 1];

      case 'constant':
        return getHistory ? [node.value] : node.value;

      case 'scanner':
      case 'exchange_data':
      case 'exchange_scanner':
        return getHistory ? [closes[closes.length - 1]] : closes[closes.length - 1];

      // ── AI/External nodes → defaults in standalone mode ──
      case 'hermes':
      case 'heym_mcp':
      case 'mcp_tool':
      case 'llm_filter':
        return getHistory ? [true] : true;

      case 'sentiment':
        return getHistory ? [0] : 0;

      case 'deep_research':
        return getHistory ? [true] : true;

      case 'ai_forecast':
        return getHistory ? [0] : 0;

      case 'ml_filter':
        return getHistory ? [true] : true;

      case 'finviz_scanner':
      case 'order_flow':
      case 'orderbook':
      case 'exchange_scanner':
      case 'pump_dump':
      case 'fvg':
      case 'order_block':
      case 'eqh_eql':
      case 'custom_code':
      case 'webhook':
      case 'polymarket':
      case 'deribit_pcr':
        return getHistory ? [0] : 0;

      default:
        return getHistory ? [0] : 0;
    }
  }
}
