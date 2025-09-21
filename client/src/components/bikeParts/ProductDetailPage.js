import React, { useEffect, useState, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import bikePartsService from '../../services/bikePartsService';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';
import useCart from '../../hooks/useCart';
import LocationContext from '../../context/LocationContext';
import { formatINR } from '../../utils/currency';

// Simple image zoom on hover via magnifier box
function ZoomImage({ src, alt }) {
  const [zoom, setZoom] = useState({ x: 0, y: 0, show: false });
  const containerRef = useRef(null);
  const handleMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom(z => ({ ...z, x, y }));
  };
  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setZoom(z => ({ ...z, show: true }))}
      onMouseLeave={() => setZoom(z => ({ ...z, show: false }))}
      onMouseMove={handleMove}
      style={{position:'relative', width:'100%', maxWidth:420, aspectRatio:'4/3', background:'#f1f5f9', borderRadius:12, overflow:'hidden', cursor:'zoom-in'}}
    >
      {src ? <img src={src} alt={alt} style={{width:'100%', height:'100%', objectFit:'contain'}} /> : <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#94a3b8'}}>No Image</div>}
      {zoom.show && src && (
        <div style={{position:'absolute', top:0, right:'-52%', width:'50%', height:'100%', border:'1px solid #cbd5e1', background:'#fff', borderRadius:12, display:'none'}} />
      )}
      {zoom.show && src && (
        <div style={{position:'absolute', inset:0, pointerEvents:'none'}} />
      )}
    </div>
  );
}

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cartCtx = useCart();
  const cart = cartCtx?.cart || { items: [] };
  const dispatch = cartCtx?.dispatch || (() => {});
  const { location: userLoc } = useContext(LocationContext) || {};
  // Support both navigation with state and direct link
  // Always use the ID from the URL if no state is passed
  let selectedIds = [id];
  if (
    typeof window !== 'undefined' &&
    window.history.state &&
    window.history.state.usr &&
    Array.isArray(window.history.state.usr.selectedIds) &&
    window.history.state.usr.selectedIds.length > 0
  ) {
    selectedIds = window.history.state.usr.selectedIds;
  }
  const [parts, setParts] = useState([]);
  const [distanceKm, setDistanceKm] = useState([]);
  const [qtys, setQtys] = useState([]); // array of qty per part
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState({ loading:true });
  const [reviewForm, setReviewForm] = useState({ rating:5, comment:'' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  // Fetch recommendations based on product ID and user location
  useEffect(() => {
    if (!id) return;
    // Get user location (if not already available)
    function fetchRecs(loc) {
      fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partIds: [id], location: loc })
      })
      .then(res => res.json())
      .then(data => setRecommendations(data.items || []));
    }
    if (userLoc && userLoc.latitude && userLoc.longitude) {
      fetchRecs({ latitude: userLoc.latitude, longitude: userLoc.longitude });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchRecs({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => setRecommendations([])
      );
    }
  }, [id, userLoc]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(selectedIds.map(pid => bikePartsService.getPartById(pid)
      .then(r => r.data)
      .catch((err) => {
        // Set error if API fails for any product
        if (err?.response?.status === 404) {
          setError('Product not found. Please check the product ID or try again later.');
        } else {
          setError('Failed to load product details. Please try again.');
        }
        return null;
      })
    ))
      .then(results => {
        if (active) {
          const validParts = results.filter(Boolean);
          setParts(validParts.length === 1 ? [validParts[0]] : validParts);
          setQtys(validParts.map(() => 1));
          // If all failed, set error
          if (!validParts.length) {
            setError('No product found for the selected ID(s). Please check the product ID or try again later.');
          }
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedIds]);

  // Dynamic distance update when user location or part changes
  useEffect(() => {
    if (!parts.length || !userLoc) {
      setDistanceKm([]);
      return;
    }
    // Compute distances for all parts
    const distances = parts.map(part => {
      if (!part?.shop?.location?.coordinates) return null;
      const [lng, lat] = part.shop.location.coordinates;
      const toRad = v => v * Math.PI / 180;
      const R = 6371;
      const dLat = toRad(lat - userLoc.latitude);
      const dLon = toRad(lng - userLoc.longitude);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(userLoc.latitude))*Math.cos(toRad(lat))*Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return (R * c).toFixed(1);
    });
    setDistanceKm(distances);

    // K-means stub for future clustering (not used for direct distance)
    // function kMeans(points, k) {
    //   // points: [{lat, lon}], k: number of clusters
    //   // ...implement clustering logic here...
    //   return clusters;
    // }
  }, [userLoc, parts]);

  // fetch review status when product/user changes
  useEffect(() => {
    if (!user) { setReviewStatus({ canReview:false, alreadyReviewed:false, loading:false }); return; }
    if (!id) return;
    let active = true;
    setReviewStatus(s=>({...s, loading:true}));
    bikePartsService.getReviewStatus(id)
      .then(r=> active && setReviewStatus({ ...r.data, loading:false }))
      .catch(()=> active && setReviewStatus({ canReview:false, alreadyReviewed:false, loading:false }));
    return () => { active = false; };
  }, [id, user]);

  // All per-part logic is now inside the .map below

  if (loading) return <div style={{padding:'1rem'}}>Loading...</div>;
  if (error) return (
    <div style={{padding:'1rem', color:'red'}}>
      {error}<br />
      <button style={{marginTop:'1rem', padding:'8px 16px', borderRadius:8, background:'#1d4ed8', color:'#fff', border:'none', cursor:'pointer'}} onClick={()=>window.history.back()}>Go Back</button>
    </div>
  );
  if (!parts.length) return (
    <div style={{padding:'1rem', color:'red'}}>
      No product found for the selected ID(s).<br />
      <span style={{color:'#475569'}}>Please check the product ID or try again later.</span><br />
      <button style={{marginTop:'1rem', padding:'8px 16px', borderRadius:8, background:'#1d4ed8', color:'#fff', border:'none', cursor:'pointer'}} onClick={()=>window.history.back()}>Go Back</button>
    </div>
  );

  return (
    <div style={{maxWidth:1000, margin:'0 auto', padding:'1rem'}}>
      {parts.map((part, idx) => {
        const qty = qtys[idx] || 1;
        const setQtyForIdx = (v) => setQtys(qs => qs.map((q, i) => i === idx ? v : q));
        const inc = () => setQtyForIdx(Math.min(typeof part.countInStock === 'number' && part.countInStock > 0 ? part.countInStock : 99, qty + 1));
        const dec = () => setQtyForIdx(Math.max(1, qty - 1));
        const onQtyChange = (e) => {
          const v = Number(e.target.value) || 1;
          const max = typeof part.countInStock === 'number' && part.countInStock > 0 ? part.countInStock : 99;
          setQtyForIdx(Math.min(max, Math.max(1, v)));
        };
        const addToCart = () => {
          if (typeof part.countInStock === 'number') {
            if (part.countInStock <= 0) { alert('This product is out of stock.'); return; }
            const existing = cart.items.find(i => i.id === part._id);
            const existingQty = existing?.qty || 0;
            if (existingQty + qty > part.countInStock) {
              const remaining = part.countInStock - existingQty;
              alert(remaining > 0 ? `Only ${remaining} more in stock (total available ${part.countInStock}).` : 'No more stock available for this product.');
              return;
            }
          }
          dispatch({ type:'ADD_TO_CART', payload:{ id: part._id, name: part.name || part.model, price: part.price, qty } });
          navigate('/');
        };
        const openMaps = () => {
          if (!part?.shop?.location?.coordinates) { alert('Shop location not available'); return; }
          const [lng, lat] = part.shop.location.coordinates;
          const base = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat+','+lng)}`;
          const url = userLoc ? `${base}&origin=${encodeURIComponent(userLoc.latitude+','+userLoc.longitude)}` : base;
          window.open(url, '_blank');
        };
        const placeOrder = async () => {
          if (!user) { navigate('/login'); return; }
          if (typeof part.countInStock === 'number' && qty > part.countInStock) { alert(`Only ${part.countInStock} in stock. Reduce quantity.`); return; }
          const phone = window.prompt('Enter your active phone number (+country / 10 digits)');
          if (!phone) return;
          const dateStr = window.prompt('Enter collection date (YYYY-MM-DD)');
          try {
            setPlacing(true);
            const orderItems = [{ name: part.name || part.model, qty, price: part.price, product: part._id }];
            const shippingAddress = userLoc ? { lat: userLoc.latitude, lng: userLoc.longitude } : { address: 'Unknown' };
            await api.post('/orders', { orderItems, shippingAddress, paymentMethod: 'cod', phone, collectionDate: dateStr });
            navigate('/');
          } catch(e){
            console.error(e);
            alert(e.response?.data?.message || 'Order failed');
          } finally { setPlacing(false); }
        };
        // Review logic can be similarly refactored per part if needed
        const totalPrice = part.price * qty;
        return (
          <div key={part._id} style={{marginBottom:'1.2rem', border:'1px solid #e5e7eb', borderRadius:10, padding:'0.7rem', background:'#fff', maxWidth:400}}>
            <h2 style={{fontSize:'1.05rem', marginBottom:4}}>{part.name || part.model}</h2>
            <div style={{fontSize:'.9rem', marginBottom:4}}>{part.company} • {part.model} • {part.vehicleYear}</div>
            <div style={{margin:'6px 0'}}>
              {/* Show all images if available, else fallback */}
              {Array.isArray(part.images) && part.images.length > 0 ? (
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {part.images.map((img, i) => (
                    <img key={i} src={ensureAbsolute(img)} alt={part.name || part.model} style={{maxWidth:120, borderRadius:6}} />
                  ))}
                </div>
              ) : (
                <div style={{color:'#94a3b8'}}>No Image</div>
              )}
            </div>
            <div style={{fontWeight:600, color:'#1d4ed8', fontSize:'.85rem'}}>Distance: {distanceKm && distanceKm[idx] != null ? `${distanceKm[idx]} km` : 'N/A'}</div>
            <div style={{margin:'6px 0', fontSize:'.85rem'}}>{part.description}</div>
            <div style={{fontSize:'.7rem', color:'#475569'}}>Price (each): <strong>{formatINR(part.price)}</strong></div>
            {typeof part.countInStock === 'number' && <div style={{fontSize:'.6rem', color: part.countInStock>0?'#15803d':'#b91c1c'}}>Stock: {part.countInStock}</div>}
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:'.65rem'}}>Qty:</span>
              <div style={{display:'flex', alignItems:'center', border:'1px solid #cbd5e1', borderRadius:6}}>
                <button type='button' onClick={dec} style={qtyBtnStyle}>-</button>
                <input value={qty} onChange={onQtyChange} style={{width:36, textAlign:'center', fontSize:'.7rem', border:'none', outline:'none', background:'#fff'}} />
                <button type='button' onClick={inc} style={qtyBtnStyle}>+</button>
              </div>
              <div style={{marginLeft:'auto', fontSize:'.7rem'}}>Total: <strong>{formatINR(totalPrice)}</strong></div>
            </div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:6}}>
              <button onClick={addToCart} disabled={typeof part.countInStock==='number' && part.countInStock<=0} className='btn-outline' style={{...actBtn, opacity: (typeof part.countInStock==='number' && part.countInStock<=0)? .6:1, fontSize:'.7rem'}}>Add To Cart</button>
              <button onClick={openMaps} className='btn-outline' style={{...actBtn, fontSize:'.7rem'}}>Get Maps</button>
              <button disabled={placing || (typeof part.countInStock==='number' && (part.countInStock<=0 || qty>part.countInStock))} onClick={placeOrder} className='btn-primary' style={{...actBtn, opacity:(typeof part.countInStock==='number' && (part.countInStock<=0 || qty>part.countInStock))? .6:1, fontSize:'.7rem'}}>{placing? 'Placing...' : 'Place Order'}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const qtyBtnStyle = { padding:'4px 10px', background:'#fff', border:'none', cursor:'pointer', fontSize:'.85rem' };
const actBtn = { flex:'1 1 140px' };

function ensureAbsolute(url){
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return `http://localhost:5000${url}`;
}

export default ProductDetailPage;
