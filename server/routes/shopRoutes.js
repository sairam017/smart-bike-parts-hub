const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const BikePart = require('../models/BikePart');
const auth = require('../middleware/authMiddleware');

// Public list with optional geo filter (for customers)
router.get('/', async (req, res) => {
  const { lat, lng, radius } = req.query;
  let query = {};
  if (lat && lng && radius) {
    query = {
      location: { $geoWithin: { $centerSphere: [[ parseFloat(lng), parseFloat(lat) ], parseFloat(radius)/6378.1 ] } }
    };
  }
  const shops = await Shop.find(query).populate('vendor','name email');
  res.json({ shops });
});

// Get nearby shops for map page
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    // Build query for geographical search
    const query = {
      location: {
        $geoWithin: {
          $centerSphere: [[userLng, userLat], radiusKm / 6378.1] // Convert km to radians
        }
      }
    };

    let shops = await Shop.find(query).populate('vendor', 'name email');

    // Calculate distances and add to response
    shops = shops.map(shop => {
      const shopData = shop.toObject();
      if (shop.location && shop.location.coordinates) {
        const [shopLng, shopLat] = shop.location.coordinates;
        const distance = calculateDistance(userLat, userLng, shopLat, shopLng);
        shopData.distance = distance;
      }
      return shopData;
    });

    // Sort by distance
    shops.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    res.json({ shops, totalShops: shops.length });
  } catch (error) {
    console.error('Error fetching nearby shops:', error);
    res.status(500).json({ message: 'Failed to fetch nearby shops', error: error.message });
  }
});

// Get shops that have specific products in stock
router.get('/with-products', async (req, res) => {
  try {
    const { productIds, lat, lng, radius = 50 } = req.query;
    
    if (!productIds) {
      return res.status(400).json({ message: 'Product IDs are required' });
    }

    const productIdArray = productIds.split(',').filter(id => id.trim());
    
    if (productIdArray.length === 0) {
      return res.status(400).json({ message: 'Valid product IDs are required' });
    }

    // Find products with their shop information
    const products = await BikePart.find({
      _id: { $in: productIdArray }
    }).populate('shop', 'name address phone location vendor');

    // Group products by shop and calculate shop availability
    const shopMap = new Map();
    
    products.forEach(product => {
      if (product.shop) {
        const shopId = product.shop._id.toString();
        
        if (!shopMap.has(shopId)) {
          shopMap.set(shopId, {
            _id: product.shop._id,
            name: product.shop.name,
            address: product.shop.address,
            phone: product.shop.phone,
            location: product.shop.location,
            vendor: product.shop.vendor,
            products: []
          });
        }
        
        shopMap.get(shopId).products.push({
          _id: product._id,
          name: product.name,
          model: product.model,
          price: product.price,
          countInStock: product.countInStock,
          stock: product.countInStock
        });
      }
    });

    let shops = Array.from(shopMap.values());

    // Apply geographical filtering if coordinates provided
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      shops = shops.filter(shop => {
        if (!shop.location || !shop.location.coordinates) return false;
        
        const [shopLng, shopLat] = shop.location.coordinates;
        const distance = calculateDistance(userLat, userLng, shopLat, shopLng);
        shop.distance = distance;
        
        return distance <= radiusKm;
      });

      // Sort by distance
      shops.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    res.json({ shops, totalShops: shops.length });
  } catch (error) {
    console.error('Error fetching shops with products:', error);
    res.status(500).json({ message: 'Failed to fetch shops', error: error.message });
  }
});

// Get nearest shops to a location
router.get('/nearest', async (req, res) => {
  try {
    const { lat, lng, radius = 10, productIds, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);
    const limitNum = parseInt(limit);

    // Build query for geographical search
    let query = {
      location: {
        $geoWithin: {
          $centerSphere: [[userLng, userLat], radiusKm / 6378.1] // Convert km to radians
        }
      }
    };

    let shops = await Shop.find(query).populate('vendor', 'name email').limit(limitNum * 2); // Get extra to filter

    // If productIds specified, filter shops that have those products
    if (productIds) {
      const productIdArray = productIds.split(',').filter(id => id.trim());
      
      if (productIdArray.length > 0) {
        const products = await BikePart.find({
          _id: { $in: productIdArray },
          shop: { $in: shops.map(s => s._id) }
        }).populate('shop');

        const shopsWithProducts = new Set(products.map(p => p.shop._id.toString()));
        shops = shops.filter(shop => shopsWithProducts.has(shop._id.toString()));

        // Add product information to shops
        shops = shops.map(shop => {
          const shopProducts = products.filter(p => p.shop._id.toString() === shop._id.toString());
          return {
            ...shop.toObject(),
            availableProducts: shopProducts.map(p => ({
              _id: p._id,
              name: p.name,
              model: p.model,
              price: p.price,
              stock: p.countInStock
            }))
          };
        });
      }
    }

    // Calculate distances and sort
    shops = shops.map(shop => {
      if (shop.location && shop.location.coordinates) {
        const [shopLng, shopLat] = shop.location.coordinates;
        const distance = calculateDistance(userLat, userLng, shopLat, shopLng);
        return { ...shop.toObject(), distance };
      }
      return shop.toObject();
    });

    shops.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    shops = shops.slice(0, limitNum);

    res.json({ shops, totalShops: shops.length });
  } catch (error) {
    console.error('Error fetching nearest shops:', error);
    res.status(500).json({ message: 'Failed to fetch nearest shops', error: error.message });
  }
});

// Vendor: get my shop (single) - MUST come before /:id route
router.get('/me', auth, async (req, res) => {
  if(!['vendor','admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  const filter = req.user.role === 'vendor' ? { vendor: req.user.id } : {};
  const shop = await Shop.findOne(filter).populate('vendor','name email');
  if(!shop) return res.status(404).json({ message: 'Shop not found' });
  res.json(shop);
});

// Vendor/Admin: update my shop address and coordinates
router.put('/me', auth, async (req, res) => {
  try {
    if(!['vendor','admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    const filter = req.user.role === 'vendor' ? { vendor: req.user.id } : { _id: req.body.id };
    const shop = await Shop.findOne(filter);
    if(!shop) return res.status(404).json({ message: 'Shop not found' });
    const { name, address, phone, website, latitude, longitude } = req.body;
    if(name !== undefined) shop.name = name;
    if(address !== undefined) shop.address = address;
    if(phone !== undefined) shop.phone = phone;
    if(website !== undefined) shop.website = website;
    if(latitude != null && longitude != null) {
      const latNum = parseFloat(latitude); const lngNum = parseFloat(longitude);
      if (isNaN(latNum) || isNaN(lngNum)) return res.status(400).json({ message: 'Invalid coordinates' });
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return res.status(400).json({ message: 'Coordinates out of range' });
      shop.location = { type: 'Point', coordinates: [ lngNum, latNum ] };
    }
    await shop.save();
    res.json(shop);
  } catch (e) {
    console.error('Update shop error', e);
    res.status(500).json({ message: 'Failed to update shop', error: e.message });
  }
});

// Get specific shop details with inventory
router.get('/:id', async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id).populate('vendor', 'name email');
    
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Get products available at this shop
    const products = await BikePart.find({ shop: shop._id }).select('name model price countInStock images');
    
    res.json({
      ...shop.toObject(),
      products
    });
  } catch (error) {
    console.error('Error fetching shop details:', error);
    res.status(500).json({ message: 'Failed to fetch shop details', error: error.message });
  }
});

// Check product availability at specific shop
router.post('/:id/check-availability', async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ message: 'Product IDs array is required' });
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const products = await BikePart.find({
      _id: { $in: productIds },
      shop: shop._id
    }).select('name model price countInStock');

    const availability = productIds.map(productId => {
      const product = products.find(p => p._id.toString() === productId);
      return {
        productId,
        available: !!product,
        stock: product?.countInStock || 0,
        product: product || null
      };
    });

    res.json({
      shop: {
        _id: shop._id,
        name: shop.name,
        address: shop.address
      },
      availability,
      totalAvailable: availability.filter(a => a.available).length,
      totalRequested: productIds.length
    });
  } catch (error) {
    console.error('Error checking product availability:', error);
    res.status(500).json({ message: 'Failed to check availability', error: error.message });
  }
});

// Reserve products at shop (for purchase flow)
router.post('/:id/reserve', async (req, res) => {
  try {
    const { products, customerInfo, reservationDuration = 30 } = req.body;
    
    if (!products || !Array.isArray(products) || !customerInfo) {
      return res.status(400).json({ message: 'Products array and customer info are required' });
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check availability and reserve
    const reservationId = new Date().getTime().toString();
    const expiresAt = new Date(Date.now() + reservationDuration * 60000);
    
    const reservationDetails = {
      reservationId,
      shop: {
        _id: shop._id,
        name: shop.name,
        address: shop.address,
        phone: shop.phone
      },
      products,
      customerInfo,
      expiresAt,
      status: 'reserved'
    };

    // In a real implementation, you'd store this in a reservations collection
    // For now, we'll just return the reservation details
    
    res.json({
      success: true,
      reservation: reservationDetails,
      message: `Products reserved for ${reservationDuration} minutes`
    });
  } catch (error) {
    console.error('Error reserving products:', error);
    res.status(500).json({ message: 'Failed to reserve products', error: error.message });
  }
});

// Utility function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}



// Vendor/Admin create
router.post('/', auth, async (req, res) => {
  try {
    if(!['vendor','admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    const { name, address, phone, website, latitude, longitude } = req.body;
    if(latitude == null || longitude == null) return res.status(400).json({ message: 'Missing coordinates' });
    const latNum = parseFloat(latitude); const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) return res.status(400).json({ message: 'Invalid coordinates' });
    const shop = await Shop.create({
      name, address, phone, website, vendor: req.user.id,
      location: { type: 'Point', coordinates: [ lngNum, latNum ] }
    });
    res.status(201).json(shop);
  } catch (e) {
    console.error('Create shop error', e);
    res.status(500).json({ message: 'Failed to create shop', error: e.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if(!shop) return res.status(404).json({ message: 'Not found' });
  if(shop.vendor.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { name, address, phone, website, latitude, longitude } = req.body;
  if(name !== undefined) shop.name = name;
  if(address !== undefined) shop.address = address;
  if(phone !== undefined) shop.phone = phone;
  if(website !== undefined) shop.website = website;
  if(latitude != null && longitude != null) shop.location = { type: 'Point', coordinates: [ parseFloat(longitude), parseFloat(latitude) ] };
  await shop.save();
  res.json(shop);
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if(!shop) return res.status(404).json({ message: 'Not found' });
  if(shop.vendor.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await shop.deleteOne();
  res.json({ message: 'Deleted' });
});

module.exports = router;
