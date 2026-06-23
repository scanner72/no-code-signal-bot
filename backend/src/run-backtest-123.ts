import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Strategy } from './strategies/strategy.entity';
import { Repository } from 'typeorm';
import { BacktestService } from './backtest/backtest.service';

async function runBacktest() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const strategyRepo = app.get<Repository<Strategy>>(getRepositoryToken(Strategy));
  const backtestService = app.get(BacktestService);

  console.log('🔍 Locating Strategy 123 in PostgreSQL...');
  const strategy = await strategyRepo.findOneBy({ name: '123' });
  if (!strategy) {
    console.error('❌ Strategy 123 not found! Please run the seeder first.');
    process.exit(1);
  }
  console.log(`✅ Strategy found (ID: ${strategy.id}, Pair: ${strategy.pair}, Timeframe: ${strategy.timeframe})`);

  // Define 6 months range (Nov 30, 2025 to May 30, 2026)
  const start = new Date('2025-11-30T00:00:00.000Z');
  const end = new Date('2026-05-30T00:00:00.000Z');

  console.log(`📈 Running 6-Month Backtest for Strategy 123...`);
  console.log(`Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`);

  try {
    const results = await backtestService.run(strategy.id, {
      start,
      end,
      initialBalance: 1000,
      fee: 0.001,
      tp: 0.015,
      sl: 0.008,
      positionSize: 0.8,
      accurate: false,
    });

    console.log('\n==================================================');
    console.log('🏆 6-MONTH BACKTEST RESULTS FOR STRATEGY 123');
    console.log('==================================================');
    console.log(`Strategy Name:     ${results.strategyName}`);
    console.log(`Trading Pair:      ${results.pair}`);
    console.log(`Timeframe:         ${results.timeframe}`);
    console.log(`Initial Balance:   $${results.initialBalance}`);
    console.log(`Final Balance:     $${results.finalBalance}`);
    console.log(`Total Return:      ${results.totalReturn}%`);
    console.log(`Total Trades:      ${results.totalTrades}`);
    console.log(`Win Rate:          ${results.winRate}%`);
    console.log(`Max Drawdown:      ${results.maxDrawdown}%`);
    console.log(`Profit Factor:     ${results.profitFactor}`);
    console.log(`Sharpe Ratio:      ${results.sharpeRatio}`);
    console.log(`Sortino Ratio:     ${results.sortinoRatio}`);
    console.log(`Recovery Factor:   ${results.recoveryFactor}`);
    console.log(`Expectancy:        $${results.expectancy}`);
    console.log(`Max Consecutive Losses: ${results.maxConsecutiveLosses}`);
    console.log(`Largest Win:       $${results.largestWin}`);
    console.log(`Largest Loss:      $${results.largestLoss}`);
    console.log('--------------------------------------------------');
    console.log('🚀 Trade Statistics:');
    console.log(`  Long Trades:  ${results.longStats.total} (Win Rate: ${results.longStats.winRate}%)`);
    console.log(`  Short Trades: ${results.shortStats.total} (Win Rate: ${results.shortStats.winRate}%)`);
    console.log('==================================================\n');

    console.log('💡 AI Recommendations for Strategy 123:');
    results.recommendations.forEach((rec: any) => {
      console.log(`  - [${rec.type.toUpperCase()}] ${rec.text}`);
    });
    console.log('==================================================\n');

  } catch (error) {
    console.error('❌ Backtest execution failed:', error);
  }

  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

runBacktest().catch(err => {
  console.error('❌ Error executing runBacktest:', err);
  process.exit(1);
});
