import React, { useEffect, useState } from 'react';
import { formatINR } from '../../utils/currency';
import bikePartsService from '../../services/bikePartsService';
import adminService from '../../services/adminService';

const AdminProductsPage = () => {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name:'', price:'', brand:'', type:'', description:'', countInStock:'' });

  useEffect(()=>{
    setLoading(true);
    bikePartsService.getParts().then(({data})=> setParts(data.products || data)).catch(e=> setError(e.response?.data?.message||e.message)).finally(()=> setLoading(false));
  },[]);

  const startEdit = (p) => {
    setEditing(p._id);
    setEditForm({ name:p.name||'', price:p.price||'', brand:p.brand||'', type:p.type||'', description:p.description||'', countInStock:p.countInStock??'' });
  };
  const cancelEdit = () => { setEditing(null); };
  const onChange = e => setEditForm(f=> ({...f, [e.target.name]: e.target.value }));
  const save = async (id) => {
    try {
      const payload = { ...editForm, price: Number(editForm.price), countInStock: Number(editForm.countInStock) };
      const { data } = await adminService.adminUpdateProduct(id, payload);
      setParts(ps => ps.map(p=> p._id===id? {...p, ...data}: p));
      setEditing(null);
    } catch(e){
      alert(e.response?.data?.message || 'Update failed');
    }
  };
  return (
    <div style={{minHeight:'100vh', background:'#fff'}}>
      <div style={{background:'#0a2aa7', color:'#fff', padding:'0.75rem 1rem', fontWeight:800}}>Products</div>
      <div style={{padding:'1rem 1.25rem', display:'grid', gap:'0.75rem'}}>
        {loading && 'Loading...'}
        {error && <div style={{color:'red'}}>{error}</div>}
        {parts.map(p=> (
          <div key={p._id} style={{border:'2px solid #1d4ed8', borderRadius:10, padding:'0.75rem', background: editing===p._id? '#f0f9ff':'#fff'}}>
            <div style={{display:'flex', gap:'0.75rem'}}>
              {p.images?.[0] && (<img alt={p.name||p.model} src={p.images[0].startsWith('http')? p.images[0]:`http://localhost:5000${p.images[0]}`} style={{width:100,height:100,objectFit:'cover',borderRadius:8}} />)}
              <div style={{flex:1}}>
                {editing===p._id ? (
                  <div style={{display:'grid', gap:6, fontSize:12}}>
                    <input name='name' value={editForm.name} onChange={onChange} placeholder='Name' />
                    <div style={{display:'flex', gap:6}}>
                      <input style={{flex:1}} name='brand' value={editForm.brand} onChange={onChange} placeholder='Brand' />
                      <input style={{flex:1}} name='type' value={editForm.type} onChange={onChange} placeholder='Type' />
                    </div>
                    <div style={{display:'flex', gap:6}}>
                      <input style={{flex:1}} name='price' value={editForm.price} onChange={onChange} placeholder='Price' type='number' />
                      <input style={{flex:1}} name='countInStock' value={editForm.countInStock} onChange={onChange} placeholder='Stock' type='number' />
                    </div>
                    <textarea name='description' value={editForm.description} onChange={onChange} rows={2} placeholder='Description' />
                    <div style={{display:'flex', gap:6}}>
                      <button onClick={()=> save(p._id)} style={{flex:1, background:'#15803d', color:'#fff', border:'none', padding:'6px 8px', borderRadius:6, cursor:'pointer', fontSize:12}}>Save</button>
                      <button onClick={cancelEdit} style={{flex:1, background:'#475569', color:'#fff', border:'none', padding:'6px 8px', borderRadius:6, cursor:'pointer', fontSize:12}}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{fontWeight:700,color:'#1d4ed8'}}>{p.name || p.model}</div>
                    <div style={{fontSize:12}}>Brand: {p.brand||p.company} • Type: {p.type||'Part'} • Price: {formatINR(p.price)}</div>
                    <div style={{fontSize:12}}>Rating: {p.rating?.toFixed?.(1)||0} ({p.numReviews||0})</div>
                    <div style={{marginTop:6}}>
                      <button onClick={()=> startEdit(p)} style={{background:'#1d4ed8', color:'#fff', border:'none', padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer'}}>Edit</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProductsPage;
