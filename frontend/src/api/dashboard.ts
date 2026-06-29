import api from './strategies';

export const indicatorsApi = {
  getSmcZones: (pair: string, timeframe: string) => 
    api.get(`/indicators/smc_query?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}`),
};

export const signalsApi = {
  getHistory: (limit = 20) => api.get(`/signals?limit=${limit}`),
  getByPair: (pair: string) => api.get(`/signals?pair=${encodeURIComponent(pair)}`),
  getExecutionTrace: (id: number) => api.get(`/signals/execution-trace/${id}`),
};

export const systemApi = {
  getHealth: () => api.get('/health'),
  getCrossExchangeDeltas: () => api.get('/cross-exchange/deltas'),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getScreener: () => api.get('/dashboard/screener'),
  getFunding: () => api.get('/dashboard/funding'),
  getOpenInterest: () => api.get('/dashboard/open-interest'),
  getLiquidations: () => api.get('/dashboard/liquidations'),
};

export const paperTradingApi = {
  getEquityCurve: () => api.get('/paper-trading/equity-curve'),
  getHistory: () => api.get('/paper-trading/history'),
  getWinRates: () => api.get('/paper-trading/winrates'),
  closeTrade: (id: number) => api.post(`/paper-trading/close/${id}`),
};

