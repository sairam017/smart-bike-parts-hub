import React, { useState, useEffect } from 'react';
import { formatINR } from '../../utils/currency';
import { Link, useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';
import RouteSuggestion from './RouteSuggestion';
import CartMap from './CartMap_new';

const CartPage = () => {
  // All hooks at top-level (no conditional returns before they are called)
  const cartCtx = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Safe fallbacks if provider not yet mounted
  const cart = cartCtx?.cart || { items: [] };
  const dispatch = cartCtx?.dispatch || (()=>{});
  // Removed unused totalItems and totalPrice (not displayed here)

  const removeItem = (id) => dispatch({ type: 'REMOVE_FROM_CART', payload: { id } });
  const clear = () => dispatch({ type: 'CLEAR_CART' });

  // Removed complex recommendation logic (replaced by route suggestion component that includes related recos)

  const checkout = () => {
    if (!user) return navigate('/auth');
    navigate('/shipping');
  };

  const total = cart.items.reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0);

  // New state for batch order placement
  const [phone, setPhone] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [placing, setPlacing] = useState(false);
  const [orderMsg, setOrderMsg] = useState(null);

  // State for shop data and map functionality
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);

  // Effect to fetch shops when cart items change
  useEffect(() => {
    const productIds = cart.items.map(item => item.id);
    fetchShopsWithProducts(productIds);
  }, [cart.items]); // Dependency on cart items

  const validatePhone = (p) => /^\d{10}$/.test(p); // simple 10 digit validation
  const isFutureOrToday = (dStr) => {
    if (!dStr) return false;
    const sel = new Date(dStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    return sel >= today;
  };

  // Function to fetch shops that have cart items in stock
  const fetchShopsWithProducts = async (productIds) => {
    if (!productIds || productIds.length === 0) {
      setShops([]);
      return;
    }

    try {
      setLoadingShops(true);
      const response = await api.get('/shops/with-products', {
        params: {
          productIds: productIds.join(',')
        }
      });
      
      // Transform shop data to match CartMap expectations
      const shopsData = response.data.shops.map(shop => ({
        _id: shop._id,
        name: shop.name,
        address: shop.address,
        phone: shop.phone,
        lat: shop.location?.coordinates?.[1], // MongoDB stores [lng, lat] format
        lng: shop.location?.coordinates?.[0],
        productCount: shop.products?.length || 0,
        products: shop.products || []
      })).filter(shop => shop.lat && shop.lng); // Only include shops with valid coordinates

      setShops(shopsData);
    } catch (error) {
      console.error('Error fetching shops:', error);
      setShops([]);
    } finally {
      setLoadingShops(false);
    }
  };

  const placeAll = async () => {
    if (!user) { navigate('/auth'); return; }
    setOrderMsg(null);
    if (!cart.items.length) { setOrderMsg('Cart empty'); return; }
    if (!validatePhone(phone)) { setOrderMsg('Enter valid 10 digit phone'); return; }
    if (!isFutureOrToday(collectionDate)) { setOrderMsg('Select today or a future collection date'); return; }
    try {
      setPlacing(true);
      const orderItems = cart.items.map(i => ({ name: i.name, qty: i.qty || 1, price: i.price, product: i.id }));
      const shippingAddress = { address: 'Cart order' }; // minimal placeholder (could enhance with stored preferred address or geolocation)
      const { data } = await api.post('/orders/authenticated', { orderItems, shippingAddress, paymentMethod: 'cod', phone, collectionDate });
      setOrderMsg('Order placed. ID: ' + data._id);
      // Clear cart after success
      clear();
      setTimeout(()=> navigate('/'), 800);
    } catch(e){
      setOrderMsg(e.response?.data?.message || 'Order failed');
    } finally {
      setPlacing(false);
    }
  };

  // If context not ready, show lightweight placeholder while still keeping hook order stable
  if (!cartCtx) {
    return <div style={{padding:'1rem'}}>Loading cart...</div>;
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
  <div style={{display:'flex', alignItems:'center', gap:12}}>
    <h2 style={{margin:0}}>Cart</h2>
    <button onClick={()=> navigate('/myorders')} className="btn-outline" style={{marginLeft:'auto'}}>My Orders</button>
  </div>
      {cart.items.length === 0 && <p style={{color:'#64748b'}}>Cart is empty <Link to="/">Go Back</Link></p>}
  <ul>
        {cart.items.map(i => (
          <li key={i.id} style={{ marginBottom: '.6rem', background:'#fff', padding:'10px', borderRadius:12, boxShadow:'0 6px 18px rgba(2,6,23,.08)' }}>
            {i.name} x {i.qty || 1} = {formatINR(i.price * (i.qty || 1))}
            <button onClick={() => removeItem(i.id)} style={{ marginLeft: '1rem' }}>Remove</button>
          </li>
        ))}
      </ul>
  <h3>Total: {formatINR(total)}</h3>
      <button disabled={!cart.items.length} onClick={checkout}>Proceed To Checkout</button>
      <button disabled={!cart.items.length} onClick={clear} style={{ marginLeft: '0.5rem' }}>Clear</button>

      {/* Batch place order section */}
      {!!cart.items.length && (
        <div style={{marginTop:'1.5rem', background:'#fff', padding:'1rem', borderRadius:12, boxShadow:'0 6px 18px rgba(2,6,23,.06)', display:'grid', gap:12}}>
          <h3 style={{margin:0, fontSize:'1rem'}}>Place Order For All Items</h3>
          <div style={{display:'flex', flexWrap:'wrap', gap:12}}>
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              <label style={{fontSize:12, fontWeight:600}}>Phone (10 digits)</label>
              <input value={phone} onChange={e=> setPhone(e.target.value)} placeholder="Active phone" style={{padding:'6px 10px', border:'1px solid #cbd5e1', borderRadius:8}} maxLength={10} />
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              <label style={{fontSize:12, fontWeight:600}}>Collection Date</label>
              <input type="date" value={collectionDate} onChange={e=> setCollectionDate(e.target.value)} style={{padding:'6px 10px', border:'1px solid #cbd5e1', borderRadius:8}} />
            </div>
          </div>
          <button onClick={placeAll} disabled={placing} style={{padding:'8px 14px', borderRadius:8, border:'1px solid #1d4ed8', background:'#1d4ed8', color:'#fff', fontWeight:600}}>{placing? 'Placing...' : 'Place All Items (COD)'}</button>
          {orderMsg && <div style={{fontSize:12, color: orderMsg.startsWith('Order placed') ? '#15803d' : '#b91c1c'}}>{orderMsg}</div>}
        </div>
      )}

  {/* Interactive Shop Map with Full Functionality */}
  {cart.items.length > 0 && (
    <div style={{marginTop:'1.5rem'}}>
      <h3 style={{marginBottom: '1rem'}}>🗺️ Find Shops with Your Cart Items</h3>
      <p style={{color: '#666', fontSize: '14px', marginBottom: '1rem'}}>
        Discover bike part shops near you. Click on markers to see shop details and get directions.
      </p>
      {loadingShops ? (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          background: '#f8f9fa', 
          borderRadius: '8px',
          color: '#666' 
        }}>
          Loading nearby shops with your cart items...
        </div>
      ) : shops.length > 0 ? (
        <CartMap shops={shops} />
      ) : (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          background: '#f8f9fa', 
          borderRadius: '8px',
          color: '#666' 
        }}>
          No shops found with your cart items in stock nearby.
        </div>
      )}
    </div>
  )}

  {/* Route suggestion (includes related recommendations from backend) */}
  <RouteSuggestion cartItems={cart.items.map(i => ({ part: { _id: i.id, name: i.name, type: i.type }, quantity: i.qty }))} />
    </div>
  );
};

export default CartPage;
