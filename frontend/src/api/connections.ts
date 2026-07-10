import api from './strategies';

export interface ConnectionDto {
  id: string;
  user_id: string | null;
  name: string;
  type: 'telegram_bot' | 'discord_webhook' | 'generic_webhook';
  configPreview: Record<string, string>;
  created_at: string;
}

export const connectionsApi = {
  list: (type?: string) => api.get<ConnectionDto[]>('/connections', { params: type ? { type } : {} }),
  create: (data: { name: string; type: string; config: Record<string, string> }) => api.post('/connections', data),
  update: (id: string, data: { name?: string; config?: Record<string, string> }) => api.patch(`/connections/${id}`, data),
  remove: (id: string) => api.delete(`/connections/${id}`),
  test: (id: string, chatId?: string) => api.post(`/connections/${id}/test`, { chatId }),
};

// canvas node type → connection type
export const NODE_CONNECTION_TYPE: Record<string, string> = {
  telegram_output: 'telegram_bot',
  discord_output: 'discord_webhook',
  webhook_output: 'generic_webhook',
};
