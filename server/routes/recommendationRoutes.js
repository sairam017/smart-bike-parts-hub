const express = require('express');
const router = express.Router();
const { getRecommendations } = require('../controllers/recommendationController');

// POST /api/recommendations/recommendations - Get recommendations for multiple parts or single product
router.post('/recommendations', getRecommendations);

// GET /api/recommendations/similar/:productId - Get similar products for a specific product
router.get('/similar/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { getRecommendations } = require('../controllers/recommendationController');
        
        // Create a request object with productId
        const mockReq = {
            body: {
                productId: productId,
                location: null // Location is optional for ML recommendations
            }
        };
        
        // Call the recommendations controller
        await getRecommendations(mockReq, res);
    } catch (error) {
        res.status(500).json({ items: [], error: 'Failed to get recommendations' });
    }
});

module.exports = router;
