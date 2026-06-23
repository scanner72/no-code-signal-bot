import api from './strategies';

export const candlesApi = {
  getLatest: (pair: string, timeframe: string, limit = 150) =>
    api.get(`/candles/latest/${encodeURIComponent(pair)}/${timeframe}?limit=${limit}`),
  getTrackedSymbols: () => api.get('/candles/tracked'),
  searchSymbols: (q: string) => api.get(`/candles/symbols?q=${encodeURIComponent(q)}`),
};
