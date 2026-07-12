import * as ccxt from 'ccxt';
import { classifyCcxtError, normalizeAmountPrice } from './ccxt-error.util';

describe('classifyCcxtError', () => {
  it('InsufficientFunds → permanent', () => {
    const c = classifyCcxtError(new ccxt.InsufficientFunds('no funds'));
    expect(c).toEqual({ permanent: true, category: 'INSUFFICIENT_FUNDS' });
  });

  it('InvalidOrder → permanent', () => {
    const c = classifyCcxtError(new ccxt.InvalidOrder('bad order'));
    expect(c.permanent).toBe(true);
    expect(c.category).toBe('INVALID_ORDER');
  });

  it('AuthenticationError → permanent', () => {
    const c = classifyCcxtError(new ccxt.AuthenticationError('bad key'));
    expect(c).toEqual({ permanent: true, category: 'AUTH' });
  });

  it('RateLimitExceeded → transient', () => {
    const c = classifyCcxtError(new ccxt.RateLimitExceeded('slow down'));
    expect(c).toEqual({ permanent: false, category: 'RATE_LIMIT' });
  });

  it('NetworkError → transient', () => {
    const c = classifyCcxtError(new ccxt.NetworkError('timeout'));
    expect(c).toEqual({ permanent: false, category: 'NETWORK' });
  });

  it('неизвестная ошибка → transient UNKNOWN', () => {
    const c = classifyCcxtError(new Error('boom'));
    expect(c).toEqual({ permanent: false, category: 'UNKNOWN' });
  });
});

describe('normalizeAmountPrice', () => {
  it('применяет amountToPrecision/priceToPrecision', () => {
    const ex = {
      amountToPrecision: (_p: string, a: number) => a.toFixed(3),
      priceToPrecision: (_p: string, p: number) => p.toFixed(1),
    };
    const r = normalizeAmountPrice(ex, 'BTC/USDT', 0.123456, 50000.987);
    expect(r.amount).toBeCloseTo(0.123);
    expect(r.price).toBeCloseTo(50001.0);
  });

  it('фолбэк на сырые значения при ошибке precision', () => {
    const ex = {
      amountToPrecision: () => { throw new Error('no market'); },
    };
    const r = normalizeAmountPrice(ex, 'BTC/USDT', 1.5, 100);
    expect(r.amount).toBe(1.5);
    expect(r.price).toBe(100);
  });

  it('без методов биржи возвращает исходные значения', () => {
    const r = normalizeAmountPrice({}, 'BTC/USDT', 2, 200);
    expect(r).toEqual({ amount: 2, price: 200 });
  });
});
