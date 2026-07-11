import axiosInstance from '../axiosInstance';

export const getOrders = (params) => axiosInstance.get('/v1/orders', { params });
export const getOrder = (id) => axiosInstance.get(`/v1/orders/${id}`);
export const createOrder = (data) => axiosInstance.post('/v1/orders', data);
export const updateOrder = (id, data) => axiosInstance.patch(`/v1/orders/${id}`, data);
export const deleteOrder = (id) => axiosInstance.delete(`/v1/orders/${id}`);
export const sendToKitchen = (id) => axiosInstance.post(`/v1/orders/${id}/send-to-kitchen`);
export const cancelOrder = (id, data) => axiosInstance.post(`/v1/orders/${id}/cancel`, data);
export const getOrderReceipt = (id) => axiosInstance.get(`/v1/orders/${id}/receipt`);
export const getOrderReceiptPdf = async (orderId) => {
  const response = await axiosInstance.get(`/v1/orders/${orderId}/receipt-pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `receipt-${orderId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
export const sendReceipt = (id, data) => axiosInstance.post(`/v1/orders/${id}/send-receipt`, data);

export const addOrderLine = (orderId, data) => axiosInstance.post(`/v1/orders/${orderId}/lines`, data);
export const updateOrderLine = (orderId, lineId, data) => axiosInstance.patch(`/v1/orders/${orderId}/lines/${lineId}`, data);
export const deleteOrderLine = (orderId, lineId) => axiosInstance.delete(`/v1/orders/${orderId}/lines/${lineId}`);

export const initiatePayment = (orderId, data) => axiosInstance.post(`/v1/orders/${orderId}/payments/initiate`, data);
export const confirmPayment = (orderId, data) => axiosInstance.post(`/v1/orders/${orderId}/payments/confirm`, data);
export const cancelPayment = (orderId, data) => axiosInstance.post(`/v1/orders/${orderId}/payments/cancel`, data);
export const getPayments = (orderId) => axiosInstance.get(`/v1/orders/${orderId}/payments`);

export const applyCoupon = (orderId, data) => axiosInstance.post(`/v1/orders/${orderId}/apply-coupon`, data);
export const removeCoupon = (orderId) => axiosInstance.post(`/v1/orders/${orderId}/remove-coupon`);
export const evaluatePromotions = (orderId) => axiosInstance.post(`/v1/orders/${orderId}/evaluate-promotions`);
