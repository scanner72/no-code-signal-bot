import { AstEvaluatorService } from './ast-evaluator.service';

describe('AstEvaluatorService — input node source (backtest)', () => {
  let service: AstEvaluatorService;

  // candles newest-first (candles[0] = current), как в бэктесте
  const candles = [
    { close: '105', mark_price: '104.5', funding_rate: '-0.0025', open_interest: '2000000' },
    { close: '100', mark_price: '99.8', funding_rate: '0.0010', open_interest: '1800000' },
  ];

  beforeEach(() => {
    service = new AstEvaluatorService(null as any, null as any);
  });

  const evalInput = (source: string | undefined, getHistory = false) =>
    service.evaluateNode({ type: 'input', source }, candles, getHistory, {}, { backtestMode: true });

  it('fundingRate → текущий funding_rate свечи, а не close', async () => {
    expect(await evalInput('fundingRate')).toBeCloseTo(-0.0025);
  });

  it('markPrice → mark_price свечи', async () => {
    expect(await evalInput('markPrice')).toBeCloseTo(104.5);
  });

  it('openInterest → open_interest свечи', async () => {
    expect(await evalInput('openInterest')).toBe(2000000);
  });

  it('без source (или close) → close как раньше', async () => {
    expect(await evalInput(undefined)).toBe(105);
    expect(await evalInput('close')).toBe(105);
  });

  it('fundingRate getHistory → хронологическая серия funding_rate', async () => {
    expect(await evalInput('fundingRate', true)).toEqual([0.001, -0.0025]);
  });

  it('markPrice fallback на close, funding/OI fallback на 0 при отсутствии поля', async () => {
    const bare = [{ close: '50' }];
    expect(await service.evaluateNode({ type: 'input', source: 'markPrice' }, bare, false, {}, { backtestMode: true })).toBe(50);
    expect(await service.evaluateNode({ type: 'input', source: 'fundingRate' }, bare, false, {}, { backtestMode: true })).toBe(0);
    expect(await service.evaluateNode({ type: 'input', source: 'openInterest' }, bare, false, {}, { backtestMode: true })).toBe(0);
  });
});
