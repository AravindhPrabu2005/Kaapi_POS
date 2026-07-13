import axios from 'axios';

const isLocalhost = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.startsWith('192.168.');

const baseURL = isLocalhost 
  ? `http://${window.location.hostname}:5000` 
  : 'https://v0xi3e2k88.execute-api.eu-north-1.amazonaws.com/default/kaapi-pos-api';

const axiosInstance = axios.create({
  baseURL,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${baseURL}/v1/auth/refresh`, { refresh_token: refreshToken });
          localStorage.setItem('access_token', data.data.access_token);
          originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
          return axiosInstance(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;