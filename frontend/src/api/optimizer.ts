import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const optimizerApi = {
    run: (strategyId: number, options: any, params: any[]) => 
        axios.post(`${API_URL}/optimizer/${strategyId}/run`, { options, params }),
};
