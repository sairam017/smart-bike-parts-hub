import React, { useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomerMap from './CustomerMap';
import useLocationContext from '../../hooks/useLocation';

const MapPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getUserLocation, setUserLocationFromInput } = useLocationContext();
  
  // Get data passed from the previous page
  const { selectedProducts = [], recommendedProducts = [] } = location.state || {};
  
  console.log('MapPage rendered:', { selectedProducts, recommendedProducts });
  
  const [userLocation, setUserLocation] = useState(null);
  const [manualLocation, setManualLocation] = useState({ lat: '', lng: '' });
  const [locationError, setLocationError] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationMethod, setLocationMethod] = useState('map'); // 'gps', 'manual', or 'map'
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapClickEnabled, setMapClickEnabled] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [selectedShopForRoute, setSelectedShopForRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [showMap, setShowMap] = useState(false);

  // Check if we have the necessary data - moved here to be accessible in callbacks
  const hasProducts = selectedProducts.length > 0 || recommendedProducts.length > 0;
  const allProducts = useMemo(() => [...selectedProducts, ...recommendedProducts], [selectedProducts, recommendedProducts]);

  // Fetch shops near the user's location that have selected products
  const fetchNearbyShops = useCallback(async (lat, lng) => {
    setLoading(true);
    try {
      console.log(`Fetching shops near ${lat}, ${lng}...`);
      
      // If we have selected products, fetch shops that have those products
      if (allProducts.length > 0) {
        const productIds = allProducts.map(p => p._id).join(',');
        const response = await fetch(`/api/shops/with-products?productIds=${productIds}&lat=${lat}&lng=${lng}&radius=50`);
        console.log('Shops with products API response status:', response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch shops with products: ${response.status}`);
        }
        const data = await response.json();
        console.log('Shops with products data:', data);
        setShops(data.shops || []);
      } else {
        // Fallback to all nearby shops if no products selected
        const response = await fetch(`/api/shops/nearby?lat=${lat}&lng=${lng}&radius=50`);
        console.log('Nearby shops API response status:', response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch nearby shops: ${response.status}`);
        }
        const data = await response.json();
        console.log('Nearby shops data:', data);
        setShops(data.shops || []);
      }
    } catch (error) {
      console.error('Error fetching nearby shops:', error);
      setLocationError(`Failed to fetch nearby shops: ${error.message}. The map will still show your location.`);
      // Don't clear the user location on shop fetch error
    } finally {
      setLoading(false);
    }
  }, [allProducts]); // Depend on allProducts which is now memoized

  // Get user's current location using GPS
  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    setLocationError(null);
    
    try {
      console.log('Getting user location...');
      const position = await getUserLocation();
      console.log('Location received:', position);
      const newLocation = {
        lat: position.latitude,
        lng: position.longitude
      };
      setUserLocation(newLocation);
      setLocationError(null);
      console.log('User location set:', newLocation);
      await fetchNearbyShops(position.latitude, position.longitude);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError(`Unable to get your location: ${error.message}. Please enter it manually or check your browser permissions.`);
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Handle map click to set location or show route
  const handleMapLocationSelect = useCallback(async (location) => {
    if (location.type === 'showRoute') {
      console.log('Showing route to shop:', location.shop.name);
      setSelectedShopForRoute(location.shop);
      return;
    }
    
    console.log('Map location selected:', location);
    setUserLocation(location);
    setLocationError(null);
    setShowInstructions(false);
    await setUserLocationFromInput(location.lat, location.lng);
    await fetchNearbyShops(location.lat, location.lng);
  }, [setUserLocationFromInput, fetchNearbyShops]); // Remove userLocation to prevent recreating callback

  // Handle route calculation completion
  const handleRouteCalculated = useCallback((routeData) => {
    console.log('Route calculated:', routeData);
    setRouteInfo(routeData);
  }, []); // No dependencies needed for simple state setter

  // Handle "Get Directions" button click from shops list
  const handleGetDirections = (shop) => {
    console.log('Get Directions clicked for shop:', shop.name);
    setSelectedShopForRoute(shop);
  };

  // Set location manually
  const handleManualLocationSubmit = async () => {
    const lat = parseFloat(manualLocation.lat);
    const lng = parseFloat(manualLocation.lng);
    
    if (isNaN(lat) || isNaN(lng)) {
      setLocationError('Please enter valid latitude and longitude values.');
      return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setLocationError('Latitude must be between -90 and 90, longitude between -180 and 180.');
      return;
    }
    
    setUserLocation({ lat, lng });
    setLocationError(null);
    await setUserLocationFromInput(lat, lng);
    await fetchNearbyShops(lat, lng);
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Get shops with distance calculations and proper coordinate format
  const shopsWithDistance = useMemo(() => {
    if (!userLocation || !shops.length) return [];
    
    return shops.map(shop => {
      const shopLat = shop.location?.coordinates?.[1] || shop.lat;
      const shopLng = shop.location?.coordinates?.[0] || shop.lng;
      
      if (!shopLat || !shopLng) {
        console.warn('Shop missing coordinates:', shop.name);
        return null;
      }
      
      return {
        ...shop,
        lat: shopLat,
        lng: shopLng,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          shopLat,
          shopLng
        )
      };
    })
    .filter(shop => shop !== null)
    .sort((a, b) => a.distance - b.distance);
  }, [userLocation, shops]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          background: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              Find Nearby Shops
            </h1>
            <button 
              onClick={() => navigate(-1)}
              style={{
                background: '#6b7280',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              ← Back
            </button>
          </div>
          
          {hasProducts ? (
            <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #0ea5e9' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0c4a6e', fontSize: '1.1rem' }}>
                🛒 Your Selected Items ({allProducts.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {allProducts.map((product, index) => (
                  <span key={index} style={{
                    background: '#0ea5e9',
                    color: '#fff',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}>
                    {product.name || product.title}
                  </span>
                ))}
              </div>
              <p style={{ color: '#0c4a6e', margin: 0, fontSize: '0.95rem' }}>
                We'll find shops near you that have these items in stock, sorted by shortest distance.
              </p>
            </div>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>
              Find nearby bike part shops in your area
            </p>
          )}
          
          {/* Get Started Button */}
          {!showMap && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowMap(true)}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '25px',
                  padding: '1rem 2rem',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s ease',
                  transform: 'translateY(0)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                }}
              >
                🚀 Get Started - Find Shops Near Me
              </button>
            </div>
          )}
        </div>

        {/* Show location setup and map only after "Get Started" is clicked */}
        {showMap && (
          <>
            {/* Location Setup */}
            <div style={{ 
              background: '#fff', 
              padding: '1.5rem', 
              borderRadius: '8px', 
              marginBottom: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem' }}>
            Your Location
          </h2>

          {/* Location Method Selection */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                value="map"
                checked={locationMethod === 'map'}
                onChange={(e) => {
                  setLocationMethod(e.target.value);
                  setMapClickEnabled(true);
                  setShowInstructions(true);
                }}
              />
              🗺️ Tap on Map
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                value="gps"
                checked={locationMethod === 'gps'}
                onChange={(e) => {
                  setLocationMethod(e.target.value);
                  setMapClickEnabled(false);
                }}
              />
              📍 Use GPS Location
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                value="manual"
                checked={locationMethod === 'manual'}
                onChange={(e) => {
                  setLocationMethod(e.target.value);
                  setMapClickEnabled(false);
                }}
              />
              ⌨️ Enter Manually
            </label>
          </div>

          {/* Map Click Instructions */}
          {locationMethod === 'map' && showInstructions && (
            <div style={{
              background: '#e3f2fd',
              border: '2px solid #2196f3',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>Tap on the Map!</h3>
              <p style={{ margin: '0 0 0.5rem 0', color: '#424242' }}>
                Simply tap anywhere on the map below to set your location and find nearby bike shops.
              </p>
              <button
                onClick={() => setShowInstructions(false)}
                style={{
                  background: '#2196f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Got it! 👍
              </button>
            </div>
          )}

          {/* GPS Location */}
          {locationMethod === 'gps' && (
            <div>
              <button
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation}
                style={{
                  background: isGettingLocation ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 1.5rem',
                  cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                {isGettingLocation ? 'Getting Location...' : 'Get My Current Location'}
              </button>
            </div>
          )}

          {/* Manual Location */}
          {locationMethod === 'manual' && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Latitude:
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g., 12.9716"
                  value={manualLocation.lat}
                  onChange={(e) => setManualLocation(prev => ({ ...prev, lat: e.target.value }))}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    width: '150px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Longitude:
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g., 77.5946"
                  value={manualLocation.lng}
                  onChange={(e) => setManualLocation(prev => ({ ...prev, lng: e.target.value }))}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    width: '150px'
                  }}
                />
              </div>
              <button
                onClick={handleManualLocationSubmit}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                Set Location
              </button>
            </div>
          )}

          {/* Current Location Display */}
          {userLocation && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#ecfdf5', 
              borderRadius: '6px',
              border: '1px solid #10b981'
            }}>
              <div style={{ color: '#059669', fontWeight: '600' }}>
                ✓ Location Set: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </div>
            </div>
          )}

          {/* Error Display */}
          {locationError && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#fef2f2', 
              borderRadius: '6px',
              border: '1px solid #f87171',
              color: '#dc2626'
            }}>
              {locationError}
            </div>
          )}
        </div>

        {/* Shops List */}
        {userLocation && (
          <div style={{ 
            background: '#fff', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem' }}>
              Nearby Shops ({shopsWithDistance.length} found)
            </h2>

            {loading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                Loading nearby shops...
              </div>
            )}

            {!loading && shopsWithDistance.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                No shops found in your area. Try expanding your search radius.
              </div>
            )}

            {!loading && shopsWithDistance.length > 0 && (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {shopsWithDistance.slice(0, 10).map((shop) => {
                  // Count available selected products
                  const availableProducts = shop.products || shop.availableProducts || [];
                  const selectedProductsInStock = availableProducts.filter(product =>
                    allProducts.some(selected => selected._id === product._id)
                  );
                  
                  return (
                    <div key={shop._id} style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      background: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                            {shop.name}
                          </h3>
                          <p style={{ color: '#6b7280', margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                            📍 {shop.address}
                          </p>
                          <p style={{ color: '#6b7280', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                            📞 {shop.contactInfo?.phone || shop.phone || 'N/A'}
                          </p>
                          
                          {/* Available Products */}
                          {hasProducts && selectedProductsInStock.length > 0 && (
                            <div style={{ marginTop: '0.75rem' }}>
                              <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#059669', margin: '0 0 0.5rem 0' }}>
                                ✅ Has {selectedProductsInStock.length} of your selected items:
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {selectedProductsInStock.slice(0, 3).map((product, idx) => (
                                  <span key={idx} style={{
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '12px',
                                    fontSize: '0.8rem',
                                    border: '1px solid #bbf7d0'
                                  }}>
                                    {product.name}
                                  </span>
                                ))}
                                {selectedProductsInStock.length > 3 && (
                                  <span style={{
                                    background: '#f3f4f6',
                                    color: '#6b7280',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '12px',
                                    fontSize: '0.8rem'
                                  }}>
                                    +{selectedProductsInStock.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                          <div style={{
                            background: shop.distance <= 5 ? '#10b981' : shop.distance <= 15 ? '#f59e0b' : '#ef4444',
                            color: '#fff',
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            marginBottom: '0.75rem',
                            minWidth: '80px'
                          }}>
                            {shop.distance.toFixed(1)} km
                          </div>
                          <button
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '0.75rem 1.25rem',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => handleGetDirections(shop)}
                            onMouseEnter={(e) => {
                              e.target.style.background = '#1d4ed8';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = '#2563eb';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            🗺️ Show Route
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Map Display - Always visible for customer interaction */}
        <div style={{ 
          background: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem' }}>
            Interactive Map
          </h2>
          <div style={{ height: '500px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            <CustomerMap 
              shops={shopsWithDistance} 
              userLocation={userLocation}
              onLocationSelect={handleMapLocationSelect}
              mapClickEnabled={mapClickEnabled}
              selectedShopForRoute={selectedShopForRoute}
              onRouteCalculated={handleRouteCalculated}
            />
          </div>

          {/* Route Information Panel */}
          {routeInfo && (
            <div style={{
              background: 'linear-gradient(135deg, #4CAF50, #45a049)',
              color: 'white',
              padding: '1.5rem',
              borderRadius: '12px',
              marginTop: '1rem',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                    🗺️ Route to {routeInfo.shop.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>🚗</span>
                      <span style={{ fontWeight: '600' }}>{routeInfo.distance} km</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>⏱️</span>
                      <span style={{ fontWeight: '600' }}>{routeInfo.time} mins</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedShopForRoute(null);
                    setRouteInfo(null);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                  }}
                  title="Clear Route"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

            <div style={{ padding: '1rem', background: '#f0f0f0', borderRadius: '6px', marginTop: '1rem', fontSize: '0.9rem' }}>
              <strong>Debug Info:</strong><br/>
              User Location: {userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Not set'}<br/>
              Shops Found: {shopsWithDistance.length}<br/>
              Products: {allProducts.length}<br/>
              Loading: {loading ? 'Yes' : 'No'}<br/>
              Selected Shop for Route: {selectedShopForRoute ? selectedShopForRoute.name : 'None'}<br/>
              Route Info: {routeInfo ? `${routeInfo.distance}km, ${routeInfo.time}min` : 'None'}
              
              {/* Test Route Button */}
              {userLocation && shopsWithDistance.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={() => {
                      const firstShop = shopsWithDistance[0];
                      console.log('Testing route to first shop:', firstShop);
                      setSelectedShopForRoute(firstShop);
                    }}
                    style={{
                      background: '#ff9800',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    🧪 Test Route to First Shop
                  </button>
                </div>
              )}
            </div>
            {shopsWithDistance.length === 0 && !loading && (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                color: '#6b7280',
                background: '#f9fafb',
                borderRadius: '6px',
                marginTop: '1rem'
              }}>
                <p>📍 Your location is set, but no shops found in the area.</p>
                <p>Try expanding your search or check back later.</p>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MapPage;