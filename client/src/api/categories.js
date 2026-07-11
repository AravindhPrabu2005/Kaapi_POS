import axiosInstance from '../axiosInstance';

export const getCategories = (params) => axiosInstance.get('/v1/categories', { params });
export const getCategory = (id) => axiosInstance.get(`/v1/categories/${id}`);
export const createCategory = (data) => axiosInstance.post('/v1/categories', data);
export const updateCategory = (id, data) => axiosInstance.put(`/v1/categories/${id}`, data);
export const deleteCategory = (id) => axiosInstance.delete(`/v1/categories/${id}`);
