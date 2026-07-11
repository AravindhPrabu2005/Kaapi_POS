import axiosInstance from '../axiosInstance';

export const getPaymentMethods = (params) => axiosInstance.get('/v1/payment-methods', { params });
export const getPaymentMethod = (id) => axiosInstance.get(`/v1/payment-methods/${id}`);
export const updatePaymentMethod = (id, data) => axiosInstance.patch(`/v1/payment-methods/${id}`, data);
export const getUpiQrCode = () => axiosInstance.get('/v1/payment-methods/upi/qr-code');
export const getSelfOrderingSettings = () => axiosInstance.get('/v1/self-ordering/settings');
export const updateSelfOrderingSettings = (data) => axiosInstance.put('/v1/self-ordering/settings', data);
