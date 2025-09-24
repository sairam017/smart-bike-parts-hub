import React, { useState, useEffect, useContext } from 'react';
// import InteractiveMap from '../maps/InteractiveMap';
import SimpleMap from '../maps/SimpleMap';
import LocationContext from '../../context/LocationContext';
import mapsService from '../../services/mapsService';

const AdvancedRoutePlanning = ({ cartItems = [], onShopSelect = null, className = '' }) => {
  const [shops, setShops] = useState([]);
  const [selectedShops, setSelectedShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [showMap, setShowMap] = useState(true);
  const { location: userLocation, setManualLocation } = useContext(LocationContext) || {};

  // Extract product IDs from cart items
  const productIds = React.useMemo(() => {
    return [...new Set(cartItems.map(item => item.product || item._id || item.id).filter(Boolean))];
  }, [cartItems]);

  // Fetch shops when component mounts or product IDs change
  useEffect(() => {
    if (productIds.length === 0) return;

    const fetchShops = async () => {
      setLoading(true);
      setError('');
      try {
        const shopsData = await mapsService.getShopsForProducts(productIds);
        const formattedShops = mapsService.formatShopsForMap(shopsData, userLocation);
        setShops(formattedShops);
      } catch (err) {
        setError('Failed to load shops: ' + err.message);
        console.error('Error fetching shops:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, [productIds, userLocation]);

  // Calculate route when shops or user location changes
  useEffect(() => {
    if (!userLocation || selectedShops.length === 0) {
      setRouteData(null);
      return;
    }

    const route = mapsService.calculateOptimalRoute(
      userLocation,
      selectedShops,
      productIds
    );
    setRouteData(route);
  }, [selectedShops, userLocation, productIds]);

  const handleShopSelect = (shop) => {
    const isSelected = selectedShops.some(s => s.id === shop.id);
    
    if (isSelected) {
      setSelectedShops(prev => prev.filter(s => s.id !== shop.id));
    } else {
      setSelectedShops(prev => [...prev, shop]);
    }

    if (onShopSelect) {
      onShopSelect(shop, !isSelected);
    }
  };

  const handleSelectAllNearbyShops = () => {
    if (!userLocation) {
      alert('Please set your location first');
      return;
    }

    const nearbyShops = mapsService.findNearestShops(shops, userLocation.latitude, userLocation.longitude, 5);
    setSelectedShops(nearbyShops);
  };

  const handleClearSelection = () => {
    setSelectedShops([]);
  };

  const handleFindOptimalRoute = () => {
    if (!userLocation) {
      alert('Please set your location first');
      return;
    }

    if (shops.length === 0) {
      alert('No shops available');
      return;
    }

    // Auto-select shops that have the required products
    const relevantShops = shops.filter(shop => 
      shop.products && shop.products.some(product => 
        productIds.includes(product._id)
      )
    );

    if (relevantShops.length === 0) {
      alert('No shops found with the required products');
      return;
    }

    // Select the nearest shops that cover all products
    const nearestShops = mapsService.findNearestShops(
      relevantShops, 
      userLocation.latitude, 
      userLocation.longitude, 
      Math.min(5, relevantShops.length)
    );

    setSelectedShops(nearestShops);
  };

  const currentUserLocation = userLocation ? {
    lat: userLocation.latitude,
    lng: userLocation.longitude
  } : null;

  const mapCenter = mapsService.getMapCenter(shops, currentUserLocation);

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <h3 className="text-lg font-semibold mb-2">🗺️ Interactive Route Planning</h3>
        <p className="text-sm opacity-90">
          Plan your optimal route to collect {cartItems.length} items from nearby shops
        </p>
      </div>

      {/* Controls */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            {showMap ? '📋 Hide Map' : '🗺️ Show Map'}
          </button>
          
          <button
            onClick={handleFindOptimalRoute}
            disabled={!userLocation || loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            🎯 Find Optimal Route
          </button>
          
          <button
            onClick={handleSelectAllNearbyShops}
            disabled={!userLocation || loading}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded disabled:opacity-50 hover:bg-green-700 transition-colors"
          >
            📍 Select Nearby Shops
          </button>
          
          {selectedShops.length > 0 && (
            <button
              onClick={handleClearSelection}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              🗑️ Clear Selection
            </button>
          )}
        </div>

        {/* Status */}
        <div className="text-sm text-gray-600">
          {loading && <span className="text-blue-600">🔄 Loading shops...</span>}
          {error && <span className="text-red-600">❌ {error}</span>}
          {!loading && !error && (
            <span>
              📊 Found {shops.length} shops • {selectedShops.length} selected
              {userLocation && ` • Location: ${mapsService.formatLocation(userLocation.latitude, userLocation.longitude)}`}
            </span>
          )}
        </div>
      </div>

      {/* Map */}
      {showMap && (
        <div className="h-96">
          <SimpleMap 
            center={mapCenter ? [mapCenter.lat, mapCenter.lng] : [12.9716, 77.5946]}
            zoom={12}
          />
        </div>
      )}

      {/* Route Information */}
      {routeData && (
        <div className="p-4 bg-blue-50 border-t">
          <h4 className="font-semibold text-blue-900 mb-3">📋 Route Summary</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{routeData.totalShops}</div>
              <div className="text-xs text-gray-600">Shops</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{routeData.totalDistance.toFixed(2)} km</div>
              <div className="text-xs text-gray-600">Distance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{routeData.estimatedTime} min</div>
              <div className="text-xs text-gray-600">Est. Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{cartItems.length}</div>
              <div className="text-xs text-gray-600">Items</div>
            </div>
          </div>

          {/* Shop Sequence */}
          <div className="space-y-2">
            <h5 className="font-medium text-gray-900">🚗 Recommended Shop Sequence:</h5>
            {routeData.shops.map((shop, index) => (
              <div key={shop.id} className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{shop.name}</div>
                    <div className="text-xs text-gray-600">{shop.address}</div>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-green-600 font-medium">
                    {mapsService.formatDistance(shop.distanceFromUser)}
                  </div>
                  <div className="text-gray-500">
                    +{mapsService.formatDistance(shop.distanceFromPrevious)} from prev
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Google Maps Link */}
          {userLocation && selectedShops.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${selectedShops.map(shop => `${shop.lat},${shop.lng}`).join('/')}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
              >
                🗺️ Open in Google Maps
              </a>
            </div>
          )}
        </div>
      )}

      {/* Shop List */}
      {!showMap && shops.length > 0 && (
        <div className="p-4 max-h-96 overflow-y-auto">
          <h4 className="font-semibold mb-3">🏪 Available Shops ({shops.length})</h4>
          <div className="space-y-2">
            {shops.map(shop => (
              <div
                key={shop.id}
                className={`p-3 border rounded cursor-pointer transition-colors ${
                  selectedShops.some(s => s.id === shop.id)
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => handleShopSelect(shop)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{shop.name}</div>
                    <div className="text-sm text-gray-600">{shop.address}</div>
                    {shop.products && (
                      <div className="text-xs text-purple-600 mt-1">
                        🔧 {shop.products.length} products available
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {shop.distance && (
                      <div className="text-sm font-medium text-green-600">
                        {mapsService.formatDistance(shop.distance)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {selectedShops.some(s => s.id === shop.id) ? '✅ Selected' : 'Click to select'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && shops.length === 0 && productIds.length > 0 && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-4">🏪</div>
          <div className="text-lg font-medium mb-2">No Shops Found</div>
          <div className="text-sm">
            No shops were found that have the products in your cart.
          </div>
        </div>
      )}

      {/* No Cart Items */}
      {cartItems.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-4">🛒</div>
          <div className="text-lg font-medium mb-2">Cart is Empty</div>
          <div className="text-sm">
            Add some products to your cart to see route planning options.
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedRoutePlanning;