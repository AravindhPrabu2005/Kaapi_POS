import axios from 'axios';

const API_HOST = window.location.hostname;
const axiosInstance = axios.create({
  baseURL: `http://${API_HOST}:5000`,
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
          const { data } = await axios.post(`http://${API_HOST}:5000/v1/auth/refresh`, { refresh_token: refreshToken });
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