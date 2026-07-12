import { RiskManagerService } from './risk-manager.service';

describe('RiskManagerService — портфельные примитивы', () => {
  const svc = new RiskManagerService(null as any, null as any, null as any);

  describe('pearsonCorrelation', () => {
    it('полная положительная корреляция ≈ 1', () => {
      expect(svc.pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
    });
    it('полная отрицательная корреляция ≈ -1', () => {
      expect(svc.pearsonCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
    });
    it('вырожденный (константа) → 0', () => {
      expect(svc.pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBe(0);
    });
    it('слишком короткий ряд → 0', () => {
      expect(svc.pearsonCorrelation([1], [1])).toBe(0);
    });
  });

  describe('atrStopDistance', () => {
    it('считает ATR (Wilder) * mult', () => {
      const candles = [
        { high: 11, low: 9, close: 10 },
        { high: 12, low: 8, close: 11 },
        { high: 13, low: 9, close: 12 },
        { high: 14, low: 10, close: 13 },
      ];
      // TR=[4,4,4], period=2 → ATR=4, *1.5 = 6
      expect(svc.atrStopDistance(candles, 2, 1.5)).toBeCloseTo(6, 5);
    });
    it('null при нехватке свечей', () => {
      expect(svc.atrStopDistance([{ high: 1, low: 0, close: 0.5 }], 14, 1.5)).toBeNull();
    });
  });

  describe('checkWalletExposure', () => {
    it('блокирует при превышении лимита загрузки', () => {
      const r = svc.checkWalletExposure(700, 200, 1000, 80); // (700+200)/1000 = 90% > 80%
      expect(r.blocked).toBe(true);
    });
    it('пропускает в пределах лимита', () => {
      expect(svc.checkWalletExposure(500, 200, 1000, 80).blocked).toBe(false);
    });
    it('не блокирует при нулевом балансе/лимите', () => {
      expect(svc.checkWalletExposure(500, 200, 0, 80).blocked).toBe(false);
      expect(svc.checkWalletExposure(500, 200, 1000, 0).blocked).toBe(false);
    });
  });

  describe('checkCorrelationExposure', () => {
    const nr = [1, 2, 3, 4, 5];
    it('блокирует при концентрации коррелированных позиций', () => {
      const r = svc.checkCorrelationExposure(nr, [[2, 4, 6, 8, 10], [1, 2, 3, 4, 5]], 0.8, 2);
      expect(r.blocked).toBe(true);
    });
    it('пропускает при недостаточной концентрации', () => {
      const r = svc.checkCorrelationExposure(nr, [[5, 1, 4, 2, 3]], 0.8, 2);
      expect(r.blocked).toBe(false);
    });
  });
});
