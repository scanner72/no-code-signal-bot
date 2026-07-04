import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`;

export const sentimentApi = {
    get: () => axios.get(`${API_URL}/sentiment`),
};
