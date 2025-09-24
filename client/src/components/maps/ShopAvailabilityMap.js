import React, { useState, useEffect, useRef } from 'react';
import PurchaseForm from '../purchase/PurchaseForm';
import api from '../../services/api';

const ShopAvailabilityMap = ({ 
  productIds = [], 
  onShopSelect = null, 
  showAfterRecommendations = false,
  userLocation = null 
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [nearestShop, setNearestShop] = useState(null);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      console.log('Leaflet already loaded');
      setLeafletLoaded(true);
      return;
    }

    const loadCSS = (href) => {
      return new Promise((resolve) => {
        // Check if CSS is already loaded
        const existingLink = document.querySelector(`link[href="${href}"]`);
        if (existingLink) {
          resolve();
          return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => {
          console.log('CSS loaded:', href);
          resolve();
        };
        link.onerror = () => {
          console.warn('CSS failed to load:', href);
          resolve(); // Continue even if CSS fails
        };
        document.head.appendChild(link);
      });
    };

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        // Check if script is already loaded
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
          console.log('Script loaded:', src);
          resolve();
        };
        script.onerror = (e) => {
          console.error('Script failed to load:', src, e);
          reject(e);
        };
        document.head.appendChild(script);
      });
    };

    const loadLeaflet = async () => {
      try {
        console.log('Loading Leaflet CSS...');
        await loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        
        // Wait a bit for CSS to be applied
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('Loading Leaflet JS...');
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        
        // Wait longer for Leaflet to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (window.L) {
          console.log('Leaflet loaded successfully, L object available');
          // Ensure CSS is really applied by checking for Leaflet CSS classes
          const leafletCSS = document.querySelector('link[href*="leaflet.css"]');
          console.log('Leaflet CSS link found:', !!leafletCSS);
          
          setLeafletLoaded(true);
        } else {
          console.error('Leaflet script loaded but window.L is not available');
          // Retry after a longer delay
          setTimeout(() => {
            if (window.L) {
              console.log('Leaflet now available after delay');
              setLeafletLoaded(true);
            } else {
              console.error('Leaflet still not available after retry');
            }
          }, 2000);
        }
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };

    loadLeaflet();
  }, []);

  // Fetch shops with product availability
  useEffect(() => {
    if (!productIds.length) return;

    const fetchShopsWithProducts = async () => {
      setLoading(true);
      try {
        // Fetch shops that have the requested products
        const response = await api.get(`/shops/with-products?productIds=${productIds.join(',')}`);
        const shopsData = response.data.shops || [];
        
        // Add distance calculation if user location is available
        const shopsWithDistance = shopsData.map(shop => {
          let distance = null;
          if (userCoords && shop.location) {
            distance = calculateDistance(
              userCoords.lat, 
              userCoords.lng, 
              shop.location.coordinates[1], // latitude
              shop.location.coordinates[0]  // longitude
            );
          }
          return {
            ...shop,
            distance,
            lat: shop.location?.coordinates[1] || 12.9716,
            lng: shop.location?.coordinates[0] || 77.5946,
            availableProducts: shop.products?.filter(p => productIds.includes(p._id)) || []
          };
        });

        // Sort by distance if available
        if (userCoords) {
          shopsWithDistance.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
          setNearestShop(shopsWithDistance[0]);
        }

        setShops(shopsWithDistance);
      } catch (error) {
        console.error('Error fetching shops:', error);
        // Fallback to mock data for demo
        setShops([
          {
            _id: '1',
            name: 'Central Bike Parts',
            address: 'MG Road, Bangalore',
            lat: 12.9716,
            lng: 77.5946,
            phone: '+91 98765 43210',
            availableProducts: productIds.map(id => ({ _id: id, name: 'Sample Product', stock: 5 })),
            distance: userCoords ? calculateDistance(userCoords.lat, userCoords.lng, 12.9716, 77.5946) : null
          },
          {
            _id: '2', 
            name: 'Bike Zone Spares',
            address: 'Koramangala, Bangalore',
            lat: 12.9279,
            lng: 77.6271,
            phone: '+91 98765 43211',
            availableProducts: productIds.map(id => ({ _id: id, name: 'Sample Product', stock: 3 })),
            distance: userCoords ? calculateDistance(userCoords.lat, userCoords.lng, 12.9279, 77.6271) : null
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchShopsWithProducts();
  }, [productIds, userCoords]);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || map) return;

    console.log('Initializing map...', { 
      leafletLoaded, 
      mapRefExists: !!mapRef.current, 
      mapExists: !!map,
      mapRefOffsetHeight: mapRef.current?.offsetHeight,
      mapRefOffsetWidth: mapRef.current?.offsetWidth,
      windowL: !!window.L
    });

    // Wait for the container to have proper dimensions
    if (mapRef.current.offsetHeight === 0 || mapRef.current.offsetWidth === 0) {
      console.log('Map container has no dimensions, setting explicit size...');
      
      // Force container dimensions if they're zero
      mapRef.current.style.width = '100%';
      mapRef.current.style.height = '450px';
      mapRef.current.style.minHeight = '450px';
      mapRef.current.style.display = 'block';
      mapRef.current.style.position = 'relative';
      mapRef.current.style.zIndex = '1';
      
      // Wait for DOM update
      setTimeout(() => {
        if (mapRef.current && !map) {
          console.log('Retrying map initialization after setting dimensions');
          console.log('New dimensions:', {
            offsetWidth: mapRef.current.offsetWidth,
            offsetHeight: mapRef.current.offsetHeight
          });
          // Force a re-render by updating a state
          setLeafletLoaded(false);
          setTimeout(() => setLeafletLoaded(true), 200);
        }
      }, 200);
      return;
    }

    try {
      const L = window.L;
      if (!L) {
        console.error('Leaflet is not available on window.L');
        return;
      }

      const center = userCoords || nearestShop || { lat: 12.9716, lng: 77.5946 };
      
      console.log('Creating map with center:', center);
      console.log('Map container element:', mapRef.current);
      console.log('Container dimensions:', {
        offsetWidth: mapRef.current.offsetWidth,
        offsetHeight: mapRef.current.offsetHeight,
        clientWidth: mapRef.current.clientWidth,
        clientHeight: mapRef.current.clientHeight
      });
      
      // Clear any existing map
      if (mapRef.current._leaflet_id) {
        console.log('Removing existing Leaflet map');
        delete mapRef.current._leaflet_id;
      }

      const newMap = L.map(mapRef.current, {
        preferCanvas: false,
        zoomControl: true,
        scrollWheelZoom: true,
        trackResize: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        attributionControl: true,
        renderer: L.svg() // Explicitly use SVG renderer
      });

      // Set initial view first
      newMap.setView([center.lat, center.lng], 12);
      
      console.log('Map created, adding tile layer...');
      
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        opacity: 1,
        crossOrigin: true,
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 2
      });
      
      // Add tile layer and wait for it to load
      tileLayer.addTo(newMap);

      // Wait for tiles to load and force multiple renders
      let tilesLoaded = false;
      
      tileLayer.on('load', () => {
        console.log('Tiles loaded successfully');
        tilesLoaded = true;
      });

      tileLayer.on('tileerror', (error) => {
        console.warn('Some tiles failed to load:', error);
      });

      // Multiple aggressive render attempts
      const forceRender = (attempt = 1) => {
        if (newMap && newMap.getContainer()) {
          console.log(`Force render attempt ${attempt}`);
          newMap.invalidateSize(true);
          newMap.panTo([center.lat, center.lng]);
          
          // Check if map is actually visible
          const container = newMap.getContainer();
          const containerRect = container.getBoundingClientRect();
          console.log('Map container rect:', {
            width: containerRect.width,
            height: containerRect.height,
            top: containerRect.top,
            left: containerRect.left
          });
        }
      };

      // Immediate render
      forceRender(1);
      
      // Progressive render attempts
      setTimeout(() => forceRender(2), 100);
      setTimeout(() => forceRender(3), 300);
      setTimeout(() => forceRender(4), 600);
      setTimeout(() => forceRender(5), 1000);
      setTimeout(() => forceRender(6), 2000);

      // Add click handler for map interaction
      newMap.on('click', function(e) {
        console.log('Map clicked at:', e.latlng);
        // Calculate distance to all shops and show nearest
        if (shops.length > 0) {
          const distances = shops.map(shop => ({
            shop,
            distance: calculateDistance(e.latlng.lat, e.latlng.lng, shop.lat, shop.lng)
          }));
          
          const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
          const userDistance = userCoords ? 
            calculateDistance(userCoords.lat, userCoords.lng, nearest.shop.lat, nearest.shop.lng) : null;
          
          L.popup()
            .setLatLng(e.latlng)
            .setContent(`
              <div style="text-align: center; min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #333;">📍 Selected Location</h4>
                <div style="margin-bottom: 12px;">
                  <strong>Nearest Shop:</strong><br/>
                  <span style="color: #2563eb; font-weight: bold;">${nearest.shop.name}</span>
                </div>
                <div style="margin-bottom: 12px;">
                  <strong>Distance from here:</strong><br/>
                  <span style="color: #dc2626; font-weight: bold;">${nearest.distance.toFixed(2)} km</span>
                </div>
                ${userDistance ? `
                  <div style="margin-bottom: 12px;">
                    <strong>From your location:</strong><br/>
                    <span style="color: #059669; font-weight: bold;">${userDistance.toFixed(2)} km</span>
                  </div>
                ` : ''}
                <div style="margin-bottom: 12px;">
                  <strong>Available parts:</strong> ${nearest.shop.availableProducts?.length || 0}
                </div>
                <button 
                  onclick="window.showDirections('${nearest.shop._id}', ${nearest.shop.lat}, ${nearest.shop.lng})"
                  style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 4px; font-size: 12px;"
                >
                  🧭 Get Directions
                </button>
                <button 
                  onclick="window.selectShop('${nearest.shop._id}')"
                  style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 4px; font-size: 12px;"
                >
                  🛒 Select Shop
                </button>
              </div>
            `)
            .openOn(newMap);
        }
      });

      // Add map ready event
      newMap.whenReady(() => {
        console.log('Map is ready and rendered');
        newMap.invalidateSize(true);
      });

      console.log('Map initialized successfully');
      setMap(newMap);
      setMapError(null);
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError(error.message);
    }
  }, [leafletLoaded, userCoords, nearestShop]);

  // Add markers when shops or map changes
  useEffect(() => {
    if (!map || !shops.length) return;

    const L = window.L;
    if (!L) return;

    // Clear existing markers
    map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add user location marker
    if (userCoords) {
      const userMarker = L.marker([userCoords.lat, userCoords.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map);
      
      userMarker.bindPopup('<div style="text-align: center;"><strong>📍 Your Location</strong></div>');
      
      // Draw line to nearest shop if available
      if (nearestShop) {
        const polyline = L.polyline([
          [userCoords.lat, userCoords.lng],
          [nearestShop.lat, nearestShop.lng]
        ], {
          color: '#dc2626',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(map);
        
        // Add distance label at midpoint
        const midLat = (userCoords.lat + nearestShop.lat) / 2;
        const midLng = (userCoords.lng + nearestShop.lng) / 2;
        
        const distanceMarker = L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: `<div style="
              background: #dc2626; 
              color: white; 
              padding: 4px 8px; 
              border-radius: 12px; 
              font-size: 12px; 
              font-weight: bold;
              white-space: nowrap;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">🚗 ${nearestShop.distance?.toFixed(1)} km</div>`,
            className: 'distance-label',
            iconSize: [60, 20],
            iconAnchor: [30, 10]
          })
        }).addTo(map);
      }
    }

    // Add shop markers
    shops.forEach(shop => {
      const isNearest = nearestShop && shop._id === nearestShop._id;
      const isSelected = selectedShop && shop._id === selectedShop._id;
      
      // Use proper Leaflet markers with different colors
      const iconColor = isSelected ? 'red' : isNearest ? 'orange' : 'blue';
      const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${iconColor}.png`;
      
      const marker = L.marker([shop.lat, shop.lng], {
        icon: L.icon({
          iconUrl: iconUrl,
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map);

      const popupContent = `
        <div style="min-width: 280px; text-align: center;">
          <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">${shop.name}</h4>
          
          ${isNearest ? '<div style="background: #f97316; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; margin-bottom: 8px; display: inline-block;">🎯 NEAREST SHOP</div>' : ''}
          
          <div style="color: #64748b; font-size: 13px; margin-bottom: 12px; text-align: left;">
            📍 ${shop.address}<br/>
            📞 ${shop.phone || 'Not available'}<br/>
            ⭐ ${shop.rating || 'N/A'}/5
          </div>
          
          ${shop.distance ? `<div style="background: #dc2626; color: white; padding: 6px 12px; border-radius: 8px; font-weight: bold; margin-bottom: 12px;">📍 Distance: ${shop.distance.toFixed(1)} km away</div>` : ''}
          
          <div style="margin-bottom: 12px; text-align: left;">
            <strong style="color: #059669; font-size: 14px;">📦 Parts Available (${shop.availableProducts?.length || 0}):</strong><br/>
            <div style="max-height: 100px; overflow-y: auto; margin-top: 8px; padding: 8px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0;">
              ${shop.availableProducts?.length > 0 ? 
                shop.availableProducts.slice(0, 5).map(product => 
                  `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
                    <span>• ${product.name || 'Unknown part'}</span>
                    <span style="color: #059669; font-weight: bold;">Stock: ${product.stock || 0}</span>
                  </div>`
                ).join('') + 
                (shop.availableProducts.length > 5 ? `<div style="color: #6b7280; font-style: italic; font-size: 11px;">+${shop.availableProducts.length - 5} more parts...</div>` : '')
                : '<div style="color: #6b7280; font-style: italic; font-size: 12px;">No matching parts in stock</div>'
              }
            </div>
          </div>
          
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px;">
            <button 
              onclick="window.showDirections('${shop._id}', ${shop.lat}, ${shop.lng})"
              style="background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; flex: 1;"
            >
              🧭 Directions
            </button>
            <button 
              onclick="window.selectShop('${shop._id}')" 
              style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; flex: 1;"
            >
              🛒 Select & Order
            </button>
          </div>
          
          ${shop.availableProducts?.length > 0 ? 
            `<div style="margin-top: 8px;">
              <button 
                onclick="alert('Quick order feature coming soon! Use Select & Order for now.')"
                style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; width: 100%;"
              >
                ⚡ Quick Order All Available
              </button>
            </div>` : ''
          }
        </div>
      `;
      
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      
      // Enhanced click/touch handling
      marker.on('click', (e) => {
        console.log('Shop marker clicked:', shop.name);
        setSelectedShop(shop);
        
        // Add visual feedback
        marker.setIcon(L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        }));
      });

      // Add hover effects for better UX
      marker.on('mouseover', (e) => {
        marker.openPopup();
      });

      // Touch support for mobile devices
      marker.on('touchstart', (e) => {
        e.originalEvent.preventDefault();
        console.log('Shop marker touched:', shop.name);
        setSelectedShop(shop);
      });
    });

    // Global function for popup button clicks
    window.selectShop = (shopId) => {
      const shop = shops.find(s => s._id === shopId);
      if (shop) {
        setSelectedShop(shop);
        if (onShopSelect) {
          onShopSelect(shop);
        }
        console.log('Selected shop:', shop.name);
      }
    };

    // Add directions functionality
    window.showDirections = (shopId, shopLat, shopLng) => {
      const shop = shops.find(s => s._id === shopId);
      if (!shop) return;

      if (userCoords) {
        // If we have user location, show route
        const distance = calculateDistance(userCoords.lat, userCoords.lng, shopLat, shopLng);
        const routeUrl = `https://www.google.com/maps/dir/${userCoords.lat},${userCoords.lng}/${shopLat},${shopLng}`;
        
        // Show route on map if possible
        if (map && window.L) {
          const L = window.L;
          
          // Remove existing route lines
          map.eachLayer(layer => {
            if (layer instanceof L.Polyline && layer.options.className === 'route-line') {
              map.removeLayer(layer);
            }
          });
          
          // Add route line
          const routeLine = L.polyline([
            [userCoords.lat, userCoords.lng],
            [shopLat, shopLng]
          ], {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            className: 'route-line',
            dashArray: '10, 10'
          }).addTo(map);
          
          // Add distance label at midpoint
          const midLat = (userCoords.lat + shopLat) / 2;
          const midLng = (userCoords.lng + shopLng) / 2;
          
          L.marker([midLat, midLng], {
            icon: L.divIcon({
              className: 'route-distance-label',
              html: `<div style="background: #10b981; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; white-space: nowrap;">🚗 ${distance.toFixed(1)} km</div>`,
              iconSize: [60, 20],
              iconAnchor: [30, 10]
            })
          }).addTo(map);
          
          // Fit map to show the route
          const bounds = L.latLngBounds([
            [userCoords.lat, userCoords.lng],
            [shopLat, shopLng]
          ]);
          map.fitBounds(bounds, { padding: [20, 20] });
        }
        
        // Confirm opening external directions
        if (window.confirm(`Open turn-by-turn directions to ${shop.name} (${distance.toFixed(1)} km away) in Google Maps?`)) {
          window.open(routeUrl, '_blank');
        }
      } else {
        // No user location, just open shop location
        const shopUrl = `https://www.google.com/maps/search/?api=1&query=${shopLat},${shopLng}`;
        if (window.confirm(`Open ${shop.name} location in Google Maps?`)) {
          window.open(shopUrl, '_blank');
        }
      }
    };

    // Fit map to show all markers
    if (shops.length > 0) {
      const group = L.featureGroup(
        shops.map(shop => L.marker([shop.lat, shop.lng]))
          .concat(userCoords ? [L.marker([userCoords.lat, userCoords.lng])] : [])
      );
      map.fitBounds(group.getBounds().pad(0.1));
    }

  }, [map, shops, selectedShop, nearestShop, userCoords, onShopSelect]);

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

  // Get user location
  const getCurrentLocation = () => {
    const L = window.L;
    if (!L || !navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setUserCoords(coords);
        console.log('User location obtained:', coords);
        
        if (map) {
          map.setView([coords.lat, coords.lng], 13);
          
          // Show success popup
          L.popup()
            .setLatLng([coords.lat, coords.lng])
            .setContent(`
              <div style="text-align: center;">
                <strong>📍 Location Found!</strong><br/>
                <small>Calculating distances to shops...</small>
              </div>
            `)
            .openOn(map);
        }
      },
      (err) => {
        console.error('Location access error:', err);
        let message = 'Unable to get your location. ';
        switch(err.code) {
          case err.PERMISSION_DENIED:
            message += 'Please allow location access and try again.';
            break;
          case err.POSITION_UNAVAILABLE:
            message += 'Location information is unavailable.';
            break;
          case err.TIMEOUT:
            message += 'Location request timed out.';
            break;
          default:
            message += 'An unknown error occurred.';
            break;
        }
        alert(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  // Purchase flow
  const handlePurchase = () => {
    if (selectedShop && selectedShop.availableProducts?.length > 0) {
      setShowPurchaseForm(true);
    }
  };

  const handlePurchaseCancel = () => {
    setShowPurchaseForm(false);
  };

  const handlePurchaseSuccess = (orderResult) => {
    setShowPurchaseForm(false);
    // Optional: Call parent callback if needed
    if (onShopSelect) {
      onShopSelect(selectedShop, 'purchase_completed', orderResult);
    }
  };

  const retryMapLoad = () => {
    setMapError(null);
    setMap(null);
    setLeafletLoaded(false);
    
    // Force reload Leaflet
    const existingScript = document.querySelector('script[src*="leaflet"]');
    const existingCSS = document.querySelector('link[href*="leaflet"]');
    
    if (existingScript) existingScript.remove();
    if (existingCSS) existingCSS.remove();
    
    // Clear window.L
    if (window.L) {
      delete window.L;
    }
    
    // Trigger reload
    setTimeout(() => {
      setLeafletLoaded(false);
    }, 100);
  };

  if (!leafletLoaded) {
    return (
      <div style={{padding: '2rem', textAlign: 'center'}}>
        <div>🗺️ Loading map components...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{padding: '2rem', textAlign: 'center'}}>
        <div>🔍 Finding shops with your products...</div>
      </div>
    );
  }

  return (
    <div style={{background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden'}}>
      {/* Header */}
      <div style={{padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'}}>
        <h3 style={{margin: 0, fontSize: '1.2rem'}}>🏪 Shop Locations & Availability</h3>
        <p style={{margin: '4px 0 0', fontSize: '0.9rem', opacity: 0.9}}>
          {shops.length} shops found with your requested items
        </p>
      </div>

      {/* Controls */}
      <div style={{padding: '1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}>
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
          <button
            onClick={getCurrentLocation}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            📍 Use My Location
          </button>
          
          {nearestShop && (
            <div style={{fontSize: '0.9rem', color: '#059669', fontWeight: '500'}}>
              🎯 Nearest: {nearestShop.name} ({nearestShop.distance?.toFixed(2)} km)
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{
        height: '450px', 
        position: 'relative', 
        overflow: 'hidden', 
        border: '2px solid #e2e8f0', 
        borderRadius: '8px',
        backgroundColor: '#f8fafc'
      }}>
        <div 
          ref={mapRef} 
          id="map-container"
          style={{
            width: '100%', 
            height: '100%',
            minHeight: '450px',
            position: 'relative',
            zIndex: 1,
            background: '#f0f0f0'
          }} 
        />
        
        {/* Debug info */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          zIndex: 1000,
          fontFamily: 'monospace'
        }}>
          L: {window.L ? '✓' : '✗'} | Loaded: {leafletLoaded ? '✓' : '✗'} | Map: {map ? '✓' : '✗'} | Shops: {shops.length}
        </div>

        {/* Tap instruction */}
        {map && shops.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(16, 185, 129, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            zIndex: 1000,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            👆 Tap anywhere on map to find nearest shop
          </div>
        )}
        {!map && leafletLoaded && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#64748b',
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🗺️</div>
            <div>Initializing interactive map...</div>
            <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.7 }}>
              Loading tiles and shop locations
            </div>
          </div>
        )}
        {!leafletLoaded && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#64748b',
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
            <div>Loading map library...</div>
          </div>
        )}
        
        {mapError && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#dc2626',
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.95)',
            padding: '20px',
            borderRadius: '8px',
            border: '2px solid #fecaca'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>❌</div>
            <div style={{ marginBottom: '10px' }}>Map failed to load</div>
            <div style={{ fontSize: '12px', marginBottom: '15px', opacity: 0.7 }}>
              {mapError}
            </div>
            <button
              onClick={retryMapLoad}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔄 Retry Loading Map
            </button>
          </div>
        )}
      </div>

      {/* Selected Shop Info */}
      {selectedShop && (
        <div style={{padding: '1rem', background: '#f0f9ff', borderTop: '1px solid #e2e8f0'}}>
          <h4 style={{margin: '0 0 8px 0', color: '#1e293b'}}>✅ Selected Shop: {selectedShop.name}</h4>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem'}}>
            <div>
              <p style={{margin: '0 0 4px 0', fontSize: '0.9rem', color: '#64748b'}}>
                📍 {selectedShop.address}
              </p>
              {selectedShop.phone && (
                <p style={{margin: '0 0 4px 0', fontSize: '0.9rem', color: '#64748b'}}>
                  📞 {selectedShop.phone}
                </p>
              )}
              {selectedShop.distance && (
                <p style={{margin: '0 0 8px 0', fontSize: '0.9rem', color: '#16a34a', fontWeight: '500'}}>
                  🚗 Distance: {selectedShop.distance.toFixed(2)} km
                </p>
              )}
            </div>
            
            <div>
              <strong style={{fontSize: '0.9rem', color: '#059669'}}>Available Products:</strong>
              <ul style={{margin: '4px 0 0 0', padding: '0 0 0 16px', fontSize: '0.85rem'}}>
                {selectedShop.availableProducts.map((product, index) => (
                  <li key={index} style={{marginBottom: '2px'}}>
                    {product.name} {product.stock && `(Stock: ${product.stock})`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div style={{marginTop: '1rem', display: 'flex', gap: '1rem'}}>
            <button
              onClick={handlePurchase}
              style={{
                padding: '12px 24px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              🛒 Proceed to Purchase from {selectedShop.name}
            </button>
            
            <button
              onClick={() => setSelectedShop(null)}
              style={{
                padding: '12px 16px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No shops message */}
      {!loading && shops.length === 0 && (
        <div style={{padding: '2rem', textAlign: 'center', color: '#64748b'}}>
          <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🏪</div>
          <h4 style={{margin: '0 0 8px 0'}}>No Shops Found</h4>
          <p style={{margin: 0, fontSize: '0.9rem'}}>
            No shops currently have these products in stock. Please try again later.
          </p>
        </div>
      )}

      {/* Purchase Form Modal */}
      {showPurchaseForm && selectedShop && (
        <PurchaseForm
          selectedShop={selectedShop}
          selectedProducts={selectedShop.availableProducts}
          onCancel={handlePurchaseCancel}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {/* Custom CSS for map */}
      <style jsx>{`
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .custom-popup .leaflet-popup-content {
          margin: 12px 16px;
          line-height: 1.4;
        }
        
        .leaflet-container {
          font-family: inherit;
          height: 100% !important;
          width: 100% !important;
          position: relative !important;
          background-color: #f5f5f5 !important;
        }
        
        .leaflet-map-pane {
          position: relative !important;
        }
        
        .leaflet-tile-pane {
          position: relative !important;
        }
        
        .leaflet-tile {
          position: relative !important;
          display: block !important;
        }
        
        .leaflet-control-container {
          font-family: inherit;
        }
        
        .leaflet-popup-content button {
          transition: all 0.2s ease;
        }
        
        .leaflet-popup-content button:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        
        .leaflet-marker-icon {
          transition: all 0.2s ease;
        }
        
        .leaflet-marker-icon:hover {
          transform: scale(1.1);
        }
        
        .distance-label {
          font-family: inherit;
        }
        
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
        
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
        }
        
        @media (max-width: 768px) {
          .leaflet-popup-content {
            font-size: 14px;
          }
          
          .leaflet-popup-content button {
            padding: 8px 12px !important;
            font-size: 12px !important;
          }
          
          .leaflet-control-zoom {
            margin-right: 5px !important;
            margin-top: 5px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ShopAvailabilityMap;