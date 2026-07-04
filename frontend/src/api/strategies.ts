import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`,
});

export const strategiesApi = {
  create: (data) => api.post('/strategies', data),
  getAll: () => api.get('/strategies'),
  getById: (id) => api.get(`/strategies/${id}`),
  update: (id, data) => api.patch(`/strategies/${id}`, data),
  toggle: (id) => api.patch(`/strategies/${id}/toggle`),
  delete: (id: number) => api.delete(`/strategies/${id}`),
  backtest: (id: number, params: BacktestParams) => api.post(`/backtest/${id}`, params),
  backtestJobStatus: (jobId: string) => api.get(`/backtest/job/${jobId}`),
  validate: (data: { nodes: any[]; edges: any[] }) => api.post('/strategies/validate', data),

  // Versioning
  getVersions: (id: number) => api.get(`/strategies/${id}/versions`),
  getVersion: (id: number, version: number) => api.get(`/strategies/${id}/versions/${version}`),
  restoreVersion: (id: number, version: number) => api.post(`/strategies/${id}/versions/${version}/restore`),
};

export const signalStatsApi = {
  /** Batch stats for all strategies (week/today counts) */
  getAllStrategiesStats: () => api.get('/signals/stats/strategies'),
  /** Stats for a specific strategy */
  getByStrategy: (id: number) => api.get(`/signals/stats/strategy/${id}`),
};

export const paperTradingApi = {
  /** Win rates per strategy from closed virtual trades */
  getWinRates: () => api.get('/paper-trading/winrates'),
};

export interface BacktestParams {
  start: string;
  end: string;
  initialBalance: number;
  fee: number;
  tp: number;
  sl: number;
  positionSize: number;
  accurate?: boolean;
  useTrailingStop?: boolean;
  trailingDistance?: number;
  trailingActivation?: number;
  slippagePct?: number;
  latencyMs?: number;
  executionAlgo?: 'MARKET' | 'TWAP' | 'VWAP';
  userLevels?: any[];
}

export default api;
