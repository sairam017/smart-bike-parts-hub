import api from './api';

const metaService = {
  getCompanies: () => api.get('/meta/companies'),
  getModels: (company) => api.get('/meta/models', { params: { company } }),
  upsertCompany: (payload) => api.post('/meta/companies', payload),
  upsertModel: (payload) => api.post('/meta/models', payload)
};

export default metaService;
