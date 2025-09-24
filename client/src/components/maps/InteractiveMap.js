import React, { useEffect, useRef, useState, useContext } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import LocationContext from '../../context/LocationContext';

// Fix for default markers in Leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const InteractiveMap = ({
  shops = [],
  userLocation = null,
  selectedShops = [],
  onShopSelect = null,
  showRouting = false,
  height = '400px',
  center = [17.3850, 78.4867], // Default to Hyderabad
  zoom = 12,
  className = ''
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeControlRef = useRef(null);
  const markersRef = useRef({});
  const [clickMode, setClickMode] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const { location: contextLocation, setManualLocation } = useContext(LocationContext) || {};

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

  // Find nearest shop to user location
  const findNearestShop = (userLat, userLng) => {
    if (!shops.length) return null;
    
    return shops.map(shop => {
      const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
      const distance = calculateDistance(userLat, userLng, coords[1], coords[0]);
      return { ...shop, distance };
    }).sort((a, b) => a.distance - b.distance)[0];
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create map instance
    const map = L.map(mapRef.current).setView(center, zoom);
    mapInstanceRef.current = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Handle map clicks
    map.on('click', (e) => {
      if (clickMode === 'setLocation' && setManualLocation) {
        const { lat, lng } = e.latlng;
        setManualLocation(lat, lng);
        setClickMode(null);
        map.getContainer().style.cursor = '';
      }
    });

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [center, zoom, clickMode, setManualLocation]);

  // Add shop markers
  useEffect(() => {
    if (!mapInstanceRef.current || !shops.length) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => map.removeLayer(marker));
    markersRef.current = {};

    // Create custom icons
    const shopIcon = L.divIcon({
      html: `<div style="background: #059669; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">🏪</div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const selectedShopIcon = L.divIcon({
      html: `<div style="background: #dc2626; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid yellow; box-shadow: 0 3px 8px rgba(0,0,0,0.4);">🏪</div>`,
      className: 'custom-div-icon',
      iconSize: [35, 35],
      iconAnchor: [17, 17]
    });

    // Add shop markers
    shops.forEach(shop => {
      const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
      if (!coords || coords.length < 2) return;

      const lat = coords[1];
      const lng = coords[0];
      const isSelected = selectedShops.some(s => s._id === shop._id || s.id === shop.id);

      const marker = L.marker([lat, lng], {
        icon: isSelected ? selectedShopIcon : shopIcon
      }).addTo(map);

      const popupContent = `
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #1e293b; font-weight: bold;">${shop.name}</h4>
          ${shop.address ? `<p style="margin: 0 0 8px 0; color: #64748b; font-size: 0.9em;">📍 ${shop.address}</p>` : ''}
          ${shop.distance ? `<p style="margin: 0 0 8px 0; color: #059669; font-weight: bold;">🚗 ${shop.distance.toFixed(2)} km away</p>` : ''}
          ${shop.parts && shop.parts.length ? `<p style="margin: 0 0 8px 0; color: #7c3aed;">🔧 ${shop.parts.length} parts available</p>` : ''}
          ${onShopSelect ? `<button onclick="window.selectShop('${shop._id || shop.id}')" style="background: #1d4ed8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Select Shop</button>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);

      if (onShopSelect) {
        marker.on('click', () => {
          onShopSelect(shop);
        });
      }

      markersRef.current[shop._id || shop.id] = marker;
    });

    // Global function for popup buttons
    if (onShopSelect) {
      window.selectShop = (shopId) => {
        const shop = shops.find(s => s._id === shopId || s.id === shopId);
        if (shop) onShopSelect(shop);
      };
    }

  }, [shops, selectedShops, onShopSelect]);

  // Add user location marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const location = userLocation || (contextLocation ? {
      lat: contextLocation.latitude,
      lng: contextLocation.longitude
    } : null);

    if (!location || !location.lat || !location.lng) return;

    // Remove existing user marker
    if (markersRef.current.userLocation) {
      map.removeLayer(markersRef.current.userLocation);
    }

    // Create user location icon
    const userIcon = L.divIcon({
      html: `<div style="background: #1d4ed8; color: white; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">📍</div>`,
      className: 'custom-div-icon',
      iconSize: [25, 25],
      iconAnchor: [12, 12]
    });

    const userMarker = L.marker([location.lat, location.lng], {
      icon: userIcon
    }).addTo(map);

    userMarker.bindPopup(`
      <div style="text-align: center;">
        <h4 style="margin: 0 0 8px 0; color: #1d4ed8;">📍 Your Location</h4>
        <p style="margin: 0; font-size: 0.9em; color: #64748b;">
          ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
        </p>
        ${contextLocation?.accuracy ? `<p style="margin: 4px 0 0 0; font-size: 0.8em; color: #059669;">±${Math.round(contextLocation.accuracy)}m accuracy</p>` : ''}
      </div>
    `);

    markersRef.current.userLocation = userMarker;

    // Center map on user location if no shops are selected
    if (!selectedShops.length) {
      map.setView([location.lat, location.lng], 13);
    }

  }, [userLocation, contextLocation, selectedShops.length]);

  // Handle routing
  useEffect(() => {
    if (!mapInstanceRef.current || !showRouting || !selectedShops.length) return;

    const map = mapInstanceRef.current;
    const location = userLocation || (contextLocation ? {
      lat: contextLocation.latitude,
      lng: contextLocation.longitude
    } : null);

    if (!location) return;

    // Clear existing route
    if (routeControlRef.current) {
      map.removeControl(routeControlRef.current);
    }

    // Find optimal route through selected shops
    const waypoints = [L.latLng(location.lat, location.lng)];

    // Add selected shops as waypoints (optimize order by distance)
    const sortedShops = [...selectedShops].sort((a, b) => {
      const aCords = a.location?.coordinates || [a.lng || a.lon, a.lat];
      const bCords = b.location?.coordinates || [b.lng || b.lon, b.lat];
      const aDist = calculateDistance(location.lat, location.lng, aCords[1], aCords[0]);
      const bDist = calculateDistance(location.lat, location.lng, bCords[1], bCords[0]);
      return aDist - bDist;
    });

    sortedShops.forEach(shop => {
      const coords = shop.location?.coordinates || [shop.lng || shop.lon, shop.lat];
      if (coords && coords.length >= 2) {
        waypoints.push(L.latLng(coords[1], coords[0]));
      }
    });

    // Create route control
    const routeControl = L.Routing.control({
      waypoints: waypoints,
      routeWhileDragging: false,
      createMarker: () => null, // Don't create default markers
      lineOptions: {
        styles: [{ color: '#1d4ed8', weight: 6, opacity: 0.8 }]
      },
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1'
      })
    }).on('routesfound', (e) => {
      const routes = e.routes;
      const summary = routes[0].summary;
      
      setRouteInfo({
        distance: (summary.totalDistance / 1000).toFixed(2),
        time: Math.round(summary.totalTime / 60),
        shops: sortedShops.length
      });
    }).addTo(map);

    routeControlRef.current = routeControl;

    // Fit map to show all waypoints
    if (waypoints.length > 1) {
      const group = new L.featureGroup(waypoints.map(wp => L.marker(wp)));
      map.fitBounds(group.getBounds().pad(0.1));
    }

  }, [showRouting, selectedShops, userLocation, contextLocation]);

  const enterClickMode = () => {
    setClickMode('setLocation');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getContainer().style.cursor = 'crosshair';
    }
  };

  const findNearestShopHandler = () => {
    const location = userLocation || (contextLocation ? {
      lat: contextLocation.latitude,
      lng: contextLocation.longitude
    } : null);

    if (!location) {
      alert('Please set your location first');
      return;
    }

    const nearest = findNearestShop(location.lat, location.lng);
    if (nearest && onShopSelect) {
      onShopSelect(nearest);
      
      // Center map on nearest shop
      if (mapInstanceRef.current) {
        const coords = nearest.location?.coordinates || [nearest.lng || nearest.lon, nearest.lat];
        mapInstanceRef.current.setView([coords[1], coords[0]], 15);
      }
    } else {
      alert('No shops found');
    }
  };

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Map Controls */}
      <div className="absolute top-2 left-2 z-[1000] bg-white rounded-lg shadow-lg p-2 space-y-2">
        <button
          onClick={enterClickMode}
          className="block w-full px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          title="Click on map to set your location"
        >
          📍 Click to Set Location
        </button>
        
        {shops.length > 0 && (
          <button
            onClick={findNearestShopHandler}
            className="block w-full px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            🎯 Find Nearest Shop
          </button>
        )}
      </div>

      {/* Click Mode Indicator */}
      {clickMode && (
        <div className="absolute top-2 right-2 z-[1000] bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm font-semibold">Click on map to select location</div>
        </div>
      )}

      {/* Route Info */}
      {routeInfo && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-white rounded-lg shadow-lg p-3">
          <h4 className="font-semibold text-sm mb-2">🗺️ Route Information</h4>
          <div className="text-xs space-y-1">
            <div>📏 Distance: {routeInfo.distance} km</div>
            <div>⏱️ Time: {routeInfo.time} minutes</div>
            <div>🏪 Shops: {routeInfo.shops}</div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />
    </div>
  );
};

export default InteractiveMap;