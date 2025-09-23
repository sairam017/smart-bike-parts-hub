const haversine = require('haversine-distance');
const axios = require('axios');
const BikePart = require('../models/BikePart');
const Shop = require('../models/Shop');

// Helper: get related items by category/type (fallback method)
async function findRelatedItems(partIds) {
    // Fetch selected parts
    const selectedParts = await BikePart.find({ _id: { $in: partIds } });
    const categories = selectedParts.map(p => p.type);
    // Find other parts in same categories, not already selected
    const related = await BikePart.find({ type: { $in: categories }, _id: { $nin: partIds } });
    return related;
}

// Get ML-powered recommendations from FastAPI service
async function getMLRecommendations(productId, numRecommendations = 10) {
    try {
        const mlUrl = process.env.ML_RECOMMENDATION_URL || 'http://localhost:8010';
        console.log(`Making ML request to: ${mlUrl}/recommendations/similar for product: ${productId}`);
        
        const response = await axios.post(`${mlUrl}/recommendations/similar`, {
            product_id: productId,
            num_recommendations: numRecommendations,
            include_out_of_stock: false
        }, { timeout: 5000 });
        
        console.log(`ML service response:`, response.data);
        return response.data.recommendations || [];
    } catch (error) {
        console.warn('ML recommendations failed, falling back to basic recommendations:', error.message);
        return null;
    }
}

exports.getRecommendations = async (req, res) => {
    try {
        const { partIds, location, productId } = req.body;
        
        console.log('Recommendation request received:', { partIds, location: !!location, productId });
        
        // If productId is provided, use ML recommendations for similar products
        if (productId) {
            try {
                const mlRecommendations = await getMLRecommendations(productId, 10);
                
                if (mlRecommendations && mlRecommendations.length > 0) {
                    console.log(`Found ${mlRecommendations.length} ML recommendations`);
                    
                    // Get full product details for each recommendation
                    const productIds = mlRecommendations.map(rec => rec.product_id);
                    const products = await BikePart.find({ _id: { $in: productIds } })
                        .populate('shop', 'name address location')
                        .populate('vendor', 'name');
                    
                    console.log(`Found ${products.length} products from database for ML recommendations`);
                    
                    // Add ML recommendation scores and calculate distances if location provided
                    const enrichedProducts = products.map(product => {
                        const mlRec = mlRecommendations.find(rec => rec.product_id === product._id.toString());
                        const enriched = {
                            ...product.toObject(),
                            similarity_score: mlRec ? mlRec.similarity_score : 0,
                            recommendation_reason: mlRec ? mlRec.reason : 'Similar product'
                        };
                        
                        // Calculate distance if location is provided
                        if (location && product.shop && product.shop.location && product.shop.location.coordinates) {
                            const [lng, lat] = product.shop.location.coordinates;
                            enriched.distance = haversine(
                                { lat: location.latitude, lon: location.longitude },
                                { lat, lon: lng }
                            ) / 1000; // km
                            enriched.shopName = product.shop.name;
                        }
                        
                        return enriched;
                    });
                    
                    return res.json({ 
                        items: enrichedProducts,
                        source: 'ml_recommendations',
                        total: enrichedProducts.length
                    });
                } else {
                    console.log('No ML recommendations found or ML service returned empty results');
                }
            } catch (mlError) {
                console.warn('ML service error, falling back to basic recommendations:', mlError.message);
            }
        }
        
        // Fallback to basic recommendations if ML fails or partIds are provided
        if (!Array.isArray(partIds) && !productId) {
            return res.status(400).json({ items: [], error: 'Invalid request parameters - need either partIds or productId' });
        }
        
        // For basic recommendations, we need partIds
        if (productId && !partIds) {
            // If we only have productId but ML failed, create a fallback by using the current product as basis
            console.log('Creating fallback recommendations based on productId');
            const currentProduct = await BikePart.findById(productId);
            if (currentProduct) {
                const fallbackPartIds = [productId];
                const relatedItems = await findRelatedItems(fallbackPartIds);
                
                return res.json({ 
                    items: relatedItems.slice(0, 10),
                    source: 'fallback_recommendations',
                    total: relatedItems.length
                });
            }
        }
        
        if (!Array.isArray(partIds)) {
            return res.status(400).json({ items: [], error: 'partIds must be an array for basic recommendations' });
        }
        
        // 1. Find related items using basic method
        let relatedItems = await findRelatedItems(partIds);
        
        // 2. Filter by rating
        relatedItems = relatedItems.filter(item => (item.rating || 0) >= 4);
        
        // 3. Calculate distance
        for (const item of relatedItems) {
            const shop = await Shop.findById(item.shop);
            if (shop && shop.location && shop.location.coordinates) {
                const [lng, lat] = shop.location.coordinates;
                item.distance = haversine(
                    { lat: location.latitude, lon: location.longitude },
                    { lat, lon: lng }
                ) / 1000; // km
                item.shopName = shop.name;
            } else {
                item.distance = null;
            }
        }
        
        // 4. Sort by distance (nearest first)
        relatedItems = relatedItems.filter(item => item.distance !== null);
        relatedItems.sort((a, b) => a.distance - b.distance);
        
        // 5. Return top 10
        res.json({ 
            items: relatedItems.slice(0, 10),
            source: 'basic_recommendations',
            total: relatedItems.length
        });
    } catch (err) {
        console.error('Recommendations error:', err);
        res.status(500).json({ items: [], error: 'Failed to get recommendations' });
    }
};
