import axiosInstance from '../axiosInstance';

export const getPromotions = (params) => axiosInstance.get('/v1/promotions', { params });
export const getPromotion = (id) => axiosInstance.get(`/v1/promotions/${id}`);
export const createPromotion = (data) => axiosInstance.post('/v1/promotions', data);
export const updatePromotion = (id, data) => axiosInstance.put(`/v1/promotions/${id}`, data);
export const deletePromotion = (id) => axiosInstance.delete(`/v1/promotions/${id}`);
export const evaluatePromotions = (data) => axiosInstance.post('/v1/promotions/evaluate', data);
