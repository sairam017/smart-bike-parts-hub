/**
 * Utility functions for calculating distances between geographic coordinates
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point (in degrees)
 * @param {number} lng1 - Longitude of first point (in degrees) 
 * @param {number} lat2 - Latitude of second point (in degrees)
 * @param {number} lng2 - Longitude of second point (in degrees)
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  // Input validation
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    console.warn('Invalid coordinates provided to calculateDistance:', { lat1, lng1, lat2, lng2 });
    return null;
  }

  const toRad = (degrees) => degrees * Math.PI / 180;
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) ** 2 + 
           Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
           Math.sin(dLng / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

/**
 * Calculate distance from user location to shop coordinates
 * @param {Object} userLocation - User location object with latitude and longitude
 * @param {Array} shopCoordinates - Shop coordinates in GeoJSON format [lng, lat]
 * @returns {number|null} Distance in kilometers or null if invalid
 */
export const calculateDistanceToShop = (userLocation, shopCoordinates) => {
  if (!userLocation || !shopCoordinates) {
    return null;
  }

  const { latitude: userLat, longitude: userLng } = userLocation;
  const [shopLng, shopLat] = shopCoordinates; // GeoJSON format: [longitude, latitude]

  // Validate all coordinates
  if (!isValidCoordinate(userLat, userLng) || !isValidCoordinate(shopLat, shopLng)) {
    console.warn('Invalid coordinates in calculateDistanceToShop:', {
      user: { lat: userLat, lng: userLng },
      shop: { lat: shopLat, lng: shopLng }
    });
    return null;
  }

  return calculateDistance(userLat, userLng, shopLat, shopLng);
};

/**
 * Validate if coordinates are within valid ranges
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude  
 * @returns {boolean} True if coordinates are valid
 */
export const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !isNaN(lat) && !isNaN(lng)
  );
};

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distanceKm, decimals = 1) => {
  if (distanceKm == null) return 'N/A';
  
  if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)}m`;
  }
  
  return `${distanceKm.toFixed(decimals)}km`;
};

/**
 * Debug logging for distance calculations
 * @param {string} component - Component name
 * @param {Object} userLoc - User location
 * @param {Array} shopCoords - Shop coordinates
 * @param {number} result - Calculated distance
 */
export const debugDistance = (component, userLoc, shopCoords, result) => {
  if (process.env.NODE_ENV === 'development') {
    // Also calculate with swapped coordinates to detect potential issues
    const [shopLng, shopLat] = shopCoords || [0, 0];
    const swappedDistance = calculateDistance(userLoc?.latitude, userLoc?.longitude, shopLng, shopLat);
    
    console.log(`[${component}] Distance calculation:`, {
      userLocation: {
        lat: userLoc?.latitude?.toFixed(6),
        lng: userLoc?.longitude?.toFixed(6),
        accuracy: userLoc?.accuracy,
        manual: userLoc?.manual
      },
      shopCoordinates: {
        lng: shopCoords?.[0]?.toFixed(6),
        lat: shopCoords?.[1]?.toFixed(6)
      },
      distance: result?.toFixed(3),
      swappedDistance: swappedDistance?.toFixed(3),
      possibleSwapIssue: Math.abs((result || 0) - (swappedDistance || 0)) > 1,
      isValid: result != null,
      coordinateOrder: 'GeoJSON: [lng, lat]'
    });
  }
};