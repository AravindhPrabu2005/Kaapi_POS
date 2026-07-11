import axiosInstance from '../axiosInstance';

export const login = (data) => axiosInstance.post('/v1/auth/login', data);
export const signup = (data) => axiosInstance.post('/v1/auth/signup', data);
export const refresh = (data) => axiosInstance.post('/v1/auth/refresh', data);
export const logout = () => axiosInstance.post('/v1/auth/logout');
export const changePassword = (data) => axiosInstance.post('/v1/auth/change-password', data);
export const getMe = () => axiosInstance.get('/v1/users/me');
export const updateMe = (data) => axiosInstance.patch('/v1/users/me', data);
