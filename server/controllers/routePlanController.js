const mongoose = require('mongoose');
const BikePart = require('../models/BikePart');
const Shop = require('../models/Shop');
const relatedMap = require('../utils/relatedParts');
const sendEmail = require("../utils/sendEmail");
const axios = require('axios');

function haversine(lat1, lon1, lat2, lon2){
  const R = 6371; // km
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// Greedy multi-shop cover and route ordering
function planRoute(origin, neededParts, shopInventories){
  const remaining = new Set(neededParts);
  const shopsWithNeeded = shopInventories.filter(s => s.parts.some(p => remaining.has(p)));
  // Single shop covers all
  for(const s of shopsWithNeeded){
    if(neededParts.every(p => s.parts.includes(p))){
      const dist = haversine(origin.lat, origin.lon, s.lat, s.lon);
  return { sequence:[{ shopId: s.id, name:s.name, lat: s.lat, lon: s.lon, distanceFromPrevKm: dist, distanceFromOriginKm: dist, cumulativeKm: dist, partsPicked:[...neededParts] }], totalDistanceKm: dist, uncoveredParts: [], coverageRatio: 1 };
    }
  }
  let cur = { lat: origin.lat, lon: origin.lon };
  const sequence = [];
  while(remaining.size){
    let best = null;
    let bestScore = Infinity;
    for(const s of shopsWithNeeded){
      const newParts = s.parts.filter(p => remaining.has(p));
      if(!newParts.length) continue;
      const d = haversine(cur.lat, cur.lon, s.lat, s.lon);
      const score = d / (1 + 0.8 * newParts.length); // distance normalized by coverage
      if(score < bestScore || (score === bestScore && newParts.length > (best?.newParts.length||0))){
        bestScore = score;
        best = { shop: s, newParts, d };
      }
    }
    if(!best) break; // cannot cover remaining further
    const cumulativeKm = (sequence.length? sequence[sequence.length-1].cumulativeKm : 0) + best.d;
    const originD = haversine(origin.lat, origin.lon, best.shop.lat, best.shop.lon);
  sequence.push({ shopId: best.shop.id, name: best.shop.name, lat: best.shop.lat, lon: best.shop.lon, distanceFromPrevKm: best.d, distanceFromOriginKm: originD, cumulativeKm, partsPicked: best.newParts });
    best.newParts.forEach(p => remaining.delete(p));
    cur = { lat: best.shop.lat, lon: best.shop.lon };
  }
  const totalDistanceKm = sequence.length? sequence[sequence.length-1].cumulativeKm : 0;
  const coveredCount = neededParts.length - remaining.size;
  const coverageRatio = neededParts.length ? coveredCount / neededParts.length : 0;
  return { sequence, totalDistanceKm, uncoveredParts: [...remaining], coverageRatio };
}

function recommendRelated(cartPartsMeta){
  const suggestions = new Set();
  for(const part of cartPartsMeta){
    const nameKey = (part.name||'').toLowerCase();
    const typeKey = (part.type||'').toLowerCase();
    let found = false;
    // Direct name match
    Object.keys(relatedMap).forEach(k => {
      if(nameKey.includes(k)){
        relatedMap[k].forEach(r => suggestions.add(r));
        found = true;
      }
    });
    // Type/category fallback
    if(!found && typeKey){
      const catKey = `__category_${typeKey}`;
      if(relatedMap[catKey]){
        relatedMap[catKey].forEach(r => suggestions.add(r));
      }
    }
  }
  // remove already in cart
  cartPartsMeta.forEach(p => {
    const nameLower = (p.name||'').toLowerCase();
    [...suggestions].forEach(s => { if(nameLower.includes(s)) suggestions.delete(s); });
  });
  return [...suggestions].slice(0,10);
}

// Optimize visiting order (origin -> shops) using nearest neighbor + 2-opt improvement.
function optimizeOrder(origin, shops){
  if(shops.length <= 1) return shops.map(s => s.id);
  const dist = (aLat,aLon,bLat,bLon) => haversine(aLat,aLon,bLat,bLon);
  const remaining = [...shops];
  let cur = { lat: origin.lat, lon: origin.lon };
  const order = [];
  // Nearest neighbor seed
  while(remaining.length){
    let bestIdx = 0; let bestD = Infinity;
    for(let i=0;i<remaining.length;i++){
      const s = remaining[i];
      const d = dist(cur.lat,cur.lon,s.lat,s.lon);
      if(d < bestD){ bestD = d; bestIdx = i; }
    }
    const [chosen] = remaining.splice(bestIdx,1);
    order.push(chosen);
    cur = { lat: chosen.lat, lon: chosen.lon };
  }
  // 2-opt improvement (no return to origin required)
  const route = order; // array of shop objects
  function routeDistance(rt){
    let total = dist(origin.lat,origin.lon,rt[0].lat,rt[0].lon);
    for(let i=0;i<rt.length-1;i++) total += dist(rt[i].lat,rt[i].lon,rt[i+1].lat,rt[i+1].lon);
    return total;
  }
  let improved = true; let iterations = 0; let bestDistance = routeDistance(route);
  while(improved && iterations < 20){
    improved = false; iterations++;
    for(let i=0;i<route.length-2;i++){
      for(let k=i+1;k<route.length-1;k++){
        const newRoute = route.slice();
        // reverse segment (i+1 .. k)
        const segment = newRoute.slice(i+1,k+1).reverse();
        newRoute.splice(i+1, k-i, ...segment);
        const newDist = routeDistance(newRoute);
        if(newDist + 1e-6 < bestDistance){
          bestDistance = newDist;
            for(let m=0;m<route.length;m++) route[m] = newRoute[m];
          improved = true;
        }
      }
    }
  }
  return route.map(s => s.id);
}

// Controller
exports.computeRoute = async (req, res) => {
  try {
    const { partIds, origin } = req.body; // origin {lat,lon, accuracy?}
    if(!Array.isArray(partIds) || !partIds.length) return res.status(400).json({ message: 'partIds required' });
    if(!origin || typeof origin.lat !== 'number' || typeof origin.lon !== 'number') return res.status(400).json({ message: 'origin {lat,lon} required'});

    // Origin sanity & optional swap (for India region) if env FORCE_INDIAN_REGION=1
    let normalized = { lat: origin.lat, lon: origin.lon };
    let swapped = false;
    const forceIndia = process.env.FORCE_INDIAN_REGION === '1';
    if (forceIndia) {
      const inLatRange = normalized.lat >= 5 && normalized.lat <= 37; // India approx
      const inLonRange = normalized.lon >= 65 && normalized.lon <= 100;
      if(!(inLatRange && inLonRange)) {
        // Check if swapped (lat appears to be a longitude & lon a latitude)
        const swappedLatRange = normalized.lon >= 5 && normalized.lon <= 37;
        const swappedLonRange = normalized.lat >= 65 && normalized.lat <= 100;
        if(swappedLatRange && swappedLonRange){
          normalized = { lat: origin.lon, lon: origin.lat };
          swapped = true;
        }
      }
    }
    // Basic bounds validation
    if(normalized.lat < -90 || normalized.lat > 90 || normalized.lon < -180 || normalized.lon > 180){
      return res.status(400).json({ message: 'Invalid coordinates', origin });
    }

    const debugEnabled = process.env.DEBUG_ROUTE === '1';
    if (debugEnabled) {
      console.log('[ROUTE_DEBUG] Received origin', origin, 'normalized', normalized, 'swapped', swapped, 'parts', partIds.length);
    }

    // Load part metadata and group by shop
    const parts = await BikePart.find({ _id: { $in: partIds.map(id => new mongoose.Types.ObjectId(id)) } }).populate('shop');
    // Build shop inventory structure
    const shopMap = new Map();
    for(const p of parts){
      if(!p.shop || !p.shop.location || !Array.isArray(p.shop.location.coordinates)) continue;
      // GeoJSON: coordinates = [longitude, latitude]
      const coords = p.shop.location.coordinates;
      const shopLat = typeof coords[1] === 'number' ? coords[1] : null;
      const shopLon = typeof coords[0] === 'number' ? coords[0] : null;
      if (shopLat === null || shopLon === null) {
        console.warn(`[ROUTE_DEBUG] Invalid shop coordinates for shop ${p.shop.name}:`, coords);
        continue;
      }
      const shopId = p.shop._id.toString();
      if(!shopMap.has(shopId)){
        shopMap.set(shopId, { id: shopId, name: p.shop.name, lat: shopLat, lon: shopLon, parts: [] });
      }
      shopMap.get(shopId).parts.push(p._id.toString());
    }
    const inventories = [...shopMap.values()];
    if(!inventories.length) return res.json({ sequence: [], totalDistanceKm:0, uncoveredParts: partIds, recommendations: [] });

  let plan = planRoute(normalized, partIds, inventories);
    let recommendations = recommendRelated(parts);
    // If Python ML service available, enrich recommendations
    try {
      const mlUrl = process.env.ML_ROUTE_URL; // expects /plan endpoint
      if (mlUrl) {
  const payload = { origin: normalized, parts: partIds, shops: inventories.map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, parts: s.parts })) };
        const { data } = await axios.post(mlUrl, payload, { timeout: 3000 });
        if (data?.related_suggestions?.length) {
          // Merge & prioritize Python suggestions
            const merged = new Set([ ...data.related_suggestions, ...recommendations ]);
            recommendations = [...merged].slice(0,15);
        }
        // Prefer Python ordering if coverage better or distance shorter
        if (data?.chosen_shops?.length) {
          const pythonCoverage = data.coverage_ratio;
          const localCoverage = plan.coverageRatio ?? (1 - plan.uncoveredParts.length/partIds.length);
          const pythonDistance = data.total_distance_km;
          if (pythonCoverage > localCoverage || (pythonCoverage === localCoverage && pythonDistance < plan.totalDistanceKm)) {
            plan.sequence = data.order.map((id, idx) => {
              // We don't have per-hop distances from Python; keep existing distances if same ordering subset else recompute roughly
              const shop = inventories.find(s => s.id === id);
              const prev = idx === 0 ? { lat: normalized.lat, lon: normalized.lon } : inventories.find(s => s.id === data.order[idx-1]);
              const d = shop ? haversine(prev.lat, prev.lon, shop.lat, shop.lon) : 0;
              const cumulativeKm = idx === 0 ? d : (plan.sequence[idx-1]?.cumulativeKm || 0) + d;
              return { shopId: id, name: shop?.name || id, lat: shop?.lat, lon: shop?.lon, distanceFromPrevKm: d, cumulativeKm, partsPicked: shop?.parts.filter(p => partIds.includes(p)) || [] };
            });
            plan.totalDistanceKm = pythonDistance;
            plan.coverageRatio = pythonCoverage;
          }
        }
      }
    } catch (e) {
      // Silent failover
      console.warn('ML enrichment failed:', e.message);
    }
    // Optimize order strictly over unique shops selected for coverage
  const uniqueShopObjs = [...new Map(plan.sequence.map(s => [s.shopId, inventories.find(inv => inv.id === s.shopId)])).values()].filter(Boolean);
  const optimizedOrder = optimizeOrder(normalized, uniqueShopObjs);
    // Rebuild sequence using optimized order
    const seq = [];
  let prev = { lat: normalized.lat, lon: normalized.lon };
    let cumulative = 0;
    for(const sid of optimizedOrder){
      const shop = inventories.find(s => s.id === sid);
      if(!shop) continue;
      const d = haversine(prev.lat,prev.lon,shop.lat,shop.lon);
      cumulative += d;
      // parts picked = intersection with partIds not already picked
      const already = new Set(seq.flatMap(s => s.partsPicked));
      const partsPicked = shop.parts.filter(p => partIds.includes(p) && !already.has(p));
      seq.push({ shopId: shop.id, name: shop.name, lat: shop.lat, lon: shop.lon, distanceFromPrevKm: d, cumulativeKm: cumulative, partsPicked });
      prev = { lat: shop.lat, lon: shop.lon };
    }
    // Add distanceFromOriginKm to rebuilt optimized sequence
    seq.forEach(s => {
  s.distanceFromOriginKm = haversine(normalized.lat, normalized.lon, s.lat, s.lon);
    });
    plan.sequence = seq;
    plan.totalDistanceKm = seq.length ? seq[seq.length-1].cumulativeKm : 0;
    const order = seq.map(s => s.shopId);
    const chosenShopIds = [...new Set(order)];
    // Nearest shop summary (regardless of coverage ordering) for user clarity
    let nearestShop = null;
    for (const inv of inventories) {
      const coverParts = inv.parts.filter(p => partIds.includes(p));
      if (!coverParts.length) continue;
      // Validate both origin and shop coordinates
      if (typeof normalized.lat !== 'number' || typeof normalized.lon !== 'number' || typeof inv.lat !== 'number' || typeof inv.lon !== 'number') {
        console.warn(`[ROUTE_DEBUG] Invalid coordinates for distance calculation: origin(${normalized.lat},${normalized.lon}), shop(${inv.lat},${inv.lon})`);
        continue;
      }
      const d = haversine(normalized.lat, normalized.lon, inv.lat, inv.lon);
      if (!nearestShop || d < nearestShop.distanceKm) {
        nearestShop = { shopId: inv.id, name: inv.name, distanceKm: d, partsCoveredCount: coverParts.length };
      }
      if (debugEnabled) {
        console.log(`[ROUTE_DEBUG] Distance calculation: origin(lat=${normalized.lat}, lon=${normalized.lon}) shop(lat=${inv.lat}, lon=${inv.lon}) => distanceKm=${d}`);
      }
    }
    if (debugEnabled) {
      console.log('[ROUTE_DEBUG] Sequence first hop', plan.sequence[0] ? { shop: plan.sequence[0].name, dPrev: plan.sequence[0].distanceFromPrevKm, dOrigin: plan.sequence[0].distanceFromOriginKm } : 'none');
    }
    res.json({ originOriginal: origin, originNormalized: { ...normalized, swapped }, nearestShop, ...plan, order, chosenShopIds, recommendations });
  } catch (e) {
    console.error('computeRoute failed', e);
    res.status(500).json({ message: e.message });
  }
};