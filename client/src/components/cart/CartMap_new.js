import React, { useState, useEffect, useRef } from 'react';

const CartMap = ({ shops = [], userLocation = null }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState(userLocation);

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const loadLeaflet = async () => {
      try {
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => setLeafletLoaded(true);
        script.onerror = () => console.error('Failed to load Leaflet');
        document.head.appendChild(script);
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

    const L = window.L;
    
    // Determine map center
    let center = [12.9716, 77.5946]; // Default to Bangalore
    let zoom = 10;

    if (currentUserLocation) {
      center = [currentUserLocation.lat, currentUserLocation.lng];
      zoom = 12;
    } else if (shops.length > 0) {
      const avgLat = shops.reduce((sum, shop) => sum + shop.lat, 0) / shops.length;
      const avgLng = shops.reduce((sum, shop) => sum + shop.lng, 0) / shops.length;
      center = [avgLat, avgLng];
      zoom = 11;
    }

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Handle map clicks for location setting
    map.on('click', (e) => {
      setCurrentUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded]);



  // Create dynamic popup content function
  const createPopupContent = (shop) => {
    const distance = currentUserLocation 
      ? calculateDistance(currentUserLocation.lat, currentUserLocation.lng, shop.lat, shop.lng)
      : null;

    return `
      <div style="text-align: center; font-family: Arial, sans-serif;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px;">${shop.name}</h3>
        <p style="margin: 2px 0; color: #6b7280; font-size: 12px;">📍 ${shop.address || 'Address not available'}</p>
        <p style="margin: 2px 0; color: #6b7280; font-size: 12px;">📦 ${shop.productCount || 0} items</p>
        ${distance ? `
          <p style="margin: 4px 0; color: #059669; font-size: 12px; font-weight: 500;">🚗 ${distance.toFixed(2)} km away</p>
        ` : ''}
        <div style="margin-top: 8px;">
          <button onclick="window.open('https://www.google.com/maps?q=${shop.lat},${shop.lng}', '_blank')" 
                  style="padding: 6px 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">
            🗺️ View Location
          </button>
          ${currentUserLocation ? `
            <button onclick="window.open('https://www.google.com/maps/dir/${currentUserLocation.lat},${currentUserLocation.lng}/${shop.lat},${shop.lng}', '_blank')" 
                    style="padding: 6px 12px; background: #1d4ed8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              🧭 Get Directions
            </button>
          ` : `
            <button onclick="alert('Please set your location first by clicking on the map or using GPS button')" 
                    style="padding: 6px 12px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              🧭 Get Directions
            </button>
          `}
        </div>
      </div>
    `;
  };

  // Add/update markers when shops or user location changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;
    
    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // Add user location marker if available
    if (currentUserLocation) {
      const userMarker = L.marker([currentUserLocation.lat, currentUserLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(mapInstanceRef.current);

      userMarker.bindPopup('<div style="text-align: center;"><h4 style="margin: 0; color: #dc2626;">📍 Your Location</h4><p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280;">Click on shop markers to get directions</p></div>');
      markersRef.current.push(userMarker);
    }

    // Add shop markers with dynamic popup content
    shops.forEach(shop => {
      if (!shop.lat || !shop.lng) return;

      const marker = L.marker([shop.lat, shop.lng]).addTo(mapInstanceRef.current);
      
      // Use dynamic popup that updates when clicked
      marker.on('click', () => {
        marker.setPopupContent(createPopupContent(shop));
      });
      
      // Set initial popup content
      marker.bindPopup(createPopupContent(shop));
      markersRef.current.push(marker);
    });
  }, [shops, currentUserLocation]);

  // Get current GPS location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Click on the map to set it manually.');
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



  if (!leafletLoaded) {
    return (
      <div style={{ 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8fafc',
        borderRadius: '8px',
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
      borderRadius: '8px',
      overflow: 'hidden'
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
            🗺️ Shop Locations ({shops.length} found)
            {currentUserLocation && (
              <span style={{ 
                marginLeft: '8px',
                background: '#10b981', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '0.75rem' 
              }}>
                ✅ Location Set
              </span>
            )}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            {currentUserLocation 
              ? 'Location set! Click shop markers to get directions' 
              : 'Click on map to set your location or use GPS'
            }
          </p>
          {!currentUserLocation && (
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#dc2626', fontWeight: '500' }}>
              ⚠️ Set your location to get directions to shops
            </p>
          )}
        </div>
        <button
          onClick={getCurrentLocation}
          style={{
            padding: '8px 12px',
            background: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          📍 Use GPS
        </button>
      </div>

      {/* Map */}
      <div style={{ height: '400px', position: 'relative' }}>
        <div 
          ref={mapContainerRef} 
          style={{ width: '100%', height: '100%' }}
        />
        {shops.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.9)',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
            <div>No shops found for cart items</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartMap;