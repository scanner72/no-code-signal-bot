import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`,
});

export interface CopilotRequest {
  provider?: 'qwen' | 'deepseek';
  prompt: string;
  currentNodes?: any[];
  currentEdges?: any[];
  pair?: string;
  timeframe?: string;
}

export interface CopilotResponse {
  thinking: string;
  strategy: {
    name: string;
    description: string;
    nodes: any[];
    edges: any[];
  } | null;
  rawAnswer: string;
}

export const freeAiApi = {
  copilot: (data: CopilotRequest) => api.post<{ success: boolean; data: CopilotResponse }>('/free-ai/copilot', data),
  status: () => api.get('/free-ai/status'),
};
