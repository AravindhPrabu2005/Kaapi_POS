import axiosInstance from '../axiosInstance';

export const resolveQrToken = (token) => axiosInstance.get(`/v1/self-ordering/resolve/${token}`);
export const getMenu = (tableId, search = '') => axiosInstance.get('/v1/self-ordering/menu', { params: { table_id: tableId, search: search || undefined } });
export const placeOrder = (data) => axiosInstance.post('/v1/self-ordering/orders', data);
export const getOrderStatus = (orderId) => axiosInstance.get(`/v1/self-ordering/orders/${orderId}/status`);
export const getOrderHistory = (tableId) => axiosInstance.get('/v1/self-ordering/orders/history', { params: { table_id: tableId } });
