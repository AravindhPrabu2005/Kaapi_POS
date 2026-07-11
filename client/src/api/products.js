import axiosInstance from '../axiosInstance';

export const getProducts = (params) => axiosInstance.get('/v1/products', { params });
export const getProduct = (id) => axiosInstance.get(`/v1/products/${id}`);
export const createProduct = (data) => axiosInstance.post('/v1/products', data);
export const updateProduct = (id, data) => axiosInstance.put(`/v1/products/${id}`, data);
export const deleteProduct = (id) => axiosInstance.delete(`/v1/products/${id}`);
