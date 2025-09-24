import React, { useState, useEffect, useRef } from 'react';

const CartMap = ({ shops = [], userLocation = null }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userLocationMarkerRef = useRef(null);
  const shopMarkersRef = useRef([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState(userLocation);
  const [showShopsList, setShowShopsList] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const loadCSS = (href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    const loadLeaflet = async () => {
      try {
        loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        setLeafletLoaded(true);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    try {
      const L = window.L;
      
      // Determine map center
      let mapCenter = [12.9716, 77.5946]; // Default to Bangalore
      let mapZoom = 10;

      if (currentUserLocation) {
        mapCenter = [currentUserLocation.lat, currentUserLocation.lng];
        mapZoom = 12;
      } else if (shops.length > 0) {
        const avgLat = shops.reduce((sum, shop) => sum + shop.lat, 0) / shops.length;
        const avgLng = shops.reduce((sum, shop) => sum + shop.lng, 0) / shops.length;
        mapCenter = [avgLat, avgLng];
        mapZoom = 11;
      }

      const map = L.map(mapContainerRef.current, {
        center: mapCenter,
        zoom: mapZoom,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
      setIsMapReady(true);

      // Handle map clicks for location setting with enhanced feedback
      map.on('click', handleMapClick);

      return () => {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
          } catch (e) {
            console.warn('Map cleanup warning:', e);
          }
          mapInstanceRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [leafletLoaded]);

  // Enhanced map click handler with visual feedback and location updates
  const handleMapClick = (event) => {
    const { lat, lng } = event.latlng;
    const newLocation = { lat, lng };
    const currentTime = Date.now();
    
    // Prevent rapid clicking
    if (currentTime - lastClickTime < 500) return;
    setLastClickTime(currentTime);
    
    setCurrentUserLocation(newLocation);
    
    // Provide visual feedback with ripple effect
    if (window.L && mapInstanceRef.current) {
      const L = window.L;
      
      // Create expanding circle animation
      const ripple = L.circle([lat, lng], {
        radius: 0,
        fillColor: '#059669',
        color: '#059669',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.3
      }).addTo(mapInstanceRef.current);
      
      // Animate the ripple expansion
      let radius = 0;
      const maxRadius = 200;
      const animate = () => {
        radius += 20;
        if (radius <= maxRadius) {
          ripple.setRadius(radius);
          ripple.setStyle({
            opacity: 1 - (radius / maxRadius),
            fillOpacity: 0.3 - (0.3 * radius / maxRadius)
          });
          requestAnimationFrame(animate);
        } else {
          mapInstanceRef.current.removeLayer(ripple);
        }
      };
      animate();
      
      // Show notification
      showLocationUpdateNotification(lat, lng);
    }
  };

  // Show location update notification
  const showLocationUpdateNotification = (lat, lng) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #059669;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    notification.innerHTML = `📍 Location Updated<br><small>Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</small>`;
    
    document.body.appendChild(notification);
    
    // Slide in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Slide out and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  };

  // Add shop markers with updated distances
  const addShopMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;
    
    shops.forEach(shop => {
      const marker = L.marker([shop.lat, shop.lng], {
        icon: L.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(mapInstanceRef.current);

      const distance = currentUserLocation 
        ? calculateDistance(currentUserLocation.lat, currentUserLocation.lng, shop.lat, shop.lng)
        : null;

      const popupContent = `
        <div style="text-align: center; font-family: Arial, sans-serif;">
          <h3 style="margin: 0 0 8px 0; color: #1f2937;">${shop.name}</h3>
          <p style="margin: 4px 0; color: #6b7280; font-size: 12px;">
            📍 ${shop.address}
          </p>
          <p style="margin: 4px 0; color: #6b7280; font-size: 12px;">
            📦 ${shop.productCount} item${shop.productCount !== 1 ? 's' : ''} available
          </p>
          ${distance !== null ? `
            <p style="margin: 4px 0; color: #059669; font-size: 12px; font-weight: 500;">
              🚗 ${distance.toFixed(2)} km away
            </p>
            <button onclick="window.open('https://www.google.com/maps/dir/${currentUserLocation.lat},${currentUserLocation.lng}/${shop.lat},${shop.lng}', '_blank')" 
                    style="margin-top: 8px; padding: 6px 12px; background: #1d4ed8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
              🗺️ Get Directions
            </button>
          ` : `
            <p style="margin: 8px 0; color: #dc2626; font-size: 11px; font-weight: 500;">
              📍 Tap map to set location for directions
            </p>
          `}
        </div>
      `;
      
      marker.bindPopup(popupContent);
      shopMarkersRef.current.push(marker);
    });
  };

  // Clear existing shop markers
  const clearShopMarkers = () => {
    try {
      shopMarkersRef.current.forEach(marker => {
        if (mapInstanceRef.current && marker) {
          try {
            mapInstanceRef.current.removeLayer(marker);
          } catch (e) {
            console.warn('Could not remove shop marker:', e);
          }
        }
      });
      shopMarkersRef.current = [];
    } catch (error) {
      console.warn('Error clearing shop markers:', error);
    }
  };

  // Update shop markers when shops or location change
  useEffect(() => {
    if (isMapReady && shops.length > 0) {
      clearShopMarkers();
      addShopMarkers();
    }
  }, [isMapReady, shops, currentUserLocation]);

  // Add or update user location marker with enhanced interactivity
  const updateUserLocationMarker = () => {
    if (!mapInstanceRef.current || !currentUserLocation || !window.L) return;

    const L = window.L;

    // Remove existing user location marker
    if (userLocationMarkerRef.current) {
      try {
        mapInstanceRef.current.removeLayer(userLocationMarkerRef.current);
      } catch (e) {
        console.warn('Could not remove user marker:', e);
      }
    }

    // Add new user location marker with click handler
    try {
      userLocationMarkerRef.current = L.marker([currentUserLocation.lat, currentUserLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        }),
        draggable: true // Make the marker draggable
      }).addTo(mapInstanceRef.current);

      // Handle marker drag to update location
      userLocationMarkerRef.current.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        const newLocation = { lat: newPos.lat, lng: newPos.lng };
        setCurrentUserLocation(newLocation);
        showLocationUpdateNotification(newPos.lat, newPos.lng);
      });

      userLocationMarkerRef.current.bindPopup(`
        <div style="text-align: center; font-family: Arial, sans-serif;">
          <h4 style="margin: 0 0 8px 0; color: #dc2626;">📍 Your Location</h4>
          <p style="margin: 4px 0; color: #6b7280; font-size: 12px;">
            Lat: ${currentUserLocation.lat.toFixed(6)}<br>
            Lng: ${currentUserLocation.lng.toFixed(6)}
          </p>
          <p style="margin: 8px 0 4px 0; color: #059669; font-size: 11px;">
            💡 Drag me to update location<br>
            or tap elsewhere on map
          </p>
        </div>
      `);

      // Center map on user location
      mapInstanceRef.current.setView([currentUserLocation.lat, currentUserLocation.lng], 13);
    } catch (error) {
      console.error('Error adding user location marker:', error);
    }
  };

  // Update user location marker when location changes
  useEffect(() => {
    if (isMapReady && currentUserLocation) {
      updateUserLocationMarker();
      // Refresh shop markers to update distances
      if (shops.length > 0) {
        clearShopMarkers();
        addShopMarkers();
      }
    }
  }, [isMapReady, currentUserLocation]);

  // Get current GPS location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCurrentUserLocation(newLocation);
        showLocationUpdateNotification(newLocation.lat, newLocation.lng);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to retrieve your location. Please tap on the map to set your location manually.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  // Calculate distance between two points
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Sort shops by distance from user location
  const getSortedShops = () => {
    if (!currentUserLocation) return shops;
    
    return [...shops].sort((a, b) => {
      const distanceA = calculateDistance(currentUserLocation.lat, currentUserLocation.lng, a.lat, a.lng);
      const distanceB = calculateDistance(currentUserLocation.lat, currentUserLocation.lng, b.lat, b.lng);
      return distanceA - distanceB;
    });
  };

  // Handle directions button click
  const handleDirections = (shop) => {
    if (!currentUserLocation) {
      alert('Please set your location first by tapping on the map or using GPS.');
      return;
    }

    if (window.confirm(`Open Google Maps for directions to ${shop.name}?`)) {
      const url = `https://www.google.com/maps/dir/${currentUserLocation.lat},${currentUserLocation.lng}/${shop.lat},${shop.lng}`;
      window.open(url, '_blank');
    }
  };

  if (!leafletLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        background: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🗺️</div>
          <div>Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 6px 18px rgba(2,6,23,.06)'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e5e7eb',
        background: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
            🗺️ Shop Locations for Cart Items
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            {currentUserLocation 
              ? 'Tap anywhere on map or drag red marker to update location' 
              : 'Tap on the map to set your location or use GPS'
            }
          </p>
          {!currentUserLocation && (
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#dc2626', fontWeight: '500' }}>
              ⚠️ Set your location to get directions and distances
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={getCurrentLocation}
            style={{
              padding: '8px 12px',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            📍 Use GPS
          </button>
          <button
            onClick={() => setShowShopsList(!showShopsList)}
            style={{
              padding: '8px 12px',
              background: showShopsList ? '#1d4ed8' : '#f3f4f6',
              color: showShopsList ? 'white' : '#374151',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            {showShopsList ? '🗺️ Map' : '📋 List'}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div style={{ height: '400px', position: 'relative' }}>
        <div 
          ref={mapContainerRef} 
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Shops List */}
      {showShopsList && shops.length > 0 && (
        <div style={{
          borderTop: '1px solid #e5e7eb',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          <div style={{
            padding: '1rem',
            background: '#f8fafc',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
              Available Shops ({shops.length})
            </h4>
            {currentUserLocation && (
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Sorted by distance from your location
              </p>
            )}
          </div>
          
          <div style={{ padding: '0.5rem' }}>
            {getSortedShops().map((shop, index) => (
              <div
                key={shop._id || index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  margin: '0.5rem 0',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ flex: 1 }}>
                  <h5 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#1f2937' }}>
                    {shop.name}
                  </h5>
                  <p style={{ margin: '0 0 2px 0', fontSize: '0.8rem', color: '#6b7280' }}>
                    📍 {shop.address}
                  </p>
                  <p style={{ margin: '0', fontSize: '0.8rem', color: '#6b7280' }}>
                    📦 {shop.productCount} item{shop.productCount !== 1 ? 's' : ''} available
                  </p>
                  {currentUserLocation && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#059669', fontWeight: '500' }}>
                      🚗 {calculateDistance(currentUserLocation.lat, currentUserLocation.lng, shop.lat, shop.lng).toFixed(2)} km away
                    </p>
                  )}
                </div>
                
                <button
                  onClick={() => handleDirections(shop)}
                  disabled={!currentUserLocation}
                  style={{
                    padding: '6px 12px',
                    background: currentUserLocation ? '#1d4ed8' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: currentUserLocation ? 'pointer' : 'not-allowed',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    marginLeft: '12px'
                  }}
                >
                  🗺️ Directions
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No shops message */}
      {shops.length === 0 && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#6b7280',
          background: '#f9fafb'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏪</div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            No shops found for cart items
          </p>
        </div>
      )}
    </div>
  );
};

export default CartMap;