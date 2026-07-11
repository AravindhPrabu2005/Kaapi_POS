import axiosInstance from '../axiosInstance';

export const getKdsTickets = (params) => axiosInstance.get('/v1/kds/tickets', { params });
export const getKdsTicket = (id) => axiosInstance.get(`/v1/kds/tickets/${id}`);
export const advanceTicket = (id, targetStage) => axiosInstance.post(`/v1/kds/tickets/${id}/advance${targetStage ? `?target_stage=${targetStage}` : ''}`);
export const markItemComplete = (ticketId, itemId) => axiosInstance.patch(`/v1/kds/tickets/${ticketId}/items/${itemId}`, { completed: true });
