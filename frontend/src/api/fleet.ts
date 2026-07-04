import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000`;

export const fleetApi = {
    getAll: () => axios.get(`${API_URL}/fleet`),
    create: (data: any) => axios.post(`${API_URL}/fleet`, data),
    start: (id: number) => axios.post(`${API_URL}/fleet/${id}/start`),
    stop: (id: number) => axios.post(`${API_URL}/fleet/${id}/stop`),
    panic: () => axios.post(`${API_URL}/fleet/panic`),
    getRisk: () => axios.get(`${API_URL}/fleet/risk`),
};
