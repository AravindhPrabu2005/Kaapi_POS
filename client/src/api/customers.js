import axiosInstance from '../axiosInstance';

export const getCustomers = (params) => axiosInstance.get('/v1/customers', { params });
export const getCustomer = (id) => axiosInstance.get(`/v1/customers/${id}`);
export const createCustomer = (data) => axiosInstance.post('/v1/customers', data);
export const updateCustomer = (id, data) => axiosInstance.put(`/v1/customers/${id}`, data);
export const deleteCustomer = (id) => axiosInstance.delete(`/v1/customers/${id}`);
