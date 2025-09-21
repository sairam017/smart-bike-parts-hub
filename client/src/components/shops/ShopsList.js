import React, { useEffect, useState, useContext } from 'react';
import shopsService from '../../services/shopsService';
import LocationContext from '../../context/LocationContext';
import './shops.css';

function distanceKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const ShopsList = () => {
  const { location } = useContext(LocationContext);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(()=> {
    setLoading(true);
    const params = {};
    if(location){
      params.lat = location.latitude;
      params.lng = location.longitude;
      params.radius = 50;
    }
    shopsService.getShops(params)
      .then(res => setShops(res.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(()=> setLoading(false));
  }, [location]);

  if(loading) return <div className="shops-wrap">Loading shops...</div>;
  if(error) return <div className="shops-wrap error-text">{error}</div>;

  return (
    <div className="shops-wrap">
      <h2>Shops {location && <small className="muted">near you</small>}</h2>
      {!shops.length && <p>No shops found.</p>}
      <ul className="shops-list">
        {shops.map(s => {
          let dist = null;
          if(location && s.location?.coordinates){
            const [lng, lat] = s.location.coordinates;
            dist = distanceKm(location.latitude, location.longitude, lat, lng).toFixed(1);
          }
          return (
            <li key={s._id} className="shop-item">
              <div className="shop-title">{s.name} {dist && <span className="chip">{dist} km</span>}</div>
              <div className="shop-meta">{s.address || ''} {s.phone ? ` | ${s.phone}` : ''}</div>
              {s.location?.coordinates && (
                <a className="map-link" target="_blank" rel="noreferrer"
                   href={`https://www.google.com/maps/search/?api=1&query=${s.location.coordinates[1]},${s.location.coordinates[0]}`}>Open in Maps</a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ShopsList;
