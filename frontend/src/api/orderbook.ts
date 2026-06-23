import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const orderbookApi = {
    getDepth: (pair: string) => axios.get(`${API_URL}/orderbook/depth?pair=${pair}`),
    getClusters: (pair: string) => axios.get(`${API_URL}/orderbook/clusters?pair=${pair}`),
};
