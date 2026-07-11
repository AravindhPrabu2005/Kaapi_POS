import axiosInstance from '../axiosInstance';

export const getDashboard = (params) => axiosInstance.get('/v1/reports/dashboard', { params });
export const exportReport = (data) => axiosInstance.post('/v1/reports/export', data, { responseType: 'blob' });
