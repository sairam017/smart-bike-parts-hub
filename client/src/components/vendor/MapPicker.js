import React, { useMemo } from 'react';
import { GoogleMap, Marker, Circle, useLoadScript } from '@react-google-maps/api';

const containerStyle = { width: '100%', height: '300px', borderRadius: 8, border: '2px solid #1d4ed8' };

/**
 * MapPicker component
 * Props:
 *  - lat, lng: current coordinates (number or string)
 *  - onChange({ latitude, longitude, source }): callback when user selects/drags
 *  - accuracy: (meters) optional; draws a semi-transparent circle if provided
 *  - zoom: override zoom
 *  - draggableMarker: boolean (default true)
 */
function MapPicker({ lat, lng, onChange, accuracy, zoom, draggableMarker = true }) {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey || '' });

  const center = useMemo(() => {
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) return { lat: parseFloat(lat), lng: parseFloat(lng) };
    return { lat: 20.5937, lng: 78.9629 }; // India center fallback
  }, [lat, lng]);

  if (!apiKey) {
    return <div style={{ padding: '0.5rem', color: '#1d4ed8' }}>Set REACT_APP_GOOGLE_MAPS_API_KEY in client/.env to enable the map.</div>;
  }
  if (loadError) return <div style={{ color: 'red' }}>Failed to load map</div>;
  if (!isLoaded) return <div>Loading map...</div>;

  const numericLat = lat != null ? parseFloat(lat) : null;
  const numericLng = lng != null ? parseFloat(lng) : null;
  const hasPoint = numericLat != null && !isNaN(numericLat) && numericLng != null && !isNaN(numericLng);

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom || (hasPoint ? 15 : 5)}
      onClick={(e) => {
        const clicked = e.latLng;
        if (!clicked) return;
        const newLat = clicked.lat();
        const newLng = clicked.lng();
        onChange && onChange({ latitude: newLat, longitude: newLng, source: 'map-click' });
      }}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
    >
      {hasPoint && (
        <>
          <Marker
            position={{ lat: numericLat, lng: numericLng }}
            draggable={draggableMarker}
            onDragEnd={(e) => {
              const newLat = e.latLng?.lat();
              const newLng = e.latLng?.lng();
              if (newLat != null && newLng != null) {
                onChange && onChange({ latitude: newLat, longitude: newLng, source: 'marker-drag' });
              }
            }}
          />
          {accuracy != null && accuracy > 0 && accuracy < 100000 && (
            <Circle
              center={{ lat: numericLat, lng: numericLng }}
              radius={accuracy}
              options={{
                strokeColor: '#1d4ed8',
                strokeOpacity: 0.6,
                strokeWeight: 1,
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                clickable: false,
                draggable: false,
                editable: false
              }}
            />
          )}
        </>
      )}
    </GoogleMap>
  );
}

export default MapPicker;
