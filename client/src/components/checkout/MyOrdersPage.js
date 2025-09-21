import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import bikePartsService from '../../services/bikePartsService';
import useAuth from '../../hooks/useAuth';

const MyOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewStatusMap, setReviewStatusMap] = useState({}); // productId -> {canReview, alreadyReviewed, loading}
  const [submitting, setSubmitting] = useState({}); // productId -> bool
  const [messages, setMessages] = useState({}); // productId -> msg
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    api.get('/orders/my/list')
      .then(res => setOrders(Array.isArray(res.data) ? res.data : []))
      .catch(e => setError(e.response?.data?.message || 'Failed to load orders'))
      .finally(()=> setLoading(false));
  }, []);

  const productIds = useMemo(()=>{
    const ids = new Set();
    orders.forEach(o => o.orderItems?.forEach(oi => oi.product?._id && ids.add(oi.product._id)));
    return Array.from(ids);
  }, [orders]);

  // fetch review status for each product (sequential to avoid rate spike)
  useEffect(() => {
    if (!user) { setReviewStatusMap({}); return; }
    let cancelled = false;
    (async () => {
      const next = {};
      for (const pid of productIds) {
        try {
          next[pid] = { loading: true };
          // assign early to trigger rerender loading indicator
          if (!cancelled) setReviewStatusMap(curr => ({ ...curr, [pid]: { loading:true } }));
          const res = await bikePartsService.getReviewStatus(pid);
          if (cancelled) return;
          next[pid] = { ...res.data, loading:false };
          setReviewStatusMap(curr => ({ ...curr, [pid]: next[pid] }));
        } catch (e) {
          if (cancelled) return;
          setReviewStatusMap(curr => ({ ...curr, [pid]: { canReview:false, alreadyReviewed:false, loading:false, error:true } }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [productIds, user]);

  const submitInlineReview = async (pid, rating, comment) => {
    try {
      setSubmitting(s => ({ ...s, [pid]: true }));
      setMessages(m => ({ ...m, [pid]: '' }));
      await bikePartsService.addReview(pid, { rating:Number(rating), comment });
      setMessages(m => ({ ...m, [pid]: 'Review submitted' }));
      setReviewStatusMap(m => ({ ...m, [pid]: { canReview:false, alreadyReviewed:true, loading:false } }));
    } catch(e){
      setMessages(m => ({ ...m, [pid]: e.response?.data?.message || 'Failed' }));
    } finally {
      setSubmitting(s => ({ ...s, [pid]: false }));
    }
  };

  const rows = useMemo(() => orders.map(o => {
    const firstItem = o.orderItems?.[0];
    const productName = firstItem?.name || firstItem?.product?.name || firstItem?.product?.model || 'Item';
    const extraCount = (o.orderItems?.length || 0) - 1;
    const shop = firstItem?.product?.shop;
    const shopPhone = shop?.phone || 'N/A';
    const pickup = o.collectionDate ? new Date(o.collectionDate).toLocaleDateString() : '-';
    let mapsUrl = null;
    if (shop?.location?.coordinates && Array.isArray(shop.location.coordinates)) {
      const [lng, lat] = shop.location.coordinates; // stored [lng,lat]
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat+','+lng)}`;
    }
    return {
      id: o._id,
      order: o,
      product: productName + (extraCount > 0 ? ` +${extraCount} more` : ''),
      pickup,
      shopPhone,
      mapsUrl
    };
  }), [orders]);

  return (
    <div style={{ padding:'1rem', maxWidth:1100, margin:'0 auto' }}>
      <h2 style={{margin:'0 0 1rem'}}>My Orders</h2>
      {loading && <div style={{padding:'0.5rem 0'}}>Loading…</div>}
      {error && <div style={{color:'#b91c1c', padding:'0.5rem 0'}}>{error}</div>}
      {!loading && !error && !orders.length && (
        <div style={{fontSize:14, color:'#475569'}}>No orders yet.</div>
      )}
      {!!orders.length && (
        <div style={{overflowX:'auto', border:'1px solid #e2e8f0', borderRadius:12}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
            <thead style={{background:'#f1f5f9'}}>
              <tr>
                <Th>Order Id</Th>
                <Th>Product(s)</Th>
                <Th>Pickup Date</Th>
                <Th>Maps</Th>
                <Th>Rate Items</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                  <Td mono>{r.id}</Td>
                  <Td>{r.product}</Td>
                  <Td>{r.pickup}</Td>
                  <Td>{r.mapsUrl ? <a href={r.mapsUrl} target="_blank" rel="noreferrer" style={{color:'#1d4ed8', textDecoration:'none'}}>Open</a> : '-'}</Td>
                  <Td>
                    {r.order.orderItems?.map(oi => {
                      const pid = oi.product?._id;
                      if (!pid) return null;
                      const st = reviewStatusMap[pid] || {};
                      const key = r.id + '-' + pid;
                      return (
                        <div key={key} style={{marginBottom:6, border:'1px solid #e2e8f0', borderRadius:8, padding:'4px 6px'}}>
                          <div style={{fontSize:10, fontWeight:600}}>{oi.product?.name || oi.name || oi.product?.model || 'Item'} <span style={{color:'#f59e0b'}}>{typeof oi.product?.rating==='number' && '★'+oi.product.rating.toFixed(1)}</span></div>
                          {!user && <div style={{fontSize:10}}>Login to rate</div>}
                          {user && st.loading && <div style={{fontSize:10}}>Checking…</div>}
                          {user && !st.loading && st.alreadyReviewed && <div style={{fontSize:10, color:'#15803d'}}>Reviewed</div>}
                          {user && !st.loading && st.canReview && (
                            <InlineReview pid={pid} submitting={!!submitting[pid]} message={messages[pid]} onSubmit={submitInlineReview} />
                          )}
                          {user && !st.loading && !st.canReview && !st.alreadyReviewed && <div style={{fontSize:10}}>Purchase confirmed</div>}
                          {messages[pid] && <div style={{fontSize:10, color: messages[pid].includes('Fail')||messages[pid].includes('required')? '#b91c1c':'#15803d'}}>{messages[pid]}</div>}
                        </div>
                      );
                    })}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Small inline review form component
const InlineReview = ({ pid, onSubmit, submitting, message }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(pid, rating, comment); }} style={{display:'flex', flexDirection:'column', gap:2, marginTop:2}}>
      <select value={rating} onChange={e=> setRating(Number(e.target.value))} style={{fontSize:10, padding:2}}>
        {[5,4,3,2,1].map(v=> <option key={v} value={v}>{v}</option>)}
      </select>
      <input placeholder='Comment' value={comment} onChange={e=> setComment(e.target.value)} style={{fontSize:10, padding:'2px 4px'}} />
      <button type='submit' disabled={submitting} style={{fontSize:10, padding:'2px 4px', background:'#1d4ed8', color:'#fff', border:'none', borderRadius:4, cursor:'pointer'}}>{submitting? '...' : 'Rate'}</button>
    </form>
  );
};

const Th = ({ children }) => (
  <th style={{textAlign:'left', padding:'10px 12px', fontSize:12, fontWeight:700, color:'#0f172a', borderBottom:'1px solid #e2e8f0'}}>{children}</th>
);
const Td = ({ children, mono }) => (
  <td style={{padding:'9px 12px', fontSize:12, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', whiteSpace:'nowrap'}}>{children}</td>
);

export default MyOrdersPage;
