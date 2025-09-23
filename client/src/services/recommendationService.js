import api from './api';

const recommendationService = {
    // Get similar products for a specific product using ML recommendations
    getSimilarProducts: async (productId) => {
        try {
            const response = await api.get(`/recommendations/similar/${productId}`);
            return response;
        } catch (error) {
            console.error('Error fetching similar products:', error);
            throw error;
        }
    },

    // Get general recommendations based on multiple parts and location
    getRecommendations: async (partIds, location) => {
        try {
            const response = await api.post('/recommendations/recommendations', {
                partIds,
                location
            });
            return response;
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            throw error;
        }
    },

    // Get ML-powered recommendations for a specific product (with location if available)
    getMLRecommendations: async (productId, location = null) => {
        try {
            const response = await api.post('/recommendations/recommendations', {
                productId,
                location
            });
            return response;
        } catch (error) {
            console.error('Error fetching ML recommendations:', error);
            throw error;
        }
    }
};

export default recommendationService;