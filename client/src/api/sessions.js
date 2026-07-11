import axiosInstance from '../axiosInstance';

export const getSessions = (params) => axiosInstance.get('/v1/sessions', { params });
export const getLatestSession = () => axiosInstance.get('/v1/sessions/latest');
export const openSession = (data) => axiosInstance.post('/v1/sessions/open', data);
export const getActiveSession = () => axiosInstance.get('/v1/sessions/active');
export const closeSession = (id, data) => axiosInstance.post(`/v1/sessions/${id}/close`, data);
