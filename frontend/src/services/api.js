import axios from 'axios';
import { getAccessToken, clearSession } from './authSession.js';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động gắn JWT token vào mọi request
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Xử lý 401 → redirect về login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
    }
    return Promise.reject(error);
  }
);

export default api;
