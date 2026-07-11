import axiosInstance from '../axiosInstance';

export const getEmployees = (params) => axiosInstance.get('/v1/employees', { params });
export const getEmployee = (id) => axiosInstance.get(`/v1/employees/${id}`);
export const createEmployee = (data) => axiosInstance.post('/v1/employees', data);
export const updateEmployee = (id, data) => axiosInstance.put(`/v1/employees/${id}`, data);
export const deleteEmployee = (id) => axiosInstance.delete(`/v1/employees/${id}`);
export const archiveEmployee = (id) => axiosInstance.post(`/v1/employees/${id}/archive`);
export const changeEmployeePassword = (id, data) => axiosInstance.post(`/v1/employees/${id}/change-password`, data);
