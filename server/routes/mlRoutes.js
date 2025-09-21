const express = require('express');
const router = express.Router();
const axios = require('axios');
const BikePart = require('../models/BikePart');
const Shop = require('../models/Shop');
const auth = require('../middleware/authMiddleware');

// Configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8010';

/**
 * Utility function to transform MongoDB product to ML service format
 */
const transformProductForML = async (product) => {
    try {
        // Populate shop information if not already populated
        let populatedProduct = product;
        if (!product.shop.name) {
            populatedProduct = await BikePart.findById(product._id).populate('shop');
        }

        const shop = populatedProduct.shop;
        
        return {
            product_id: product._id.toString(),
            name: product.name || '',
            model: product.model || '',
            company: product.company || '',
            vehicleYear: product.vehicleYear || null,
            brand: product.brand || '',
            type: product.type || '',
            price: product.price || 0,
            description: product.description || '',
            countInStock: product.countInStock || 0,
            rating: product.rating || 0,
            numReviews: product.numReviews || 0,
            compatibility: product.compatibility || [],
            images: product.images || [],
            vendor_id: product.vendor?.toString() || '',
            shop_id: shop?._id?.toString() || '',
            shop_name: shop?.name || '',
            shop_address: shop?.address || '',
            shop_lat: shop?.location?.coordinates?.[1] || null,
            shop_lon: shop?.location?.coordinates?.[0] || null,
            created_at: product.createdAt?.toISOString() || new Date().toISOString(),
            updated_at: product.updatedAt?.toISOString() || new Date().toISOString()
        };
    } catch (error) {
        console.error('Error transforming product for ML:', error);
        throw error;
    }
};

/**
 * Send update to ML service
 */
const sendToMLService = async (action, productData = null, productId = null) => {
    try {
        const payload = {
            action: action,
            product_data: productData,
            product_id: productId
        };

        const response = await axios.post(`${ML_SERVICE_URL}/data-pipeline/update`, payload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('ML service update failed:', error.message);
        // Don't throw error - we don't want to break the main product operations
        return {
            success: false,
            message: `ML service error: ${error.message}`,
            processing_time_ms: 0
        };
    }
};

/**
 * Middleware to update ML data after product operations
 */
const updateMLData = (action) => {
    return async (req, res, next) => {
        // Store original response methods
        const originalSend = res.send;
        const originalJson = res.json;

        // Override response methods to intercept successful responses
        res.send = function(data) {
            handleMLUpdate.call(this, data, action, req);
            return originalSend.call(this, data);
        };

        res.json = function(data) {
            handleMLUpdate.call(this, data, action, req);
            return originalJson.call(this, data);
        };

        next();
    };
};

/**
 * Handle ML update after successful operations
 */
const handleMLUpdate = async function(responseData, action, req) {
    // Only update ML service for successful operations
    if (this.statusCode >= 200 && this.statusCode < 300) {
        try {
            if (action === 'create' || action === 'update') {
                // For create/update, we need the product data
                let productId;
                
                if (action === 'create' && responseData._id) {
                    productId = responseData._id;
                } else if (action === 'update' && req.params.id) {
                    productId = req.params.id;
                }

                if (productId) {
                    // Fetch the complete product data with shop information
                    const product = await BikePart.findById(productId).populate('shop');
                    if (product) {
                        const mlProductData = await transformProductForML(product);
                        await sendToMLService(action, mlProductData);
                    }
                }
            } else if (action === 'delete' && req.params.id) {
                // For delete, we only need the product ID
                await sendToMLService('delete', null, req.params.id);
            }
        } catch (error) {
            console.error('ML data update error:', error);
            // Log but don't affect the main response
        }
    }
};

// ============================================================================
// MANUAL TRIGGER ENDPOINTS
// ============================================================================

/**
 * Manual trigger to sync all products to CSV
 * Admin only endpoint
 */
router.post('/sync-all', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        console.log('Starting manual sync of all products to ML service...');
        
        // Fetch all products with shop information
        const products = await BikePart.find().populate('shop');
        
        if (!products.length) {
            return res.json({
                success: true,
                message: 'No products found to sync',
                products_synced: 0
            });
        }

        // Transform products for ML service
        const mlProductsData = [];
        for (const product of products) {
            try {
                const mlData = await transformProductForML(product);
                mlProductsData.push(mlData);
            } catch (error) {
                console.error(`Error transforming product ${product._id}:`, error);
            }
        }

        // Send to ML service
        const response = await axios.post(`${ML_SERVICE_URL}/data-pipeline/bulk-sync`, mlProductsData, {
            timeout: 30000, // 30 seconds for bulk operation
            headers: {
                'Content-Type': 'application/json'
            }
        });

        res.json({
            success: true,
            message: `Successfully synced ${mlProductsData.length} products`,
            products_synced: mlProductsData.length,
            ml_response: response.data
        });

    } catch (error) {
        console.error('Manual sync error:', error);
        res.status(500).json({
            success: false,
            message: 'Sync failed',
            error: error.message
        });
    }
});

/**
 * Manual trigger for model training
 * Admin only endpoint
 */
router.post('/train-model', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        console.log('Triggering model training...');
        
        const { force_retrain = false, include_validation = true } = req.body;

        const response = await axios.post(`${ML_SERVICE_URL}/model/train`, {
            force_retrain,
            include_validation
        }, {
            timeout: 120000, // 2 minutes for training
            headers: {
                'Content-Type': 'application/json'
            }
        });

        res.json({
            success: true,
            message: 'Model training initiated',
            training_response: response.data
        });

    } catch (error) {
        console.error('Model training trigger error:', error);
        res.status(500).json({
            success: false,
            message: 'Model training failed to start',
            error: error.message
        });
    }
});

/**
 * Get ML service status
 */
router.get('/ml-status', auth, async (req, res) => {
    try {
        const [pipelineResponse, modelResponse] = await Promise.allSettled([
            axios.get(`${ML_SERVICE_URL}/data-pipeline/status`, { timeout: 5000 }),
            axios.get(`${ML_SERVICE_URL}/model/status`, { timeout: 5000 })
        ]);

        const pipelineStatus = pipelineResponse.status === 'fulfilled' 
            ? pipelineResponse.value.data 
            : { error: pipelineResponse.reason?.message || 'Pipeline status unavailable' };

        const modelStatus = modelResponse.status === 'fulfilled' 
            ? modelResponse.value.data 
            : { error: modelResponse.reason?.message || 'Model status unavailable' };

        res.json({
            ml_service_connected: true,
            pipeline_status: pipelineStatus,
            model_status: modelStatus,
            last_checked: new Date().toISOString()
        });

    } catch (error) {
        console.error('ML status check error:', error);
        res.status(500).json({
            ml_service_connected: false,
            error: error.message,
            last_checked: new Date().toISOString()
        });
    }
});

/**
 * Health check for ML service connectivity
 */
router.get('/ml-health', async (req, res) => {
    try {
        const response = await axios.get(`${ML_SERVICE_URL}/health/detailed`, { 
            timeout: 3000 
        });
        
        res.json({
            ml_service: 'connected',
            health_data: response.data
        });
    } catch (error) {
        res.status(503).json({
            ml_service: 'disconnected',
            error: error.message
        });
    }
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    router,
    updateMLData,  // Export middleware for use in product routes
    sendToMLService,  // Export for manual use
    transformProductForML  // Export for testing
};