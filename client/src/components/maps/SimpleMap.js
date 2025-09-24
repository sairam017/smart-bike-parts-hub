import React, { useState, useEffect, useRef } from 'react';

const SimpleMap = ({ shops = [], userLocation = null, onLocationSelect = null }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [clickMode, setClickMode] = useState(false);
  const [fromCoords, setFromCoords] = useState({ lat: '', lng: '' });
  const [toCoords, setToCoords] = useState({ lat: '', lng: '' });
  const [destType, setDestType] = useState('nearest');
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeControl, setRouteControl] = useState(null);

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
        // Load CSS first
        loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        loadCSS('https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css');
        
        // Load JS
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        await loadScript('https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js');
        
        setLeafletLoaded(true);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || map) return;

    const L = window.L;
    const newMap = L.map(mapRef.current).setView([12.9716, 77.5946], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(newMap);

    // Add shop markers
    shops.forEach(shop => {
      const marker = L.marker([shop.lat, shop.lng])
        .bindPopup(`<h4>${shop.name}</h4><p>${shop.address || 'Bike Parts Shop'}</p>`)
        .addTo(newMap);
    });

    // Handle map clicks
    newMap.on('click', (e) => {
      if (clickMode) {
        const { lat, lng } = e.latlng;
        if (clickMode === 'from') {
          setFromCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
        } else {
          setToCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
        }
        setClickMode(false);
        newMap.getContainer().style.cursor = '';
      }
    });

    setMap(newMap);
  }, [leafletLoaded, shops, clickMode]);

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // Find nearest shop
  const findNearestShop = (userLat, userLng) => {
    return shops.map(shop => ({
      ...shop,
      distance: calculateDistance(userLat, userLng, shop.lat, shop.lng)
    })).sort((a, b) => a.distance - b.distance)[0];
  };

  // Get current GPS location
  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFromCoords({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6)
        });
      },
      (err) => alert('Location access denied')
    );
  };

  // Enter click mode for coordinate selection
  const enterClickMode = (type) => {
    setClickMode(type);
    if (map) {
      map.getContainer().style.cursor = 'crosshair';
    }
  };

  // Calculate route
  const findRoute = () => {
    if (!map || !window.L) return;

    const fromLat = parseFloat(fromCoords.lat);
    const fromLng = parseFloat(fromCoords.lng);
    
    if (isNaN(fromLat) || isNaN(fromLng)) {
      alert('Please enter valid From coordinates');
      return;
    }
    
    let destination;
    
    if (destType === 'nearest') {
      destination = findNearestShop(fromLat, fromLng);
      if (!destination) {
        alert('No shops available');
        return;
      }
    } else {
      const toLat = parseFloat(toCoords.lat);
      const toLng = parseFloat(toCoords.lng);
      
      if (isNaN(toLat) || isNaN(toLng)) {
        alert('Please enter valid To coordinates');
        return;
      }
      
      destination = { name: 'Custom Location', lat: toLat, lng: toLng };
    }
    
    // Clear existing route
    if (routeControl) {
      map.removeControl(routeControl);
    }
    
    // Create new route
    const L = window.L;
    const newRouteControl = L.Routing.control({
      waypoints: [
        L.latLng(fromLat, fromLng),
        L.latLng(destination.lat, destination.lng)
      ],
      createMarker: () => null,
      lineOptions: { styles: [{ color: '#4CAF50', weight: 6, opacity: 0.8 }] }
    }).on('routesfound', (e) => {
      const route = e.routes[0];
      const distance = (route.summary.totalDistance / 1000).toFixed(2);
      const time = Math.round(route.summary.totalTime / 60);
      
      setRouteInfo({
        destination: destination.name,
        distance: distance,
        time: time,
        address: destination.address
      });
    }).addTo(map);
    
    setRouteControl(newRouteControl);
  };

  if (!leafletLoaded) {
    return (
      <div style={{padding: '2rem', textAlign: 'center'}}>
        <div>Loading map components...</div>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', gap: '1rem', height: '500px'}}>
      {/* Input Panel */}
      <div style={{
        width: '300px',
        background: 'white',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'auto'
      }}>
        <h3 style={{marginBottom: '1rem'}}>📍 Route Planning</h3>
        
        {/* From Location */}
        <div style={{marginBottom: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '4px'}}>
          <h4>From: Your Location</h4>
          <input
            type="number"
            placeholder="Latitude"
            value={fromCoords.lat}
            onChange={(e) => setFromCoords(prev => ({...prev, lat: e.target.value}))}
            style={{width: '100%', padding: '0.5rem', margin: '0.25rem 0', border: '1px solid #ddd', borderRadius: '4px'}}
          />
          <input
            type="number"
            placeholder="Longitude" 
            value={fromCoords.lng}
            onChange={(e) => setFromCoords(prev => ({...prev, lng: e.target.value}))}
            style={{width: '100%', padding: '0.5rem', margin: '0.25rem 0', border: '1px solid #ddd', borderRadius: '4px'}}
          />
          <button
            onClick={getCurrentLocation}
            style={{width: '100%', padding: '0.5rem', margin: '0.25rem 0', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
          >
            📍 Use GPS
          </button>
          <button
            onClick={() => enterClickMode('from')}
            style={{width: '100%', padding: '0.5rem', margin: '0.25rem 0', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
          >
            🖱️ Click Map
          </button>
        </div>

        {/* To Location */}
        <div style={{marginBottom: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '4px'}}>
          <h4>To: Destination</h4>
          <div style={{marginBottom: '0.5rem'}}>
            <label style={{display: 'block', marginBottom: '0.25rem'}}>
              <input
                type="radio"
                name="destType"
                value="nearest"
                checked={destType === 'nearest'}
                onChange={(e) => setDestType(e.target.value)}
              />
              Find Nearest Shop
            </label>
            <label style={{display: 'block'}}>
              <input
                type="radio"
                name="destType" 
                value="custom"
                checked={destType === 'custom'}
                onChange={(e) => setDestType(e.target.value)}
              />
              Custom Coordinates
            </label>
          </div>
          
          {destType === 'custom' && (
            <>
              <input
                type="number"
                placeholder="Latitude"
                value={toCoords.lat}
                onChange={(e) => setToCoords(prev => ({...prev, lat: e.target.value}))}
                style={{width: '100%', padding: '0.5rem', margin: '0.25rem 0', border: '1px solid #ddd', borderRadius: '4px'}}
              />
              <input
                type="number"
                placeholder="Longitude"
                value={toCoords.lng} 
                onChange={(e) => setToCoords(prev => ({...prev, lng: e.target.value}))}
                style={{width: '100%', padding: '0.5rem', margin: '0.25rem 0', border: '1px solid #ddd', borderRadius: '4px'}}
              />
              <button
                onClick={() => enterClickMode('to')}
                style={{width: '100%', padding: '0.5rem', margin: '0.25rem 0', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
              >
                🖱️ Click Map
              </button>
            </>
          )}
        </div>

        <button
          onClick={findRoute}
          style={{width: '100%', padding: '0.75rem', background: '#FF9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold'}}
        >
          🗺️ Find Route
        </button>

        {/* Route Information */}
        {routeInfo && (
          <div style={{marginTop: '1rem', padding: '0.5rem', background: '#e8f5e8', borderRadius: '4px'}}>
            <h4>Route Information</h4>
            <p><strong>Destination:</strong> {routeInfo.destination}</p>
            <p><strong>Distance:</strong> {routeInfo.distance} km</p>
            <p><strong>Time:</strong> {routeInfo.time} minutes</p>
            {routeInfo.address && <p><strong>Address:</strong> {routeInfo.address}</p>}
          </div>
        )}

        {/* Click Indicator */}
        {clickMode && (
          <div style={{
            position: 'fixed',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#4CAF50',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            zIndex: 1000
          }}>
            Click on map to select {clickMode} location
          </div>
        )}
      </div>

      {/* Map Container */}
      <div style={{flex: 1, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
        <div ref={mapRef} style={{width: '100%', height: '100%'}} />
      </div>
    </div>
  );
};

export default SimpleMap;