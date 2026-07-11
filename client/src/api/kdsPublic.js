import axios from 'axios';

const publicApi = axios.create({
  baseURL: `http://${window.location.hostname}:5000`,
});

export const getPublicTickets = (params) => publicApi.get('/v1/kds-public/tickets', { params });
export const advancePublicTicket = (id, targetStage) => publicApi.post(`/v1/kds-public/tickets/${id}/advance${targetStage ? `?target_stage=${targetStage}` : ''}`);
export const markPublicItemComplete = (ticketId, itemId) => publicApi.patch(`/v1/kds-public/tickets/${ticketId}/items/${itemId}`, { completed: true });
