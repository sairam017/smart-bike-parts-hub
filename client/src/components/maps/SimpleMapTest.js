import React, { useEffect, useRef, useState } from 'react';

const SimpleMapTest = () => {
  const mapRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        // Load CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(cssLink);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          setLeafletLoaded(true);
        };
        script.onerror = () => {
          setError('Failed to load Leaflet');
        };
        document.head.appendChild(script);
      } catch (err) {
        setError(err.message);
      }
    };

    if (!window.L) {
      loadLeaflet();
    } else {
      setLeafletLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !window.L) return;

    try {
      console.log('Creating simple test map...');
      
      const map = window.L.map(mapRef.current, {
        center: [12.9716, 77.5946], // Bangalore
        zoom: 13
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add a test marker
      window.L.marker([12.9716, 77.5946]).addTo(map)
        .bindPopup('Test marker in Bangalore')
        .openPopup();

      console.log('Simple map created successfully');

      return () => {
        if (map) {
          map.remove();
        }
      };
    } catch (err) {
      setError(err.message);
      console.error('Map creation error:', err);
    }
  }, [leafletLoaded]);

  if (error) {
    return (
      <div style={{ padding: '20px', border: '1px solid red', borderRadius: '4px' }}>
        <h3>Map Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Simple Map Test</h2>
      <div 
        ref={mapRef} 
        style={{
          width: '100%',
          height: '400px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#f5f5f5'
        }}
      />
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        Leaflet Loaded: {leafletLoaded ? '✅' : '⏳'}
        {window.L && ' | L object available: ✅'}
      </div>
    </div>
  );
};

export default SimpleMapTest;