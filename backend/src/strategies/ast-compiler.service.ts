import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AstCompilerService {
  private readonly logger = new Logger(AstCompilerService.name);

  /**
   * Compiles React Flow nodes and edges into a simplified AST for the execution engine.
   */
  compile(nodes: any[], edges: any[]): any {
    // Find the 'signal' node (root of the strategy)
    const signalNode = nodes.find((n) => n.type === 'signal');
    if (!signalNode) {
      throw new Error('Signal node not found');
    }

    return this.buildNodeAst(signalNode, nodes, edges);
  }

  private buildNodeAst(currentNode: any, allNodes: any[], allEdges: any[]): any {
    const ast = this.buildNodeAstRaw(currentNode, allNodes, allEdges);
    if (ast && typeof ast === 'object' && !Array.isArray(ast)) {
      ast.id = currentNode.id;
    }
    return ast;
  }

  private buildNodeAstRaw(currentNode: any, allNodes: any[], allEdges: any[]): any {
    const nodeType = currentNode.type || 'unknown';

    // Get input edges to this node
    const inputEdges = allEdges.filter((e) => e.target === currentNode.id);

    switch (nodeType) {
      case 'signal':
        const inputEdge = inputEdges[0];
        if (!inputEdge) return null;
        const sourceNode = allNodes.find((n) => n.id === inputEdge.source);
        return {
          type: 'signal',
          signalType: currentNode.data.signalType || 'LONG',
          condition: this.buildNodeAst(sourceNode, allNodes, allEdges),
        };

      case 'logic':
        const operands = inputEdges.map((e) => {
          const operandNode = allNodes.find((n) => n.id === e.source);
          return this.buildNodeAst(operandNode, allNodes, allEdges);
        });
        return {
          type: 'logic',
          operator: currentNode.data.operator || 'AND',
          operands,
        };

      case 'logic_corr':
        return {
          type: 'logic_corr',
          pair: currentNode.data.pair || 'BTCUSDT',
          minCorr: currentNode.data.minCorr || 0.8,
        };

      case 'comparison':
        const leftEdge = inputEdges.find((e) => e.targetHandle === 'a' || !e.targetHandle);
        const rightEdge = inputEdges.find((e) => e.targetHandle === 'b');
        
        const leftNode = allNodes.find((n) => n.id === leftEdge?.source);
        const leftOperand = leftNode ? this.buildNodeAst(leftNode, allNodes, allEdges) : currentNode.data.aValue;
        
        const rightNode = allNodes.find((n) => n.id === rightEdge?.source);
        const rightOperand = rightNode ? this.buildNodeAst(rightNode, allNodes, allEdges) : (currentNode.data.value ?? currentNode.data.bValue);

        return {
          type: 'comparison',
          operator: currentNode.data.operator || '>',
          left: leftOperand,
          right: rightOperand,
        };

      case 'indicator':
        return {
          type: 'indicator',
          name: currentNode.data.name,
          params: currentNode.data.params || {},
          timeframe: currentNode.data.timeframe, // MTF support
          ...(currentNode.data.property != null && { property: currentNode.data.property }),
        };

      case 'input':
        return {
          type: 'input',
          source: currentNode.data.source || 'markPrice',
          params: currentNode.data.params || { pair: '', operator: 'none' },
          timeframe: currentNode.data.timeframe, // MTF support
        };

      case 'cross':
        const aEdge = inputEdges.find((e) => e.targetHandle === 'a' || !e.targetHandle);
        const bEdge = inputEdges.find((e) => e.targetHandle === 'b');
        const aNode = allNodes.find((n) => n.id === aEdge?.source);
        const bNode = allNodes.find((n) => n.id === bEdge?.source);
        return {
          type: 'cross',
          direction: currentNode.data.direction || 'above', // 'above' or 'below'
          timeframe: currentNode.data.timeframe, // MTF support
          a: aNode ? this.buildNodeAst(aNode, allNodes, allEdges) : currentNode.data.aValue,
          b: bNode ? this.buildNodeAst(bNode, allNodes, allEdges) : currentNode.data.bValue,
        };

      case 'pump_dump':
        return {
          type: 'pump_dump',
          timeframe: currentNode.data.timeframe,
          params: {
            priceThreshold: currentNode.data.priceThreshold || 5,
            volMultiplier: currentNode.data.volMultiplier || 2,
            lookback: currentNode.data.lookback || 3,
          },
        };

      case 'fvg':
        return {
          type: 'fvg',
          timeframe: currentNode.data.timeframe,
          params: {
            lookback: currentNode.data.lookback || 50,
            minSize: currentNode.data.minSize || 0, // In percentage
          },
        };

      case 'order_block':
        return {
          type: 'order_block',
          timeframe: currentNode.data.timeframe,
          params: {
            lookback: currentNode.data.lookback || 100,
            obType: currentNode.data.obType || 'BULLISH',
          },
        };

      case 'market_structure':
        return {
          type: 'market_structure',
          timeframe: currentNode.data.timeframe,
          params: {
            lookback: currentNode.data.lookback || 150,
          },
        };

      case 'liquidity_sweep':
        return {
          type: 'liquidity_sweep',
          timeframe: currentNode.data.timeframe,
          params: {
            lookback: currentNode.data.lookback || 100,
            sweepType: currentNode.data.sweepType || 'ANY', // 'HIGH', 'LOW', 'ANY'
          },
        };

      case 'scanner':
        return {
          type: 'scanner',
          source: currentNode.data.source || 'volume',
          params: currentNode.data.params || { period: '24h' },
        };

      case 'finviz_scanner':
        return {
          type: 'finviz_scanner',
          params: {
            signal: currentNode.data.signal || 'top_gainers',
            minVolume: currentNode.data.minVolume || '1,000,000',
            minPrice: currentNode.data.minPrice || 10,
          },
        };

      case 'order_flow':
        return {
          type: 'order_flow',
          metric: currentNode.data.metric || 'delta',
          params: currentNode.data.params || {},
        };

      case 'time_filter':
      case 'timeFilter':
        return {
          type: 'time_filter',
          timeframe: currentNode.data.timeframe,
          params: {
            from: currentNode.data.from || '08:00',
            to: currentNode.data.to || '22:00',
            timezone: currentNode.data.timezone || 'UTC',
          },
        };

      case 'mtf': {
        const inputEdge = inputEdges[0];
        const sourceNode = inputEdge ? allNodes.find((n) => n.id === inputEdge.source) : null;
        return {
          type: 'mtf',
          timeframe: currentNode.data.timeframe || '1H',
          condition: sourceNode ? this.buildNodeAst(sourceNode, allNodes, allEdges) : null,
        };
      }

      case 'smc': {
        const smcType = currentNode.data.type;
        const common = { timeframe: currentNode.data.timeframe };
        switch (smcType) {
          case 'fvg':
            return { type: 'fvg', ...common, params: { lookback: currentNode.data.params?.lookback || 50, onlyUnmitigated: currentNode.data.params?.onlyUnmitigated || false } };
          case 'eqh_eql':
            return { type: 'eqh_eql', ...common, params: { lookback: currentNode.data.params?.lookback || 100, thresholdPct: currentNode.data.params?.thresholdPct || 0.05 } };
          case 'order_block':
            return { type: 'order_block', ...common, params: { lookback: currentNode.data.params?.lookback || 100, obType: currentNode.data.params?.obType || 'BULLISH', minDisplacement: currentNode.data.params?.minDisplacement || 2.0 } };
          case 'market_structure':
            return { type: 'market_structure', ...common, params: { lookback: currentNode.data.params?.lookback || 20 }, property: currentNode.data.property };
          case 'liquidity_sweep':
            return { type: 'liquidity_sweep', ...common, params: { lookback: currentNode.data.params?.lookback || 100, sweepType: currentNode.data.params?.sweepType || 'ANY' } };
          case 'daily_bias':
            return { type: 'daily_bias', ...common, params: {} };
          case 'power_of_3':
            return { type: 'power_of_3', ...common, params: {}, property: currentNode.data.property };
          case 'premium_discount':
            return { type: 'premium_discount', ...common, params: { lookback: currentNode.data.params?.lookback || 100 } };
          case 'ict_killzone':
            return { type: 'ict_killzone', ...common, params: { zone: currentNode.data.params?.zone || 'LONDON' } };
          case 'sentiment':
            return { type: 'sentiment', ...common, params: {}, property: currentNode.data.property || 'score' };
          default:
            return null;
        }
      }

      case 'ai_forecast':
        return {
          type: 'ai_forecast',
          params: {
            model: currentNode.data.model || 'auto',
            predLen: currentNode.data.predLen || 24,
            minConfidence: currentNode.data.minConfidence || 0.6,
            temperature: currentNode.data.temperature || 0.8,
            sampleCount: currentNode.data.sampleCount || 3,
          },
          property: currentNode.data.property || 'direction',
        };

      case 'orderbook':
        return {
          type: 'orderbook',
          params: {
            metric: currentNode.data.metric || 'imbalance',
            levels: currentNode.data.levels || 20,
          },
        };

      case 'exchange_data':
        return {
          type: 'exchange_data',
          exchange: currentNode.data.exchange || 'binance',
          dataType: currentNode.data.dataType || 'price',
          pair: currentNode.data.pair || 'BTCUSDT',
          compareExchange: currentNode.data.compareExchange,
        };

      case 'exchange_scanner':
        return {
          type: 'exchange_scanner',
          exchange: currentNode.data.exchange || 'binance',
          quoteAsset: currentNode.data.quoteAsset || 'USDT',
          limit: currentNode.data.limit || 20,
          symbols: currentNode.data.symbols,
          sortBy: currentNode.data.sortBy || 'volume',
          minVolume24h: currentNode.data.minVolume24h,
          maxVolume24h: currentNode.data.maxVolume24h,
          minPrice: currentNode.data.minPrice,
          maxPrice: currentNode.data.maxPrice,
          minChangePercent: currentNode.data.minChangePercent,
          maxChangePercent: currentNode.data.maxChangePercent,
        };

      case 'exchange': {
        const mode = currentNode.data.mode || 'ticker';
        if (mode === 'scanner') {
          return {
            type: 'exchange_scanner',
            exchange: currentNode.data.exchange || 'binance',
            quoteAsset: currentNode.data.quoteAsset || 'USDT',
            limit: currentNode.data.limit || 20,
            symbols: currentNode.data.symbols,
            sortBy: currentNode.data.sortBy || 'volume',
            minVolume24h: currentNode.data.minVolume24h,
            maxVolume24h: currentNode.data.maxVolume24h,
            minPrice: currentNode.data.minPrice,
            maxPrice: currentNode.data.maxPrice,
            minChangePercent: currentNode.data.minChangePercent,
            maxChangePercent: currentNode.data.maxChangePercent,
          };
        } else if (mode === 'orderbook') {
          return {
            type: 'orderbook',
            exchange: currentNode.data.exchange || 'binance',
            params: {
              metric: currentNode.data.metric || 'imbalance',
              levels: currentNode.data.levels || 20,
            },
          };
        } else if (mode === 'orderflow' || mode === 'order_flow') {
          return {
            type: 'order_flow',
            exchange: currentNode.data.exchange || 'binance',
            metric: currentNode.data.metric || 'delta',
            params: {
              period: currentNode.data.period || '1h',
              side: currentNode.data.side || 'BOTH',
              threshold: currentNode.data.threshold,
            },
          };
        } else {
          return {
            type: 'exchange_data',
            exchange: currentNode.data.exchange || 'binance',
            dataType: currentNode.data.dataType || 'price',
            pair: currentNode.data.pair || 'BTCUSDT',
            compareExchange: currentNode.data.compareExchange,
          };
        }
      }

      case 'deribit_pcr':
        return {
          type: 'deribit_pcr',
          params: currentNode.data.params || {},
        };

      case 'fusion_combiner': {
        const operands = inputEdges.map((e) => {
          const operandNode = allNodes.find((n) => n.id === e.source);
          return {
            sourceId: e.source,
            ast: this.buildNodeAst(operandNode, allNodes, allEdges),
          };
        });
        return {
          type: 'fusion_combiner',
          weights: currentNode.data.weights || {},
          params: currentNode.data.params || { threshold: 0.5, enableLearning: false, alpha: 0.1 },
          operands,
        };
      }

      case 'hermes': {
        const inputEdge = inputEdges[0];
        const sourceNode = inputEdge ? allNodes.find((n) => n.id === inputEdge.source) : null;
        return {
          type: 'hermes',
          params: {
            mode: currentNode.data.mode || 'filter',
            model: currentNode.data.model || 'nous-hermes-3',
            promptTemplate: currentNode.data.promptTemplate || 'You are a crypto filter. Should we execute this signal?\nContext:\nPair: {{pair}}\nPrice: {{price}}\nRSI: {{rsi}}\n\nReply with JSON: { "decision": "PASS", "confidence": 0.8 }',
            threshold: currentNode.data.threshold || 0.6,
            cacheMinutes: currentNode.data.cacheMinutes || 15,
            mockBacktest: currentNode.data.mockBacktest || true,
          },
          condition: sourceNode ? this.buildNodeAst(sourceNode, allNodes, allEdges) : null,
        };
      }

      case 'deep_research':
        return {
          type: 'deep_research',
          params: {
            query: currentNode.data.query ||
              'Analyze recent news, regulatory risks, hacks or market-moving events for {{pair}} cryptocurrency.',
            mode: currentNode.data.mode || 'quick',
            cacheMinutes: currentNode.data.cacheMinutes ?? 15,
            riskThreshold: currentNode.data.riskThreshold || 'high',
            outputMode: currentNode.data.outputMode || 'risk_filter',
            enableHermesEnrich: currentNode.data.enableHermesEnrich ?? false,
          },
        };

      case 'portfolio_risk_sizer': {
        const inputEdge = inputEdges[0];
        const sourceNode = inputEdge ? allNodes.find((n) => n.id === inputEdge.source) : null;
        return {
          type: 'portfolio_risk_sizer',
          params: {
            baseSize: currentNode.data.baseSize ?? 100,
            riskModel: currentNode.data.riskModel || 'equal_risk',
            correlationThreshold: currentNode.data.correlationThreshold ?? 0.7,
            volatilityLookback: currentNode.data.volatilityLookback ?? 14,
          },
          condition: sourceNode ? this.buildNodeAst(sourceNode, allNodes, allEdges) : null,
        };
      }

      case 'heym_mcp': {
        const inputEdge = inputEdges[0];
        const sourceNode = inputEdge ? allNodes.find((n) => n.id === inputEdge.source) : null;
        return {
          type: 'heym_mcp',
          params: {
            mode: currentNode.data.mode || 'filter',
            threshold: currentNode.data.threshold ?? 0.6,
            cacheMinutes: currentNode.data.cacheMinutes ?? 15,
            mockBacktest: currentNode.data.mockBacktest ?? true,
            additionalContext: currentNode.data.additionalContext || '',
          },
          condition: sourceNode ? this.buildNodeAst(sourceNode, allNodes, allEdges) : null,
        };
      }

      case 'llm_filter': {
        const inputEdge = inputEdges[0];
        const sourceNode = inputEdge ? allNodes.find((n) => n.id === inputEdge.source) : null;
        return {
          type: 'llm_filter',
          params: {
            provider: currentNode.data.provider || 'qwen',
            model: currentNode.data.model || (currentNode.data.provider === 'deepseek' ? 'deepseek-reasoner' : 'qwen-max'),
            prompt: currentNode.data.promptTemplate || 'Analyze {{pair}} market data. RSI: {{rsi}}. Trend is oversold. Decision: LONG or FILTER?',
            temperature: currentNode.data.temperature ?? 0.2,
            mockBacktest: currentNode.data.mockBacktest ?? true,
          },
          condition: sourceNode ? this.buildNodeAst(sourceNode, allNodes, allEdges) : null,
        };
      }

      case 'conditional_fork': {
        const trueEdge = inputEdges.find((e) => e.sourceHandle === 'true');
        const falseEdge = inputEdges.find((e) => e.sourceHandle === 'false');

        return {
          type: 'conditional_fork',
          condition: currentNode.data.condition || 'unknown',
          trueSignal: currentNode.data.trueSignal || 'LONG',
          falseSignal: currentNode.data.falseSignal || 'SHORT',
          trueLabel: currentNode.data.trueLabel,
          falseLabel: currentNode.data.falseLabel,
        };
      }

      case 'accumulator': {
        const inputEdge = inputEdges[0];
        const sourceNode = inputEdge ? allNodes.find((n) => n.id === inputEdge.source) : null;
        return {
          type: 'accumulator',
          varName: currentNode.data.varName || 'counter',
          initialValue: currentNode.data.initialValue || 0,
          incrementCondition: sourceNode ? this.buildNodeAst(sourceNode, allNodes, allEdges) : currentNode.data.incrementCondition,
          resetCondition: currentNode.data.resetCondition,
          incrementValue: currentNode.data.incrementValue || 1,
        };
      }

      default:
        return currentNode.data.value || 0;
    }
  }
}
