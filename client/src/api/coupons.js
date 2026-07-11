import axiosInstance from '../axiosInstance';

export const getCoupons = (params) => axiosInstance.get('/v1/coupons', { params });
export const getCoupon = (id) => axiosInstance.get(`/v1/coupons/${id}`);
export const createCoupon = (data) => axiosInstance.post('/v1/coupons', data);
export const updateCoupon = (id, data) => axiosInstance.put(`/v1/coupons/${id}`, data);
export const deleteCoupon = (id) => axiosInstance.delete(`/v1/coupons/${id}`);
export const validateCoupon = (data) => axiosInstance.post('/v1/coupons/validate', data);
export const lookupCoupon = (code) => axiosInstance.get(`/v1/coupons/lookup/${code}`);
