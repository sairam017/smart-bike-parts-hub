import api from './api';

// body: { partIds:[mongoIds], origin:{lat,lon} }
const localRoutePlanService = {
	computeLocalRoute: (body) => api.post('/route-plan-local', body)
};
export default localRoutePlanService;
