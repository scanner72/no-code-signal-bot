import * as ccxt from 'ccxt';

export interface CcxtErrorClass {
  /** Постоянная ошибка — повтор бессмысленен (снять задачу с ретраев). */
  permanent: boolean;
  /** Категория для логов/уведомлений. */
  category:
    | 'INSUFFICIENT_FUNDS'
    | 'INVALID_ORDER'
    | 'AUTH'
    | 'RATE_LIMIT'
    | 'DDOS_PROTECTION'
    | 'EXCHANGE_UNAVAILABLE'
    | 'NETWORK'
    | 'UNKNOWN';
}

/**
 * Классифицирует ошибку CCXT: постоянная (не ретраить) vs временная (ретраить с back-off).
 * Порядок instanceof важен — в ccxt InsufficientFunds наследует InvalidOrder,
 * а RateLimitExceeded/DDoSProtection/ExchangeNotAvailable наследуют NetworkError.
 */
export function classifyCcxtError(error: any): CcxtErrorClass {
  if (error instanceof ccxt.InsufficientFunds) return { permanent: true, category: 'INSUFFICIENT_FUNDS' };
  if (error instanceof ccxt.InvalidOrder) return { permanent: true, category: 'INVALID_ORDER' };
  if (error instanceof ccxt.AuthenticationError) return { permanent: true, category: 'AUTH' };
  if (error instanceof ccxt.RateLimitExceeded) return { permanent: false, category: 'RATE_LIMIT' };
  if (error instanceof ccxt.DDoSProtection) return { permanent: false, category: 'DDOS_PROTECTION' };
  if (error instanceof ccxt.ExchangeNotAvailable) return { permanent: false, category: 'EXCHANGE_UNAVAILABLE' };
  if (error instanceof ccxt.NetworkError) return { permanent: false, category: 'NETWORK' };
  return { permanent: false, category: 'UNKNOWN' };
}

/**
 * Нормализует объём и цену под шаг/точность биржи (Invalid lot size / price step).
 * Требует загруженных markets. При любой ошибке — возвращает исходные значения.
 */
export function normalizeAmountPrice(
  exchange: any,
  pair: string,
  amount: number,
  price?: number,
): { amount: number; price?: number } {
  let a = amount;
  let p = price;
  try {
    if (typeof exchange?.amountToPrecision === 'function') {
      a = Number(exchange.amountToPrecision(pair, amount));
    }
  } catch {
    /* fallback to raw amount */
  }
  try {
    if (price != null && typeof exchange?.priceToPrecision === 'function') {
      p = Number(exchange.priceToPrecision(pair, price));
    }
  } catch {
    /* fallback to raw price */
  }
  return { amount: a, price: p };
}
