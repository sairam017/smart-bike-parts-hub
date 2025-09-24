import React, { useState, useEffect, useRef } from 'react';

const ProductMap = ({ 
  shops = [], 
  userLocation = null, 
  selectedParts = [], 
  selectedProducts = [], 
  showShopInfo = false, 
  showUserLocation = false 
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState(userLocation);
  const [showShopsList, setShowShopsList] = useState(false);
  const [mapKey, setMapKey] = useState(0); // Force re-render if needed

  // Load Leaflet dynamically with improved loading logic
  useEffect(() => {
    const loadLeaflet = async () => {
      // If Leaflet is already loaded, mark as ready
      if (window.L && window.L.map) {
        console.log('Leaflet already loaded');
        setLeafletLoaded(true);
        return;
      }

      try {
        console.log('Loading Leaflet library...');
        
        // Load CSS first and wait for it
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          
          await new Promise((resolve, reject) => {
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
          });
          
          console.log('Leaflet CSS loaded');
          
          // Enhanced CSS to force full map visibility and fix common display issues
          const style = document.createElement('style');
          style.textContent = `
            .leaflet-container {
              background: #f8f9fa !important;
              width: 100% !important;
              height: 100% !important;
              z-index: 1 !important;
              position: relative !important;
              outline: none !important;
              font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif !important;
            }
            .leaflet-tile-pane {
              opacity: 1 !important;
              filter: brightness(1) contrast(1.05) saturate(1.1) !important;
              transform: translate3d(0px, 0px, 0px) !important;
              will-change: transform !important;
            }
            .leaflet-tile {
              opacity: 1 !important;
              filter: none !important;
              visibility: visible !important;
              display: block !important;
              image-rendering: -webkit-optimize-contrast !important;
              image-rendering: crisp-edges !important;
              backface-visibility: hidden !important;
              transform: translateZ(0) !important;
              transition: opacity 0.2s !important;
            }
            .leaflet-tile-container {
              opacity: 1 !important;
              visibility: visible !important;
              overflow: visible !important;
            }
            .leaflet-layer {
              opacity: 1 !important;
              position: relative !important;
            }
            .leaflet-control-zoom {
              background: rgba(255,255,255,0.9) !important;
              border-radius: 6px !important;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
              backdrop-filter: blur(10px) !important;
            }
            .leaflet-control-zoom a {
              background-color: transparent !important;
              color: #333 !important;
              opacity: 1 !important;
              width: 30px !important;
              height: 30px !important;
              line-height: 30px !important;
              text-align: center !important;
              text-decoration: none !important;
              font-size: 18px !important;
              font-weight: bold !important;
              border: none !important;
              display: block !important;
            }
            .leaflet-control-zoom a:hover {
              background-color: rgba(0,0,0,0.05) !important;
              color: #000 !important;
            }
            .leaflet-control-zoom a:first-child {
              border-top-left-radius: 6px !important;
              border-top-right-radius: 6px !important;
            }
            .leaflet-control-zoom a:last-child {
              border-bottom-left-radius: 6px !important;
              border-bottom-right-radius: 6px !important;
            }
            .leaflet-map-pane {
              opacity: 1 !important;
              transform: translate3d(0px, 0px, 0px) !important;
            }
            .leaflet-proxy {
              opacity: 1 !important;
            }
            .leaflet-control-container {
              opacity: 1 !important;
            }
            .leaflet-control-attribution {
              background: rgba(255,255,255,0.8) !important;
              color: #666 !important;
              font-size: 11px !important;
              padding: 2px 5px !important;
              border-radius: 3px !important;
              backdrop-filter: blur(5px) !important;
            }
            /* Fix for tile loading issues */
            .leaflet-tile-loaded {
              opacity: 1 !important;
              animation: fadeIn 0.2s ease-in !important;
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            /* Enhanced marker visibility */
            .leaflet-marker-icon {
              opacity: 1 !important;
              filter: drop-shadow(2px 2px 6px rgba(0,0,0,0.4)) !important;
              transform: translateZ(0) !important;
              will-change: transform !important;
            }
            .leaflet-marker-shadow {
              opacity: 0.6 !important;
            }
            .leaflet-popup {
              opacity: 1 !important;
              z-index: 1000 !important;
            }
            .leaflet-popup-content-wrapper {
              opacity: 1 !important;
              background: rgba(255,255,255,0.98) !important;
              backdrop-filter: blur(10px) !important;
              border-radius: 8px !important;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
              border: 1px solid rgba(0,0,0,0.1) !important;
            }
            .leaflet-popup-tip {
              background: rgba(255,255,255,0.98) !important;
              border: 1px solid rgba(0,0,0,0.1) !important;
              border-top: none !important;
              border-right: none !important;
            }
            /* Fix for fade animations that might cause missing tiles */
            .leaflet-fade-anim .leaflet-tile {
              transition: opacity 0.2s linear !important;
            }
            .leaflet-zoom-anim .leaflet-tile {
              transition: none !important;
            }
            /* Ensure tiles load properly on different zoom levels */
            .leaflet-tile[src*="openstreetmap"] {
              opacity: 1 !important;
              max-width: none !important;
              max-height: none !important;
            }
            /* Force all tiles to be visible */
            .leaflet-tile-pane img {
              opacity: 1 !important;
              visibility: visible !important;
              display: block !important;
            }
            /* Fix for any clipping issues */
            .leaflet-container * {
              box-sizing: border-box !important;
            }
            /* Ensure proper tile grid display */
            .leaflet-grid-label {
              opacity: 1 !important;
            }
            /* Fix potential transform issues */
            .leaflet-zoom-animated {
              transform: none !important;
            }
            /* Emergency CSS reset for any overrides */
            .leaflet-container img.leaflet-tile {
              width: 256px !important;
              height: 256px !important;
              opacity: 1 !important;
              visibility: visible !important;
              display: block !important;
              position: absolute !important;
            }
          `;
          document.head.appendChild(style);
        }

        // Load JavaScript and wait for it
        if (!document.querySelector('script[src*="leaflet"]')) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          
          console.log('Leaflet JS loaded');
        }

        // Wait a bit more to ensure everything is properly initialized
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify Leaflet is actually available
        if (window.L && window.L.map) {
          console.log('Leaflet fully loaded and ready');
          setLeafletLoaded(true);
        } else {
          throw new Error('Leaflet failed to initialize properly');
        }
        
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        // Retry after 1 second
        setTimeout(() => {
          console.log('Retrying Leaflet load...');
          loadLeaflet();
        }, 1000);
      }
    };

    loadLeaflet();
  }, []);

  // Add ResizeObserver to handle container size changes
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      console.log('Container size changed, refreshing map');
      if (mapInstanceRef.current) {
        setTimeout(() => {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }, 100);
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapInstanceRef.current]);

  // Initialize map with improved timing and validation
  useEffect(() => {
    const initializeMap = async () => {
      // Ensure all prerequisites are met
      if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) {
        console.log('Map initialization skipped:', { leafletLoaded, hasContainer: !!mapContainerRef.current, hasInstance: !!mapInstanceRef.current });
        return;
      }

      if (!window.L || !window.L.map) {
        console.error('Leaflet not properly loaded');
        return;
      }

      try {
        console.log('Initializing map...');
        const L = window.L;
        
        // Enhanced container readiness check with timeout
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 50; // 5 seconds max wait
          
          const checkContainer = () => {
            attempts++;
            const container = mapContainerRef.current;
            
            if (container && container.offsetHeight > 0 && container.offsetWidth > 0) {
              console.log(`Container ready after ${attempts} attempts:`, {
                width: container.offsetWidth,
                height: container.offsetHeight
              });
              resolve();
            } else if (attempts >= maxAttempts) {
              console.warn('Container not ready after max attempts, proceeding anyway');
              resolve(); // Proceed anyway
            } else {
              setTimeout(checkContainer, 100);
            }
          };
          checkContainer();
        });
        
        // Default center - Bangalore
        let center = [12.9716, 77.5946];
        let zoom = 10;

        // Use user location if available
        if (currentUserLocation) {
          center = [currentUserLocation.lat, currentUserLocation.lng];
          zoom = 12;
          console.log('Using user location for map center:', center);
        } else if (shops.length > 0) {
          // Center on shops
          const validShops = shops.filter(shop => shop.lat && shop.lng);
          if (validShops.length > 0) {
            const avgLat = validShops.reduce((sum, shop) => sum + shop.lat, 0) / validShops.length;
            const avgLng = validShops.reduce((sum, shop) => sum + shop.lng, 0) / validShops.length;
            center = [avgLat, avgLng];
            zoom = 11;
            console.log('Using shops center for map:', center);
          }
        }

        console.log('Creating map with center:', center, 'zoom:', zoom);
        const map = L.map(mapContainerRef.current, {
          center: center,
          zoom: zoom,
          preferCanvas: false,
          zoomControl: true,
          attributionControl: true,
          fadeAnimation: false,
          zoomAnimation: true,
          markerZoomAnimation: true,
          inertia: true,
          worldCopyJump: false,
          maxBoundsViscosity: 0.0
        });

        // Enhanced tile layer configuration for better visibility and faster loading
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 1,
          opacity: 1.0,
          crossOrigin: true,
          errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBCMLZXJ0YWgsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjNlbSI+VGlsZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+',
          detectRetina: true,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 3,
          tileSize: 256,
          subdomains: 'abc',
          noWrap: false,
          continuousWorld: false,
          reuseTiles: true
        });

        // Add tile layer with aggressive loading strategy
        tileLayer.addTo(map);
        
        // Enhanced tile loading with multiple strategies
        await new Promise(resolve => {
          let tilesLoaded = false;
          let loadingComplete = false;
          
          const completeLoading = () => {
            if (!loadingComplete) {
              loadingComplete = true;
              console.log('Tile loading completed');
              resolve();
            }
          };
          
          tileLayer.on('loading', () => {
            console.log('Tiles loading started...');
          });
          
          tileLayer.on('load', () => {
            console.log('Tiles loaded successfully');
            tilesLoaded = true;
            setTimeout(completeLoading, 200); // Small delay to ensure all tiles settle
          });
          
          tileLayer.on('tileerror', (error) => {
            console.warn('Tile error:', error);
            // Don't fail on individual tile errors
          });
          
          // Aggressive fallback timeout
          setTimeout(() => {
            if (!tilesLoaded) {
              console.log('Forcing tile load completion due to timeout');
            }
            completeLoading();
          }, 2000);
        });

        // Store map instance
        mapInstanceRef.current = map;
        console.log('Map instance created and stored');

        // Force map to refresh and ensure tiles are fully loaded - enhanced timing and methods
        const refreshMap = (attempt = 1) => {
          try {
            if (map && mapContainerRef.current) {
              console.log(`Refreshing map size and tiles (attempt ${attempt})`);
              
              // Force container size recalculation
              const container = mapContainerRef.current;
              if (container.offsetWidth > 0 && container.offsetHeight > 0) {
                map.invalidateSize({ debounceMoveend: true, pan: false });
                
                // Force redraw of tile layer
                if (tileLayer) {
                  tileLayer.redraw();
                }
                
                // Ensure all tiles are properly loaded
                map.eachLayer((layer) => {
                  if (layer.redraw && typeof layer.redraw === 'function') {
                    layer.redraw();
                  }
                });
                
                console.log('Map refresh completed successfully');
              } else if (attempt < 5) {
                // Retry if container not ready
                setTimeout(() => refreshMap(attempt + 1), 100 * attempt);
              }
            }
          } catch (error) {
            console.warn('Error refreshing map:', error);
          }
        };

        // Multiple refresh attempts with progressive timing
        [50, 150, 400, 800, 1500, 3000].forEach((delay, index) => {
          setTimeout(() => refreshMap(index + 1), delay);
        });

        // Add click handler for location setting
        map.on('click', (e) => {
          console.log('Map clicked at:', e.latlng);
          setCurrentUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        // Final comprehensive refresh after all initialization
        setTimeout(() => {
          try {
            console.log('Performing final map refresh and validation');
            if (map && mapContainerRef.current) {
              // Force one final refresh
              map.invalidateSize({ animate: false, pan: false });
              
              // Ensure all layers are properly displayed
              map.eachLayer((layer) => {
                if (layer.redraw) layer.redraw();
              });
              
              // Force tile layer refresh
              if (tileLayer) {
                tileLayer.redraw();
                // Force reload tiles if necessary
                tileLayer._reset();
                tileLayer._update();
              }
              
              console.log('Final map refresh completed');
            }
          } catch (error) {
            console.warn('Final refresh error:', error);
          }
        }, 4000);

        console.log('Map initialization completed successfully');

      } catch (error) {
        console.error('Error initializing map:', error);
        // Clean up on error
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
          } catch (e) {
            console.warn('Error cleaning up map:', e);
          }
          mapInstanceRef.current = null;
        }
      }
    };

    initializeMap();
  }, [leafletLoaded, currentUserLocation, shops]);

  // Update current user location when prop changes
  useEffect(() => {
    if (userLocation && (userLocation.lat !== currentUserLocation?.lat || userLocation.lng !== currentUserLocation?.lng)) {
      setCurrentUserLocation(userLocation);
    }
  }, [userLocation, currentUserLocation]);

  // Add/update markers when shops or user location changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) {
      console.log('Markers update skipped: map not ready');
      return;
    }

    const L = window.L;
    const map = mapInstanceRef.current;

    console.log('Updating markers...', { shops: shops.length, userLocation: !!currentUserLocation });

    // Clear existing markers
    markersRef.current.forEach(marker => {
      try {
        map.removeLayer(marker);
      } catch (e) {
        console.warn('Could not remove marker:', e);
      }
    });
    markersRef.current = [];

    // Add user location marker if available
    if (currentUserLocation) {
      try {
        const userMarker = L.marker([currentUserLocation.lat, currentUserLocation.lng], {
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
              Click anywhere on map to update
            </p>
          </div>
        `);

        markersRef.current.push(userMarker);
        console.log('User location marker added');
      } catch (error) {
        console.warn('Could not add user marker:', error);
      }
    }

    // Add shop markers
    shops.forEach((shop, index) => {
      if (!shop.lat || !shop.lng) {
        console.warn('Shop missing coordinates:', shop.name);
        return;
      }

      try {
        const marker = L.marker([shop.lat, shop.lng]).addTo(map);
        
        const itemCount = shop.productCount || shop.products?.length || 0;
        const availabilityColor = itemCount > 3 ? '#059669' : itemCount > 0 ? '#f59e0b' : '#dc2626';
        const availabilityText = itemCount > 3 ? 'High Stock' : itemCount > 0 ? 'Limited Stock' : 'Out of Stock';
        
        // Create dynamic popup content function for this shop
        const createShopPopupContent = () => {
          const distance = currentUserLocation ? 
            calculateDistance(currentUserLocation.lat, currentUserLocation.lng, shop.lat, shop.lng) : null;
          
          // Check which selected parts are available at this shop
          const availableSelectedParts = selectedParts.filter(part => 
            shop.products && shop.products.some(product => product._id === part._id)
          );

          return `
            <div style="text-align: center; font-family: Arial, sans-serif; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px;">${shop.name}</h3>
              <div style="background: #f8fafc; padding: 8px; border-radius: 6px; margin: 8px 0;">
                <p style="margin: 2px 0; color: #6b7280; font-size: 11px;">
                  📍 ${shop.address || 'Address not available'}
                </p>
                <div style="display: flex; align-items: center; justify-content: center; margin: 4px 0;">
                  <span style="color: ${availabilityColor}; font-weight: 600; font-size: 11px;">
                    ●
                  </span>
                  <span style="margin-left: 4px; color: ${availabilityColor}; font-size: 11px; font-weight: 500;">
                    ${availabilityText}
                  </span>
                  <span style="margin-left: 4px; color: #6b7280; font-size: 11px;">
                    (${itemCount} items)
                  </span>
                </div>
                ${availableSelectedParts.length > 0 && showShopInfo ? `
                  <div style="background: #ecfdf5; padding: 6px; border-radius: 4px; margin: 6px 0; border-left: 3px solid #10b981;">
                    <p style="margin: 0 0 3px 0; color: #059669; font-size: 10px; font-weight: 600;">
                      ✅ Has ${availableSelectedParts.length} of your selected parts:
                    </p>
                    <p style="margin: 0; color: #047857; font-size: 9px; line-height: 1.2;">
                      ${availableSelectedParts.map(part => part.name).join(', ').substring(0, 80)}${availableSelectedParts.map(part => part.name).join(', ').length > 80 ? '...' : ''}
                    </p>
                  </div>
                ` : ''}
              </div>
              ${distance ? `
                <div style="background: #ecfdf5; padding: 6px; border-radius: 4px; margin: 8px 0;">
                  <p style="margin: 0; color: #059669; font-size: 11px; font-weight: 500;">
                    🚗 ${distance.toFixed(2)} km away
                  </p>
                </div>
              ` : ''}
              <div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
                <button onclick="window.open('https://www.google.com/maps?q=${shop.lat},${shop.lng}', '_blank')" 
                        style="padding: 6px 12px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  🗺️ View Location
                </button>
                ${currentUserLocation ? `
                  <button onclick="window.open('https://www.google.com/maps/dir/${currentUserLocation.lat},${currentUserLocation.lng}/${shop.lat},${shop.lng}', '_blank')" 
                          style="padding: 6px 12px; background: linear-gradient(135deg, #1d4ed8, #3b82f6); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    🧭 Get Directions
                  </button>
                ` : `
                  <button onclick="alert('Please set your location first by clicking anywhere on the map or using the GPS button')" 
                          style="padding: 6px 12px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    🧭 Set Location First
                  </button>
                `}
              </div>
            </div>
          `;
        };
        
        // Use dynamic popup that updates when clicked
        marker.on('click', () => {
          marker.setPopupContent(createShopPopupContent());
        });
        
        // Set initial popup content
        marker.bindPopup(createShopPopupContent());
        markersRef.current.push(marker);
        console.log(`Shop marker added: ${shop.name} (${index + 1}/${shops.length})`);
      } catch (error) {
        console.warn('Could not add shop marker:', shop.name, error);
      }
    });

    console.log(`Total markers added: ${markersRef.current.length}`);

  }, [shops, currentUserLocation]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('Cleaning up ProductMap');
      // Clear markers
      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => {
          try {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(marker);
            }
          } catch (e) {
            console.warn('Could not remove marker during cleanup:', e);
          }
        });
        markersRef.current = [];
      }
      
      // Remove map instance
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          console.log('Map instance removed');
        } catch (e) {
          console.warn('Error removing map:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);  // Get current GPS location
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
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  // Calculate distance between two points
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get sorted shops by distance
  const getSortedShops = () => {
    if (!currentUserLocation) return shops;
    return [...shops].sort((a, b) => {
      const distA = calculateDistance(currentUserLocation.lat, currentUserLocation.lng, a.lat, a.lng);
      const distB = calculateDistance(currentUserLocation.lat, currentUserLocation.lng, b.lat, b.lng);
      return distA - distB;
    });
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
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        background: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
            🗺️ Shop Locations ({shops.length} found)
            {selectedParts.length > 0 && (
              <span style={{ 
                marginLeft: '8px',
                background: '#3b82f6', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '0.75rem' 
              }}>
                {selectedParts.length} parts selected
              </span>
            )}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {selectedParts.length > 0 && showShopInfo 
              ? `Showing shops with: ${selectedParts.map(p => p.name).join(', ').substring(0, 40)}${selectedParts.map(p => p.name).join(', ').length > 40 ? '...' : ''}`
              : currentUserLocation 
                ? 'Click anywhere on map to update your location' 
                : 'Click on map to set your location or use GPS'
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={getCurrentLocation}
            style={{
              padding: '6px 10px',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}
          >
            📍 Use GPS
          </button>
          <button
            onClick={() => {
              // Force map refresh
              if (mapInstanceRef.current) {
                console.log('Manual map refresh triggered');
                setTimeout(() => {
                  mapInstanceRef.current.invalidateSize({ animate: false });
                  mapInstanceRef.current.eachLayer((layer) => {
                    if (layer.redraw) layer.redraw();
                  });
                }, 100);
              } else {
                // Force complete reload
                setMapKey(prev => prev + 1);
              }
            }}
            style={{
              padding: '6px 10px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowShopsList(!showShopsList)}
            style={{
              padding: '6px 10px',
              background: showShopsList ? '#1d4ed8' : '#f3f4f6',
              color: showShopsList ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}
          >
            {showShopsList ? '🗺️ Map' : '📋 List'}
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        overflow: 'visible',
        minHeight: '350px',
        width: '100%',
        backgroundColor: '#f8f9fa'
      }}>
        <div 
          key={mapKey}
          ref={mapContainerRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            backgroundColor: '#f8f9fa',
            zIndex: 1,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'block',
            minHeight: '350px',
            minWidth: '100%',
            visibility: 'visible',
            opacity: 1
          }} 
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
            color: '#6b7280',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 1000
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
            <div>Looking for shops with your products...</div>
          </div>
        )}
      </div>

      {/* Shops List */}
      {showShopsList && (
        <div style={{ borderTop: '1px solid #e5e7eb', maxHeight: '300px', overflow: 'auto' }}>
          {shops.length > 0 ? (
            <div style={{ padding: '0.5rem' }}>
              {getSortedShops().map((shop, index) => (
                <div key={shop._id || index} style={{
                  padding: '0.75rem',
                  margin: '0.5rem 0',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}>
                  <h5 style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>{shop.name}</h5>
                  <p style={{ margin: '0 0 2px 0', fontSize: '0.8rem', color: '#6b7280' }}>
                    📍 {shop.address || 'Address not available'}
                  </p>
                  <p style={{ margin: '0', fontSize: '0.8rem', color: '#6b7280' }}>
                    📦 {shop.productCount || 0} items available
                  </p>
                  {currentUserLocation && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#059669' }}>
                      🚗 {calculateDistance(currentUserLocation.lat, currentUserLocation.lng, shop.lat, shop.lng).toFixed(2)} km away
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏪</div>
              <p>No shops found with selected parts</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductMap;