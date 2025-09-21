import api from './api';

export const createVendorWithShop = (payload) => api.post('/admin/vendors/create', payload);
const listUsers = () => api.get('/admin/users');
const deleteUser = (id) => api.delete(`/admin/users/${id}`);
const resetUserPassword = (payload) => api.post('/admin/users/reset-password', payload);
const adminUpdateProduct = (id, payload) => api.put(`/admin/products/${id}`, payload);

const adminService = { createVendorWithShop, listUsers, deleteUser, resetUserPassword, adminUpdateProduct };
export default adminService;
