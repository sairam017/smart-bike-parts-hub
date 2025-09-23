import React, { useEffect, useState, useContext } from 'react';
import shopsService from '../../services/shopsService';
import LocationContext from '../../context/LocationContext';
import { calculateDistanceToShop, formatDistance, debugDistance } from '../../utils/distanceUtils';
import './shops.css';

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
            dist = calculateDistanceToShop(location, s.location.coordinates);
            debugDistance('ShopsList', location, s.location.coordinates, dist);
          }
          return (
            <li key={s._id} className="shop-item">
              <div className="shop-title">{s.name} {dist != null && <span className="chip">{formatDistance(dist)}</span>}</div>
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
