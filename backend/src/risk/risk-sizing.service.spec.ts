import { RiskSizingService } from './risk-sizing.service';

describe('RiskSizingService.computeNotional', () => {
  const svc = new RiskSizingService();

  it('fixed_notional returns the configured notional', () => {
    expect(svc.computeNotional('fixed_notional', { equity: 5000, entryPrice: 100, fixedNotional: 250 })).toBe(250);
  });
  it('equity_percent returns equity * pct', () => {
    expect(svc.computeNotional('equity_percent', { equity: 5000, entryPrice: 100, equityPct: 0.2 })).toBe(1000);
  });
  it('risk_percent = equity*R% / stopPct', () => {
    // risk 1% of 10000 = 100; stop 2% => notional 5000
    expect(svc.computeNotional('risk_percent', { equity: 10000, entryPrice: 100, riskPercent: 1, stopPct: 0.02 })).toBeCloseTo(5000, 6);
  });
  it('atr_based derives stopPct from atr then risk-sizes', () => {
    // atr 2, mult 2 => stopDist 4 on price 100 => stopPct 0.04; risk 2% of 10000=200 => 5000
    expect(svc.computeNotional('atr_based', { equity: 10000, entryPrice: 100, atr: 2, atrMultiplier: 2, riskPercent: 2 })).toBeCloseTo(5000, 6);
  });
  it('kelly clamps fraction and multiplies equity', () => {
    // winRate .55, avgWin 2, avgLoss 1 => payoff 2, f=(2*.55-.45)/2=0.325 -> clamp .25 => 2500
    expect(svc.computeNotional('kelly', { equity: 10000, entryPrice: 100, stats: { winRate: 0.55, avgWin: 2, avgLoss: 1 }, maxKelly: 0.25 })).toBeCloseTo(2500, 6);
  });
  it('falls back to equity_percent(0.1) when risk_percent lacks stopPct', () => {
    expect(svc.computeNotional('risk_percent', { equity: 4000, entryPrice: 100 })).toBeCloseTo(400, 6);
  });
  it('never returns negative', () => {
    expect(svc.computeNotional('kelly', { equity: 10000, entryPrice: 100, stats: { winRate: 0.1, avgWin: 1, avgLoss: 5 } })).toBeGreaterThanOrEqual(0);
  });
});
