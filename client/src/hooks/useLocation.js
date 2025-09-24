import { useContext } from 'react';
import LocationContext from '../context/LocationContext';

export const useLocation = () => {
  const context = useContext(LocationContext);
  
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }

  const { location, error, refresh, setManualLocation } = context;

  // Function to get user's current location using GPS
  const getUserLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  };

  // Function to set location from manual input
  const setUserLocationFromInput = (lat, lng) => {
    return new Promise((resolve) => {
      setManualLocation(lat, lng);
      resolve({ latitude: lat, longitude: lng });
    });
  };

  return {
    location,
    error,
    refresh,
    getUserLocation,
    setUserLocationFromInput,
    setManualLocation
  };
};

export default useLocation;