import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`,
});

export const settingsApi = {
  getAll: () => api.get('/settings'),
  updateDeduplication: (interval: number) => api.put('/settings/deduplication', { interval }),
  verifyTelegram: (chatId: string, botToken?: string) => api.post('/settings/telegram/verify', { chatId, botToken }),
  disconnectTelegram: () => api.post('/settings/telegram/disconnect'),
  testTelegram: () => api.post('/settings/telegram/test'),
  testDiscord: (webhookUrl: string) => api.post('/settings/discord/test', { webhookUrl }),
  update: (key: string, value: string) => api.put(`/settings/key/${key}`, { value }),
  // Heym MCP integration
  getHeym: () => api.get('/settings/integrations/heym'),
  saveHeym: (data: { url: string; apiKey: string; workflowId: string }) =>
    api.post('/settings/integrations/heym', data),
  testHeym: () => api.post('/settings/integrations/heym/test'),
  // Hermes AI Agent
  getHermes: () => api.get('/settings/integrations/hermes'),
  saveHermes: (data: { provider: string; url: string; model: string; apiKey: string }) =>
    api.post('/settings/integrations/hermes', data),
  testHermes: () => api.post('/settings/integrations/hermes/test'),
};
