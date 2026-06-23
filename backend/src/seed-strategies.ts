import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Strategy } from './strategies/strategy.entity';
import { Repository } from 'typeorm';
import { AstCompilerService } from './strategies/ast-compiler.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const strategyRepo = app.get<Repository<Strategy>>(getRepositoryToken(Strategy));
  const compiler = app.get(AstCompilerService);

  console.log('🌱 Starting Strategy Seeder...');

  // Strategy 1: Momentum Scalper Top-20
  const nodes1 = [
    { id: '1', type: 'exchange', position: { x: 100, y: 200 }, data: { mode: 'scanner', exchange: 'binance', quoteAsset: 'USDT', limit: 20, sortBy: 'volume' } },
    { id: '2', type: 'indicator', position: { x: 400, y: 150 }, data: { name: 'RSI', params: { period: 14 } } },
    { id: '3', type: 'comparison', position: { x: 700, y: 200 }, data: { operator: '<', value: 30, aValue: 0 } },
    { id: '4', type: 'hermes', position: { x: 1000, y: 200 }, data: { mode: 'filter', model: 'nous-hermes-3', promptTemplate: 'Analyze {{pair}} market data. RSI: {{rsi}}. Trend is oversold. Determine if we should buy.', threshold: 0.6, cacheMinutes: 15, mockBacktest: true } },
    { id: '5', type: 'signal', position: { x: 1300, y: 200 }, data: { signalType: 'LONG' } }
  ];
  const edges1 = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3', targetHandle: 'a' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5', source: '4', target: '5' }
  ];
  const ast1 = compiler.compile(nodes1, edges1);

  const strat1 = strategyRepo.create({
    name: 'Momentum Scalper Top-20',
    description: 'Scans the Top-20 volume leaders on Binance, triggers on RSI oversold conditions, filters via LDR & Hermes AI cognitive risk analysis, and executes with institutional protection.',
    nodes: nodes1,
    edges: edges1,
    ast: ast1,
    pair: 'BINANCE_TOP20',
    timeframe: '15m',
    is_active: true,
    is_paper_trading: true,
    execution_settings: {
      initialBalance: 1000,
      fee: 0.001,
      tp: 0.02,
      sl: 0.01,
      positionSize: 0.9,
    }
  });

  // Strategy 2: Heym-MCP Whales Trend Follower
  const nodes2 = [
    { id: '1', type: 'exchange', position: { x: 100, y: 250 }, data: { mode: 'scanner', exchange: 'binance', quoteAsset: 'USDT', limit: 20, sortBy: 'change' } },
    { id: '2', type: 'indicator', position: { x: 400, y: 150 }, data: { name: 'SMA', params: { period: 10 } } },
    { id: '3', type: 'indicator', position: { x: 400, y: 350 }, data: { name: 'SMA', params: { period: 50 } } },
    { id: '4', type: 'comparison', position: { x: 700, y: 250 }, data: { operator: '>', aValue: 0, bValue: 0 } },
    { id: '5', type: 'heym_mcp', position: { x: 1000, y: 250 }, data: { mode: 'filter', threshold: 0.6, cacheMinutes: 15, mockBacktest: true, additionalContext: 'Checking institutional whale flow filters.' } },
    { id: '6', type: 'signal', position: { x: 1300, y: 250 }, data: { signalType: 'LONG' } }
  ];
  const edges2 = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e2-4', source: '2', target: '4', targetHandle: 'a' },
    { id: 'e3-4', source: '3', target: '4', targetHandle: 'b' },
    { id: 'e4-5', source: '4', target: '5' },
    { id: 'e5-6', source: '5', target: '6' }
  ];
  const ast2 = compiler.compile(nodes2, edges2);

  const strat2 = strategyRepo.create({
    name: 'Heym-MCP Whales Trend Follower',
    description: 'Tracks positive daily price change leaders in Binance Top-20, confirms trend using Dual SMA crossovers, and audits order execution via Heym MCP validator.',
    nodes: nodes2,
    edges: edges2,
    ast: ast2,
    pair: 'BINANCE_TOP20',
    timeframe: '1h',
    is_active: false,
    is_paper_trading: true,
    execution_settings: {
      initialBalance: 2000,
      fee: 0.001,
      tp: 0.03,
      sl: 0.015,
      positionSize: 0.5,
    }
  });

  // Strategy 3: Kronos AI Forecaster
  const nodes3 = [
    { id: '1', type: 'exchange', position: { x: 100, y: 200 }, data: { mode: 'scanner', exchange: 'binance', quoteAsset: 'USDT', limit: 20, sortBy: 'volume' } },
    { id: '2', type: 'ai_forecast', position: { x: 400, y: 200 }, data: { model: 'auto', predLen: 24, minConfidence: 0.7, temperature: 0.8, sampleCount: 3 } },
    { id: '3', type: 'comparison', position: { x: 700, y: 200 }, data: { operator: '==', value: 'UP', aValue: 0 } },
    { id: '4', type: 'portfolio_risk_sizer', position: { x: 1000, y: 200 }, data: { baseSize: 100, riskModel: 'equal_risk', correlationThreshold: 0.5, volatilityLookback: 14 } },
    { id: '5', type: 'signal', position: { x: 1300, y: 200 }, data: { signalType: 'LONG' } }
  ];
  const edges3 = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3', targetHandle: 'a' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5', source: '4', target: '5' }
  ];
  const ast3 = compiler.compile(nodes3, edges3);

  const strat3 = strategyRepo.create({
    name: 'Kronos AI Forecaster',
    description: 'Utilizes Kronos AI neural models to compute a 24-hour directional price forecast on Binance top-volume leaders, adjusts trade sizing using Pearson volatility correlation sizers, and triggers execution.',
    nodes: nodes3,
    edges: edges3,
    ast: ast3,
    pair: 'BINANCE_TOP20',
    timeframe: '4h',
    is_active: false,
    is_paper_trading: true,
    execution_settings: {
      initialBalance: 5000,
      fee: 0.0005,
      tp: 0.05,
      sl: 0.02,
      positionSize: 1.0,
    }
  });

  // Strategy 4: Free AI Signal Filter Scalper
  const nodes4 = [
    { id: '1', type: 'exchange', position: { x: 100, y: 200 }, data: { mode: 'scanner', exchange: 'binance', quoteAsset: 'USDT', limit: 20, sortBy: 'volume' } },
    { id: '2', type: 'indicator', position: { x: 400, y: 150 }, data: { name: 'RSI', params: { period: 14 } } },
    { id: '3', type: 'comparison', position: { x: 700, y: 200 }, data: { operator: '<', value: 30, aValue: 0 } },
    { id: '4', type: 'llm_filter', position: { x: 1000, y: 200 }, data: { provider: 'deepseek', model: 'deepseek-reasoner', promptTemplate: 'Analyze {{pair}} market data. RSI: {{rsi}}. Trend is oversold. Decision: LONG or FILTER?', temperature: 0.2, mockBacktest: true } },
    { id: '5', type: 'signal', position: { x: 1300, y: 200 }, data: { signalType: 'LONG' } }
  ];
  const edges4 = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3', targetHandle: 'a' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5', source: '4', target: '5' }
  ];
  const ast4 = compiler.compile(nodes4, edges4);

  const strat4 = strategyRepo.create({
    name: 'Free AI Signal Filter Scalper',
    description: 'Scans top volume assets, triggers on RSI oversold, and leverages cost-free DeepSeek / Qwen LLM web sessions to execute institutional grade filtering on signal confirmation.',
    nodes: nodes4,
    edges: edges4,
    ast: ast4,
    pair: 'BINANCE_TOP20',
    timeframe: '15m',
    is_active: false,
    is_paper_trading: true,
    execution_settings: {
      initialBalance: 1000,
      fee: 0.001,
      tp: 0.02,
      sl: 0.01,
      positionSize: 0.8,
    }
  });

  // Save all strategies
  await strategyRepo.save([strat1, strat2, strat3, strat4]);

  console.log('✅ Seeding completed! 4 premium AI test strategies successfully inserted.');
  
  // Clean termination bypassing background loops issues
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
