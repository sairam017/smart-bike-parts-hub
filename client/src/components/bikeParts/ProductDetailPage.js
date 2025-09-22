import React, { useEffect, useState, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import bikePartsService from '../../services/bikePartsService';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';
import useCart from '../../hooks/useCart';
import LocationContext from '../../context/LocationContext';
import { formatINR } from '../../utils/currency';

// Enhanced Image Gallery Component
function ImageGallery({ images, productName, onImageClick }) {
  const [mainImageIndex, setMainImageIndex] = useState(0);
  
  const ensureAbsolute = (src) => {
    if (!src) return '';
    return src.startsWith('http') ? src : `http://localhost:5000${src}`;
  };

  if (!images || images.length === 0) {
    return (
      <div style={{
        width: '100%', 
        height: 300, 
        background: '#f1f5f9', 
        borderRadius: 12, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: '#94a3b8',
        fontSize: '1.1rem'
      }}>
        No Image Available
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Main large image */}
      <div 
        style={{
          width: '100%',
          height: 300,
          background: '#f1f5f9',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'zoom-in',
          border: '2px solid #e2e8f0',
          marginBottom: '0.5rem'
        }}
        onClick={() => onImageClick && onImageClick(mainImageIndex)}
      >
        <img 
          src={ensureAbsolute(images[mainImageIndex])} 
          alt={productName} 
          style={{
            width: '100%', 
            height: '100%', 
            objectFit: 'contain'
          }} 
        />
      </div>
      
      {/* Thumbnail navigation - only show if multiple images */}
      {images.length > 1 && (
        <div style={{
          display: 'flex', 
          gap: 8, 
          overflowX: 'auto',
          paddingBottom: '0.5rem'
        }}>
          {images.map((img, index) => (
            <div
              key={index}
              style={{
                minWidth: 80,
                height: 60,
                background: '#f1f5f9',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                border: index === mainImageIndex ? '2px solid #1d4ed8' : '2px solid #e2e8f0',
                transition: 'border-color 0.2s'
              }}
              onClick={() => setMainImageIndex(index)}
            >
              <img 
                src={ensureAbsolute(img)} 
                alt={`${productName} ${index + 1}`}
                style={{
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover'
                }} 
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Image counter */}
      {images.length > 1 && (
        <div style={{
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#64748b',
          marginTop: '0.25rem'
        }}>
          {mainImageIndex + 1} of {images.length}
        </div>
      )}
    </div>
  );
}

// Image Modal for full-screen viewing
function ImageModal({ images, isOpen, selectedIndex, onClose, productName }) {
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);
  
  const ensureAbsolute = (src) => {
    if (!src) return '';
    return src.startsWith('http') ? src : `http://localhost:5000${src}`;
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
  };

  React.useEffect(() => {
    setCurrentIndex(selectedIndex);
  }, [selectedIndex]);

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !images || images.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          color: 'white',
          fontSize: '1.5rem',
          padding: '0.5rem',
          borderRadius: '50%',
          cursor: 'pointer',
          width: 50,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </button>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={prevImage}
          style={{
            position: 'absolute',
            left: '1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '50%',
            cursor: 'pointer'
          }}
        >
          ‹
        </button>
      )}

      {/* Image */}
      <img
        src={ensureAbsolute(images[currentIndex])}
        alt={`${productName} ${currentIndex + 1}`}
        style={{
          maxWidth: '90%',
          maxHeight: '90%',
          objectFit: 'contain',
          borderRadius: '8px'
        }}
      />

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={nextImage}
          style={{
            position: 'absolute',
            right: '1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '50%',
            cursor: 'pointer'
          }}
        >
          ›
        </button>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '0.5rem 1rem',
          borderRadius: '1rem',
          fontSize: '0.9rem'
        }}>
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

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
  
  // Image gallery state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
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
        const totalPrice = part.price * qty;
        
        const handleImageClick = (imageIndex) => {
          setSelectedImageIndex(imageIndex);
          setIsImageModalOpen(true);
        };
        
        return (
          <div key={part._id} style={{marginBottom:'1.2rem', border:'1px solid #e5e7eb', borderRadius:10, padding:'0.7rem', background:'#fff'}}>
            <h2 style={{fontSize:'1.2rem', marginBottom:'0.5rem', color:'#1e293b'}}>{part.name || part.model}</h2>
            <div style={{fontSize:'.9rem', marginBottom:'1rem', color:'#64748b'}}>{part.company} • {part.model} • {part.vehicleYear}</div>
            
            {/* Enhanced Image Gallery */}
            <ImageGallery 
              images={part.images} 
              productName={part.name || part.model}
              onImageClick={handleImageClick}
            />
            
            <div style={{fontWeight:600, color:'#1d4ed8', fontSize:'.85rem', marginBottom:'0.5rem'}}>Distance: {distanceKm && distanceKm[idx] != null ? `${distanceKm[idx]} km` : 'N/A'}</div>
            <div style={{margin:'6px 0', fontSize:'.9rem', lineHeight:1.5}}>{part.description}</div>
            <div style={{fontSize:'.85rem', color:'#475569', marginBottom:'1rem'}}>Price (each): <strong style={{color:'#059669', fontSize:'1.1em'}}>{formatINR(part.price)}</strong></div>
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
      
      {/* Image Modal for full-screen viewing */}
      <ImageModal
        images={parts.length > 0 ? parts[0].images : []}
        isOpen={isImageModalOpen}
        selectedIndex={selectedImageIndex}
        onClose={() => setIsImageModalOpen(false)}
        productName={parts.length > 0 ? (parts[0].name || parts[0].model) : ''}
      />
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
