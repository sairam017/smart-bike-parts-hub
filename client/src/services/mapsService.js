import api from './api';

// Calculate distance using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const mapsService = {
  // Get shops that have specific products in stock
  getShopsWithProducts: async (productIds = []) => {
    try {
      const response = await api.get(`/shops/with-products?productIds=${productIds.join(',')}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching shops with products:', error);
      // Return mock data for demo
      return {
        shops: [
          {
            _id: '1',
            name: 'Central Bike Parts',
            address: 'MG Road, Bangalore',
            location: { coordinates: [77.5946, 12.9716] },
            phone: '+91 98765 43210',
            products: productIds.map(id => ({ _id: id, name: 'Sample Product', stock: 5 }))
          },
          {
            _id: '2',
            name: 'Bike Zone Spares',
            address: 'Koramangala, Bangalore', 
            location: { coordinates: [77.6271, 12.9279] },
            phone: '+91 98765 43211',
            products: productIds.map(id => ({ _id: id, name: 'Sample Product', stock: 3 }))
          }
        ]
      };
    }
  },

  // Get all shops with location data
  getShopsWithLocation: async () => {
    try {
      const response = await api.get('/shops');
      return response.data.shops.filter(shop => 
        shop.location && 
        shop.location.coordinates && 
        shop.location.coordinates.length >= 2
      );
    } catch (error) {
      console.error('Error fetching shops:', error);
      throw error;
    }
  },

  // Get shops for specific products
  getShopsForProducts: async (productIds) => {
    try {
      const response = await api.get('/shops/with-products', {
        params: {
          productIds: productIds.join(',')
        }
      });
      return response.data.shops || [];
    } catch (error) {
      console.error('Error fetching shops for products:', error);
      // Return mock data with proper coordinates for demo
      return [
        {
          _id: '1',
          name: 'Central Bike Parts',
          address: 'MG Road, Bangalore',
          location: { coordinates: [77.5946, 12.9716] }, // [lng, lat] format
          phone: '+91 98765 43210',
          products: productIds.map(id => ({ _id: id, name: 'Sample Product', stock: 5 }))
        },
        {
          _id: '2',
          name: 'Bike Zone Spares',
          address: 'Koramangala, Bangalore', 
          location: { coordinates: [77.6271, 12.9279] }, // [lng, lat] format
          phone: '+91 98765 43211',
          products: productIds.map(id => ({ _id: id, name: 'Sample Product', stock: 3 }))
        }
      ];
    }
  },

  // Find nearest shops to a location
  findNearestShops: (shops, userLat, userLng, limit = 5) => {
    return shops.map(shop => {
      const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
      const distance = calculateDistance(userLat, userLng, coords[1], coords[0]);
      return { ...shop, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
  },

  // Calculate optimal route through multiple shops
  calculateOptimalRoute: (userLocation, shops, productIds = []) => {
    if (!userLocation || !shops.length) return null;

    // Filter shops that have the required products
    let relevantShops = shops;
    if (productIds.length > 0) {
      relevantShops = shops.filter(shop => 
        shop.products && shop.products.some(product => 
          productIds.includes(product._id)
        )
      );
    }

    // Calculate distances from user location
    const shopsWithDistance = relevantShops.map(shop => {
      const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
      const distance = calculateDistance(
        userLocation.lat, 
        userLocation.lng, 
        coords[1], 
        coords[0]
      );
      return { ...shop, distanceFromUser: distance };
    });

    // Sort by distance (greedy approach for now)
    shopsWithDistance.sort((a, b) => a.distanceFromUser - b.distanceFromUser);

    // Calculate cumulative route
    let currentLat = userLocation.lat;
    let currentLng = userLocation.lng;
    let totalDistance = 0;

    const routeShops = shopsWithDistance.map((shop, index) => {
      const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
      const distanceFromPrevious = calculateDistance(currentLat, currentLng, coords[1], coords[0]);
      
      totalDistance += distanceFromPrevious;
      currentLat = coords[1];
      currentLng = coords[0];

      return {
        ...shop,
        order: index + 1,
        distanceFromPrevious,
        cumulativeDistance: totalDistance
      };
    });

    return {
      shops: routeShops,
      totalDistance,
      totalShops: routeShops.length,
      estimatedTime: Math.round(totalDistance * 2) // Rough estimate: 2 minutes per km
    };
  },

  // Get route planning data for cart items
  getPlanRouteForCart: async (cartItems, userLocation) => {
    try {
      // Extract unique product IDs from cart
      const productIds = [...new Set(cartItems.map(item => item.product || item._id).filter(Boolean))];
      
      // Get shops that have these products
      const shops = await mapsService.getShopsForProducts(productIds);
      
      // Calculate optimal route
      const route = mapsService.calculateOptimalRoute(userLocation, shops, productIds);
      
      return {
        route,
        shops,
        productIds,
        cartItems
      };
    } catch (error) {
      console.error('Error planning route for cart:', error);
      throw error;
    }
  },

  // Format location for display
  formatLocation: (lat, lng) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  },

  // Format distance for display
  formatDistance: (distanceKm) => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(2)}km`;
  },

  // Validate coordinates
  isValidCoordinates: (lat, lng) => {
    return typeof lat === 'number' && 
           typeof lng === 'number' && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
  },

  // Get map center based on shops or user location
  getMapCenter: (shops = [], userLocation = null) => {
    if (userLocation && mapsService.isValidCoordinates(userLocation.lat, userLocation.lng)) {
      return [userLocation.lat, userLocation.lng];
    }

    if (shops.length > 0) {
      // Calculate center of all shops
      const validShops = shops.filter(shop => {
        const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
        return coords && coords.length >= 2;
      });

      if (validShops.length > 0) {
        const totalLat = validShops.reduce((sum, shop) => {
          const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
          return sum + coords[1];
        }, 0);
        
        const totalLng = validShops.reduce((sum, shop) => {
          const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
          return sum + coords[0];
        }, 0);

        return [totalLat / validShops.length, totalLng / validShops.length];
      }
    }

    // Default to Hyderabad
    return [17.3850, 78.4867];
  },

  // Convert shop data for map display
  formatShopsForMap: (shops, userLocation = null) => {
    return shops.map(shop => {
      // Handle both formats: MongoDB coordinates [lng, lat] and direct lat/lng properties
      const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
      let distance = null;
      
      // Ensure we have valid coordinates
      if (!coords || coords.length < 2 || !coords[1] || !coords[0]) {
        console.warn('Invalid coordinates for shop:', shop.name);
        return null;
      }
      
      if (userLocation && coords && coords.length >= 2) {
        distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          coords[1], // lat
          coords[0]  // lng
        );
      }

      return {
        _id: shop._id,
        id: shop._id,
        name: shop.name,
        address: shop.address,
        phone: shop.phone,
        lat: coords[1], // lat is the second element in MongoDB coordinates
        lng: coords[0], // lng is the first element in MongoDB coordinates
        location: shop.location,
        distance,
        products: shop.products || [],
        productCount: (shop.products || []).length,
        vendor: shop.vendor
      };
    }).filter(shop => shop !== null); // Remove shops with invalid coordinates
  }
};

export default mapsService;