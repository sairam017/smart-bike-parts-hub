import React, { useState } from 'react';
import InteractiveMap from './InteractiveMap';
import mapsService from '../../services/mapsService';

const MapTest = () => {
  const [testShops] = useState([
    {
      id: 'test1',
      name: 'Test Shop 1',
      address: '123 Test Street',
      lat: 12.9716,
      lng: 77.5946,
      products: [],
      distance: 2.5
    },
    {
      id: 'test2', 
      name: 'Test Shop 2',
      address: '456 Demo Avenue',
      lat: 12.9556,
      lng: 77.6211,
      products: [],
      distance: 4.1
    }
  ]);

  const [userLocation] = useState({
    lat: 12.9716,
    lng: 77.5946
  });

  const mapCenter = mapsService.getMapCenter(testShops, userLocation);

  return (
    <div style={{padding: '1rem'}}>
      <h2>Map Integration Test</h2>
      <div style={{height: '400px', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden'}}>
        <InteractiveMap
          shops={testShops}
          userLocation={userLocation}
          selectedShops={[]}
          onShopSelect={(shop, selected) => console.log('Shop selected:', shop.name, selected)}
          showRouting={false}
          center={mapCenter}
          zoom={12}
          height="100%"
        />
      </div>
    </div>
  );
};

export default MapTest;