import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 15000
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register') {
        localStorage.removeItem('pc_token');
        localStorage.removeItem('pc_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;
