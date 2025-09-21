import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import localRoutePlanService from '../../services/localRoutePlanService';
import LocationContext from '../../context/LocationContext';

// Expects props: cartItems [{ part: {_id, name, type}, quantity, ... }], userLocation {lat,lon}
export default function RouteSuggestion({ cartItems, userLocation }) {
  const { location: ctxLocation, error: ctxLocError, setManualLocation, refresh } = useContext(LocationContext) || {};
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [manualLoc, setManualLoc] = useState(userLocation || null); // fallback geolocation (single fetch)
  const [manualLat, setManualLat] = useState(''); // manual input fields
  const [manualLon, setManualLon] = useState('');
  const triggeredRef = useRef(null); // track last partIds+origin signature
  const activeLoc = useMemo(() => {
    if (ctxLocation && typeof ctxLocation.latitude === 'number' && typeof ctxLocation.longitude === 'number') {
      return { lat: ctxLocation.latitude, lon: ctxLocation.longitude };
    }
    if (manualLoc && manualLoc.lat && manualLoc.lon) return manualLoc;
    return null;
  }, [ctxLocation, manualLoc]);

  const partIds = [...new Set(cartItems.map(ci => ci.part?._id).filter(Boolean))];

  const computeRoute = async (force=false) => {
    if(!partIds.length) { setError('No parts in cart'); return; }
    if(!activeLoc) return; // wait for location
    const sig = partIds.sort().join(',') + '|' + activeLoc.lat + ',' + activeLoc.lon;
    if(!force && triggeredRef.current === sig) return; // avoid duplicate calls
    triggeredRef.current = sig;
    setLoading(true); setError('');
    try {
      const payload = { partIds, origin: { ...activeLoc, accuracy: ctxLocation?.accuracy } };
      const { data } = await localRoutePlanService.computeLocalRoute(payload);
      setResult(data);
    } catch(e){
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  };

  // Auto-compute when location and cart are ready
  useEffect(() => { computeRoute(false); }, [activeLoc?.lat, activeLoc?.lon, partIds.length, computeRoute]);

  // Fallback manual geolocation trigger if context not providing
  const requestBrowserLocation = () => {
    if(!navigator.geolocation) { setError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setManualLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => setError(err.message || 'Geolocation denied'),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  return (
    <div className="mt-4 border rounded p-3 bg-white shadow-sm">
  <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Pickup Route Suggestion</h3>
  <div className="flex items-center gap-2">
    <button onClick={()=> computeRoute(true)} disabled={loading || !activeLoc} className="px-3 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50">{loading? 'Computing...' : (result? 'Refresh' : 'Generate')}</button>
    {!activeLoc && (
      <button type="button" onClick={requestBrowserLocation} className="px-2 py-1 text-[10px] border rounded">Use My Location</button>
    )}
  </div>
      </div>
  {!activeLoc && !ctxLocError && <div className="text-[10px] text-gray-500 mt-1">Waiting for location…</div>}
  {ctxLocError && <div className="text-[10px] text-orange-600 mt-1">{ctxLocError}</div>}
  {activeLoc && <div className="text-[10px] text-gray-500 mt-1">Using: {activeLoc.lat.toFixed(4)}, {activeLoc.lon.toFixed(4)} {ctxLocation?.accuracy ? `(±${Math.round(ctxLocation.accuracy)}m)` : ''} {ctxLocation?.manual && '(manual)'}</div>}
  {!activeLoc && (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex gap-1">
        <input value={manualLat} onChange={e=> setManualLat(e.target.value)} placeholder="Latitude" className="border px-2 py-1 rounded text-[10px] w-24" />
        <input value={manualLon} onChange={e=> setManualLon(e.target.value)} placeholder="Longitude" className="border px-2 py-1 rounded text-[10px] w-24" />
        <button type="button" onClick={()=> { const la=parseFloat(manualLat); const lo=parseFloat(manualLon); if(!isNaN(la)&&!isNaN(lo)){ setManualLocation(la,lo); computeRoute(true);} else { setError('Enter valid coordinates'); } }} className="px-2 py-1 text-[10px] bg-green-600 text-white rounded">Set</button>
      </div>
      <button type="button" onClick={refresh} className="text-[10px] underline self-start">Retry GPS</button>
    </div>
  )}
      {error && <div className="text-red-600 text-xs mt-2">{error}</div>}
      {result && (
        <div className="mt-3 space-y-3">
          {result.sequence.length === 0 && <div className="text-xs">No matching shops. Unavailable items: {result.uncoveredParts.join(', ') || 'All'}</div>}
          {result.nearestShop && (
            <div className="border p-2 rounded text-[10px] bg-blue-50">
              Nearest shop: {result.nearestShop.name} ({result.nearestShop.distanceKm.toFixed(2)} km) covering {result.nearestShop.partsCoveredCount} part(s)
            </div>
          )}
          {result.originNormalized && (
            <div className="text-[10px] text-gray-500 -mt-2">
              Origin used: {result.originNormalized.lat.toFixed(4)}, {result.originNormalized.lon.toFixed(4)} {result.originNormalized.swapped && '(auto-corrected)'}
            </div>
          )}
          {result.sequence.map((stop, idx) => (
            <div key={stop.shopId} className="border p-2 rounded text-xs">
              <div className="font-medium">Stop {idx+1}: {stop.name}</div>
              <div>Direct distance from you: {stop.distanceFromOriginKm?.toFixed(2)} km</div>
              <div>Distance from previous stop: {stop.distanceFromPrevKm.toFixed(2)} km</div>
              <div>Cumulative route: {stop.cumulativeKm.toFixed(2)} km</div>
              <div>Parts picked here: {stop.partsPicked.length ? stop.partsPicked.length : 0}</div>
              {idx === 0 && result.originNormalized && (
                <a className="text-[10px] text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&origin=${result.originNormalized.lat},${result.originNormalized.lon}&destination=${stop.lat},${stop.lon}`}>Verify on Map</a>
              )}
            </div>
          ))}
          {result.recommendations?.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold">Related Suggestions:</div>
              <ul className="list-disc ml-4">
                {result.recommendations.map(r => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
          <div className="text-xs font-semibold">Total distance: {result.totalDistanceKm.toFixed(2)} km</div>
          {result.uncoveredParts?.length > 0 && (
            <div className="text-xs text-orange-600">Uncovered: {result.uncoveredParts.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
}
