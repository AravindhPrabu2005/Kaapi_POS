import axiosInstance from '../axiosInstance';

export const getFloors = (params) => axiosInstance.get('/v1/floors', { params });
export const getFloor = (id) => axiosInstance.get(`/v1/floors/${id}`);
export const createFloor = (data) => axiosInstance.post('/v1/floors', data);
export const updateFloor = (id, data) => axiosInstance.put(`/v1/floors/${id}`, data);
export const deleteFloor = (id) => axiosInstance.delete(`/v1/floors/${id}`);
