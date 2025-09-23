import api from './api';

const getParts = (filters) => api.get('/products', { params: { ...filters, pageSize: 100 } });
const getCompanies = () => api.get('/products/groups/companies');
const getModelsByCompany = (company) => api.get('/products/groups/models', { params: { company } });
const getBrands = () => api.get('/products/groups/brands');
const getTypes = () => api.get('/products/groups/types');
const getYears = () => api.get('/products/groups/years');

const getPartById = (id) => {
    return api.get(`/products/${id}`);
};

const createPart = (payload) => {
    return api.post('/products', payload);
};

const updatePart = (id, payload) => {
    return api.put(`/products/${id}`, payload);
};

const deletePart = (id) => {
    return api.delete(`/products/${id}`);
};

const bikePartsService = {
    getParts,
    getCompanies,
    getModelsByCompany,
    getBrands,
    getTypes,
    getYears,
    getPartById,
    createPart,
    updatePart,
    deletePart,
    addReview: (id, payload) => api.post(`/products/${id}/reviews`, payload),
    getReviewStatus: (id) => api.get(`/products/${id}/review-status`),
};

export default bikePartsService;
