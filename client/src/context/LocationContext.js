import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
    const [location, setLocation] = useState(null); // {latitude, longitude, accuracy, ts}
    const [error, setError] = useState(null);
    const watchId = useRef(null);
    const manualOverride = useRef(null); // {latitude, longitude}

    const applyPosition = (position) => {
        if (manualOverride.current) return; // don't overwrite manual
        
        // Log accuracy for debugging distance issues
        if (process.env.NODE_ENV === 'development') {
            console.log('Location update:', {
                latitude: position.coords.latitude?.toFixed(6),
                longitude: position.coords.longitude?.toFixed(6),
                accuracy: position.coords.accuracy,
                accuracyWarning: position.coords.accuracy > 100 ? 'Low accuracy location' : 'Good accuracy'
            });
        }
        
        setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            ts: Date.now()
        });
        // Persist for quick reload usage (coarse)
        localStorage.setItem('lastUserLocation', JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            ts: Date.now()
        }));
    };

    const startWatch = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported');
            return;
        }
        try {
            // Clear existing
            if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
            watchId.current = navigator.geolocation.watchPosition(
                applyPosition,
                (err) => {
                    setError(err.message || 'Unable to retrieve your location');
                },
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
            );
        } catch (e) {
            setError(e.message);
        }
    }, []);

    const refresh = useCallback(() => {
        manualOverride.current = null; // allow fresh GPS
        startWatch();
    }, [startWatch]);

    const setManualLocation = (lat, lon) => {
        if (typeof lat === 'number' && typeof lon === 'number') {
            manualOverride.current = { latitude: lat, longitude: lon };
            setLocation({ latitude: lat, longitude: lon, accuracy: null, ts: Date.now(), manual: true });
        }
    };

    useEffect(() => {
        const cached = localStorage.getItem('lastUserLocation');
        if (cached && !location) {
            try { setLocation(JSON.parse(cached)); } catch {}
        }
        startWatch();
        return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <LocationContext.Provider value={{ location, error, refresh, setManualLocation }}>
            {children}
        </LocationContext.Provider>
    );
};

export default LocationContext;
