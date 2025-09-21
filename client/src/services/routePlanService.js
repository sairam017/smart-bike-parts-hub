import api from './api';

// body: { origin:{lat,lon}, parts:[ids], shops:[{id,name,lat,lon,parts:[]}] }
export const planRoute = (body) => api.post('/route-plan', body);

export default { planRoute };