import api from './api';

const shopsService = {
	getShops: (params = {}) => api.get('/shops', { params }),
	getShop: (id) => api.get(`/shops/${id}`),
	createShop: (payload) => api.post('/shops', payload),
	updateShop: (id, payload) => api.put(`/shops/${id}`, payload),
	deleteShop: (id) => api.delete(`/shops/${id}`)
};
export default shopsService;
