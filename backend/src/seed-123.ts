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

  console.log('🌱 Seeding Test Strategy 123...');

  // Check if strategy 123 already exists
  const existing = await strategyRepo.findOneBy({ name: '123' });
  if (existing) {
    console.log('⚠️ Strategy 123 already exists. Removing it first to re-create...');
    await strategyRepo.remove(existing);
  }

  // Create strategy 123 nodes and edges
  const nodes = [
    { 
      id: '1', 
      type: 'exchange', 
      position: { x: 100, y: 200 }, 
      data: { 
        mode: 'scanner', 
        exchange: 'binance', 
        quoteAsset: 'USDT', 
        limit: 10, 
        sortBy: 'volume' 
      } 
    },
    { 
      id: '2', 
      type: 'indicator', 
      position: { x: 400, y: 150 }, 
      data: { 
        name: 'RSI', 
        params: { period: 14 } 
      } 
    },
    { 
      id: '3', 
      type: 'comparison', 
      position: { x: 700, y: 200 }, 
      data: { 
        operator: '<', 
        value: 30, 
        aValue: 0 
      } 
    },
    { 
      id: '4', 
      type: 'llm_filter', 
      position: { x: 1000, y: 200 }, 
      data: { 
        provider: 'deepseek', 
        model: 'deepseek-reasoner', 
        promptTemplate: 'Analyze {{pair}} market data. RSI: {{rsi}}. Trend is oversold. Decision: LONG or FILTER?', 
        temperature: 0.2, 
        mockBacktest: true 
      } 
    },
    { 
      id: '5', 
      type: 'signal', 
      position: { x: 1300, y: 200 }, 
      data: { 
        signalType: 'LONG' 
      } 
    }
  ];

  const edges = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3', targetHandle: 'a' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5', source: '4', target: '5' }
  ];

  const ast = compiler.compile(nodes, edges);

  const strat = strategyRepo.create({
    name: '123',
    description: 'Тестовая ИИ стратегия с бесплатным DeepSeek-Reasoner фильтром через Playwright браузерный обход лимитов.',
    nodes: nodes,
    edges: edges,
    ast: ast,
    pair: 'BTCUSDT',
    timeframe: '1h',
    is_active: true,
    is_paper_trading: true,
    execution_settings: {
      initialBalance: 1000,
      fee: 0.001,
      tp: 0.015,
      sl: 0.008,
      positionSize: 0.8,
    }
  });

  await strategyRepo.save(strat);
  console.log('✅ Strategy 123 successfully created and seeded into PostgreSQL!');

  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

seed().catch(err => {
  console.error('❌ Seeding strategy 123 failed:', err);
  process.exit(1);
});
