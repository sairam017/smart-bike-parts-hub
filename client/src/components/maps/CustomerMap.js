import React, { useEffect, useRef, useState } from 'react';

const CustomerMap = ({ 
  shops = [], 
  userLocation = null, 
  onLocationSelect = null,
  mapClickEnabled = true,
  selectedShopForRoute = null,
  onRouteCalculated = null
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [routingLoaded, setRoutingLoaded] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');

  // Debug: Log when component re-renders
  console.log('CustomerMap render:', { 
    shopsCount: shops.length, 
    userLocation: userLocation ? 'set' : 'null',
    mapClickEnabled,
    selectedShop: selectedShopForRoute?.name || 'none'
  });

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        setLoadingStatus('Loading Leaflet CSS...');
        
        // Load CSS first
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const leafletCSS = document.createElement('link');
          leafletCSS.rel = 'stylesheet';
          leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(leafletCSS);
        }

        if (!document.querySelector('link[href*="leaflet-routing-machine"]')) {
          const routingCSS = document.createElement('link');
          routingCSS.rel = 'stylesheet';
          routingCSS.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
          document.head.appendChild(routingCSS);
        }

        // Check if Leaflet is already loaded
        if (window.L && window.L.map) {
          setLoadingStatus('Checking routing machine...');
          console.log('Leaflet already loaded');
          setLeafletLoaded(true);
          
          // Check for routing machine with a delay to ensure it's fully loaded
          setTimeout(() => {
            if (window.L.Routing && window.L.Routing.control) {
              console.log('Routing machine already loaded');
              setRoutingLoaded(true);
              setLoadingStatus('Ready!');
            } else {
              setLoadingStatus('Loading routing machine...');
              // Load routing machine
              const routingScript = document.createElement('script');
              routingScript.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
              routingScript.onload = () => {
                console.log('Routing machine loaded');
                setRoutingLoaded(true);
                setLoadingStatus('Ready!');
              };
              routingScript.onerror = () => {
                console.warn('Failed to load routing machine - will use fallback');
                setRoutingLoaded(false);
                setLoadingStatus('Ready (fallback mode)');
              };
              document.head.appendChild(routingScript);
            }
          }, 100);
          return;
        }

        setLoadingStatus('Loading Leaflet...');
        
        // Load Leaflet first
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.onload = () => {
          console.log('Leaflet loaded');
          setLeafletLoaded(true);
          setLoadingStatus('Loading routing machine...');
          
          // Small delay to ensure Leaflet is fully initialized
          setTimeout(() => {
            const routingScript = document.createElement('script');
            routingScript.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
            routingScript.onload = () => {
              console.log('Routing machine loaded');
              setRoutingLoaded(true);
              setLoadingStatus('Ready!');
            };
            routingScript.onerror = () => {
              console.warn('Failed to load routing machine - will use fallback');
              setRoutingLoaded(false);
              setLoadingStatus('Ready (fallback mode)');
            };
            document.head.appendChild(routingScript);
          }, 100);
        };
        leafletScript.onerror = () => {
          console.error('Failed to load Leaflet');
          setLoadingStatus('Failed to load map library');
        };
        document.head.appendChild(leafletScript);

      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        setLoadingStatus('Error loading map');
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map only once
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = window.L;
    
    // Default center - Bangalore, India
    const center = [12.9716, 77.5946];
    const zoom = 11;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: true,
      attributionControl: true
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded]); // Only depend on leafletLoaded

  // Handle map interactions separately
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    // Clear existing click handlers
    map.off('click');
    
    // Add click handler if needed
    if (mapClickEnabled && onLocationSelect) {
      const handleClick = (e) => {
        const { lat, lng } = e.latlng;
        console.log('Map clicked at:', lat, lng);
        onLocationSelect({ lat, lng });
      };
      
      map.on('click', handleClick);
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [mapClickEnabled]); // Don't include onLocationSelect to avoid recreating

  // Clear route when selectedShopForRoute is null
  useEffect(() => {
    if (!selectedShopForRoute && currentRoute && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      console.log('Clearing route');
      
      if (currentRoute.remove) {
        currentRoute.remove();
      } else if (currentRoute.removeFrom) {
        currentRoute.removeFrom(map);
      } else {
        try {
          map.removeControl(currentRoute);
        } catch (e) {
          try {
            map.removeLayer(currentRoute);
          } catch (e2) {
            console.log('Could not remove route layer');
          }
        }
      }
      setCurrentRoute(null);
    }
  }, [selectedShopForRoute]); // Remove currentRoute from dependencies to avoid loops

  // Update markers when user location or shops change
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add user location marker
    if (userLocation) {
      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map);

      userMarker.bindPopup(`
        <div style="text-align: center;">
          <h4 style="margin: 0 0 8px 0; color: #dc2626;">📍 Your Location</h4>
          <p style="margin: 0; color: #666; font-size: 12px;">
            ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}
          </p>
        </div>
      `);

      // Center map on user location
      map.setView([userLocation.lat, userLocation.lng], 13);
    }

    // Add shop markers
    shops.forEach((shop, index) => {
      if (!shop.lat || !shop.lng) return;

      const shopMarker = L.marker([shop.lat, shop.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map);

      const distance = shop.distance ? `${shop.distance.toFixed(1)} km away` : '';
      
      // Create a unique ID for this shop marker
      const shopId = `shop_${shop._id || index}`;
      
      shopMarker.bindPopup(`
        <div style="text-align: center; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #1f2937;">${shop.name}</h3>
          <p style="margin: 4px 0; color: #6b7280; font-size: 12px;">
            📍 ${shop.address || 'Address not available'}
          </p>
          ${shop.contactInfo?.phone || shop.phone ? `
            <p style="margin: 4px 0; color: #6b7280; font-size: 12px;">
              📞 ${shop.contactInfo?.phone || shop.phone}
            </p>
          ` : ''}
          ${distance ? `
            <div style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 12px; margin: 8px 0; font-size: 12px;">
              🚗 ${distance}
            </div>
          ` : ''}
          ${shop.availableProducts ? `
            <div style="background: #f0f9ff; padding: 6px; border-radius: 6px; margin: 8px 0; font-size: 11px;">
              <strong>Available Items:</strong><br/>
              ${shop.availableProducts.slice(0, 2).map(p => p.name).join(', ')}
              ${shop.availableProducts.length > 2 ? ` +${shop.availableProducts.length - 2} more` : ''}
            </div>
          ` : ''}
          <div style="display: flex; gap: 4px; margin-top: 8px;">
            <button 
              onclick="routeToShop_${shopId}()"
              style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;"
            >
              🗺️ Show Route
            </button>
            <button 
              onclick="window.open('https://www.google.com/maps/dir/${userLocation?.lat || ''},${userLocation?.lng || ''}/${shop.lat},${shop.lng}', '_blank')"
              style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;"
            >
              🌐 Google Maps
            </button>
          </div>
        </div>
      `);

      // Add click handler for route button
      window[`routeToShop_${shopId}`] = () => {
        console.log('Route button clicked for shop:', shop.name);
        if (onLocationSelect) {
          // Trigger route calculation by calling parent component
          onLocationSelect({ 
            type: 'showRoute', 
            shop: shop,
            userLocation: userLocation 
          });
        }
      };
    });

  }, [userLocation, shops, leafletLoaded]); // Keep dependencies minimal and stable

  // Handle route calculation when a shop is selected
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded || !selectedShopForRoute || !userLocation) {
      console.log('Route calculation skipped:', { 
        mapInstance: !!mapInstanceRef.current, 
        leafletLoaded, 
        routingLoaded,
        selectedShop: !!selectedShopForRoute, 
        userLocation: !!userLocation 
      });
      return;
    }

    const L = window.L;
    const map = mapInstanceRef.current;

    // Check if routing machine is available
    if (!L.Routing || !L.Routing.control) {
      console.error('Leaflet Routing Machine not available');
      
      // Fallback: draw a simple line between points
      if (currentRoute) {
        map.removeLayer(currentRoute);
      }
      
      const fallbackLine = L.polyline([
        [userLocation.lat, userLocation.lng],
        [selectedShopForRoute.lat, selectedShopForRoute.lng]
      ], {
        color: '#4CAF50',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(map);
      
      setCurrentRoute(fallbackLine);
      
      // Calculate straight-line distance as fallback
      const R = 6371; // Earth's radius in km
      const dLat = (selectedShopForRoute.lat - userLocation.lat) * Math.PI / 180;
      const dLng = (selectedShopForRoute.lng - userLocation.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(userLocation.lat * Math.PI/180) * Math.cos(selectedShopForRoute.lat * Math.PI/180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = (R * c).toFixed(2);
      const estimatedTime = Math.round(parseFloat(distance) * 2); // Rough estimate: 2 min per km
      
      if (onRouteCalculated) {
        onRouteCalculated({
          distance: distance,
          time: estimatedTime,
          shop: selectedShopForRoute
        });
      }
      
      return;
    }

    console.log('Creating route from', userLocation, 'to', selectedShopForRoute);

    // Clear existing route
    if (currentRoute) {
      if (currentRoute.remove) {
        currentRoute.remove();
      } else {
        map.removeControl(currentRoute);
      }
    }

    try {
      // Create new route
      const routeControl = L.Routing.control({
        waypoints: [
          L.latLng(userLocation.lat, userLocation.lng),
          L.latLng(selectedShopForRoute.lat, selectedShopForRoute.lng)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        createMarker: function() { return null; }, // Don't create additional markers
        lineOptions: {
          styles: [{ 
            color: '#4CAF50', 
            weight: 6, 
            opacity: 0.9
          }]
        },
        show: false, // Hide the instruction panel
        collapsible: false,
        draggableWaypoints: false,
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        })
      });

      routeControl.on('routesfound', function(e) {
        console.log('Route found:', e.routes);
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const summary = routes[0].summary;
          
          // Calculate route info
          const distance = (summary.totalDistance / 1000).toFixed(2);
          const time = Math.round(summary.totalTime / 60);
          
          console.log('Route calculated:', { distance, time });
          
          if (onRouteCalculated) {
            onRouteCalculated({
              distance: distance,
              time: time,
              shop: selectedShopForRoute
            });
          }
        }
      });

      routeControl.on('routingerror', function(e) {
        console.error('Routing error:', e);
        // Fallback to straight line
        const fallbackLine = L.polyline([
          [userLocation.lat, userLocation.lng],
          [selectedShopForRoute.lat, selectedShopForRoute.lng]
        ], {
          color: '#ff6b6b',
          weight: 4,
          opacity: 0.8,
          dashArray: '10, 5'
        }).addTo(map);
        
        setCurrentRoute(fallbackLine);
      });

      routeControl.addTo(map);
      setCurrentRoute(routeControl);

      // Fit map to show both points
      const group = new L.featureGroup([
        L.marker([userLocation.lat, userLocation.lng]),
        L.marker([selectedShopForRoute.lat, selectedShopForRoute.lng])
      ]);
      map.fitBounds(group.getBounds().pad(0.1));

    } catch (error) {
      console.error('Error creating route:', error);
    }

  }, [selectedShopForRoute, userLocation, leafletLoaded, routingLoaded]); // Remove onRouteCalculated to prevent re-renders

  if (!leafletLoaded) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#f8f9fa',
        color: '#6c757d',
        fontSize: '1rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🗺️</div>
          <div>{loadingStatus}</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
            {leafletLoaded ? '✅ Leaflet loaded' : '⏳ Loading Leaflet...'}
            <br />
            {routingLoaded ? '✅ Routing ready' : '⏳ Loading routing...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div 
        ref={mapContainerRef} 
        style={{ height: '100%', width: '100%' }}
      />
      
      {/* Click instruction overlay */}
      {mapClickEnabled && !userLocation && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(33, 150, 243, 0.95)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '25px',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: 'pulse 2s infinite'
        }}>
          👆 Tap anywhere on the map to set your location
        </div>
      )}

      {/* Location confirmation */}
      {userLocation && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(16, 185, 129, 0.95)',
          color: 'white',
          padding: '10px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          ✅ Location set: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.05); }
          100% { transform: translateX(-50%) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default CustomerMap;