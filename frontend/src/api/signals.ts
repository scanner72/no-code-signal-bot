import api from './strategies';

export const signalsApi = {
  getHistory: (limit?: number) => api.get('/signals', { params: { limit } }),
  getByPair: (pair: string) => api.get(`/signals/pair/${pair}`),
};
