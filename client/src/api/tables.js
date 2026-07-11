import axiosInstance from '../axiosInstance';

export const getTables = (params) => axiosInstance.get('/v1/tables', { params });
export const getTable = (id) => axiosInstance.get(`/v1/tables/${id}`);
export const createTable = (data) => axiosInstance.post('/v1/tables', data);
export const updateTable = (id, data) => axiosInstance.put(`/v1/tables/${id}`, data);
export const deleteTable = (id) => axiosInstance.delete(`/v1/tables/${id}`);
export const downloadQrCodesPdf = (floorId) => axiosInstance.get('/v1/tables/qr-codes/pdf', {
  params: floorId ? { floor_id: floorId } : {},
  responseType: 'blob',
});
