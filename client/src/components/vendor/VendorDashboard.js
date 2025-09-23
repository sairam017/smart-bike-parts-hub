import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import bikePartsService from '../../services/bikePartsService';
import metaService from '../../services/metaService';
import './vendor.css';
import useAuth from '../../hooks/useAuth';
import { Autocomplete, useLoadScript } from '@react-google-maps/api';

const VendorDashboard = () => {
  const [tab, setTab] = useState('shop');
  const [metaTab, setMetaTab] = useState('company');
  
  const [companyMetaList, setCompanyMetaList] = useState([]);
  const [modelMetaList, setModelMetaList] = useState([]);
  const [companyMetaForm, setCompanyMetaForm] = useState({ company:'', image:'' });
  const [modelMetaForm, setModelMetaForm] = useState({ company:'', model:'', image:'' });
  const [metaMsg, setMetaMsg] = useState('');
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingModel, setEditingModel] = useState(false);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name:'', address:'', phone:'', website:'', latitude:'', longitude:'' });

  const [part, setPart] = useState({ name:'', model:'', models:[''], company:'', vehicleYear:'', price:'', description:'', brand:'', category:'', countInStock:'', image:null, imageUrl:'', existingImages:[] });
  const [parts, setParts] = useState([]); // vendor's own parts
  const [editingPartId, setEditingPartId] = useState(null);
  const [partFilter, setPartFilter] = useState('');
  const [updateMode, setUpdateMode] = useState(false); // false => create only, true => show update list
  const [companyOptions, setCompanyOptions] = useState([]); // meta companies
  const [modelOptions, setModelOptions] = useState([]); // meta models for selected company
  const [creating, setCreating] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [msg, setMsg] = useState(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const bgStyle = useMemo(()=>({ minHeight: '100vh', background: '#ffffff', color: '#0b2e68' }), []);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const autoRef = useRef(null);
  const partsSectionRef = useRef(null);
  const [geoInfo, setGeoInfo] = useState(null); // { accuracy, time }
  const mapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: placesLoaded } = useLoadScript({ googleMapsApiKey: mapsApiKey, libraries: ['places'] });

  // Year options from 1990 to current year (descending)
  const YEAR_OPTIONS = useMemo(() => {
    const now = new Date().getFullYear();
    const start = 1990;
    const arr = [];
    for (let y = now; y >= start; y--) arr.push(y);
    return arr;
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/shops/me').then(({data}) => {
      setShop(data);
      setForm({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        website: data.website || '',
        latitude: data.location?.coordinates ? String(data.location.coordinates[1]) : '',
        longitude: data.location?.coordinates ? String(data.location.coordinates[0]) : ''
      });
      // After shop loaded, load parts for this shop
      if (data?._id) {
        bikePartsService.getParts({ shop: data._id }).then(r => {
          const d = r.data;
          setParts(Array.isArray(d) ? d : d.products || []);
        }).catch(()=>{/* ignore */});
      }
    }).catch(e => setError(e.response?.data?.message || e.message)).finally(()=> setLoading(false));
  }, []);

  // Load companies when entering parts tab first time
  useEffect(() => {
    if (tab === 'parts' && !companyOptions.length) {
      metaService.getCompanies().then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        setCompanyOptions(list.map(c => c.company).filter(Boolean));
      }).catch(()=>{});
    }
  }, [tab, companyOptions.length]);

  // Load models when company changes
  useEffect(() => {
    const c = (part.company || '').trim();
    if (!c) { setModelOptions([]); return; }
    metaService.getModels(c).then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setModelOptions(list.map(m => m.model).filter(Boolean));
    }).catch(()=> setModelOptions([]));
  }, [part.company]);

  const refreshParts = async () => {
    if (!shop?._id) return;
    try {
      const r = await bikePartsService.getParts({ shop: shop._id });
      const d = r.data;
      setParts(Array.isArray(d) ? d : d.products || []);
    } catch (_) { /* ignore */ }
  };

  const filteredParts = useMemo(() => {
    const q = partFilter.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(p => [p.name, p.model, p.company, p.brand, p.type]
      .some(v => v && String(v).toLowerCase().includes(q)));
  }, [partFilter, parts]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const onPartChange = (e) => setPart({ ...part, [e.target.name]: e.target.value });
  const onModelChangeAt = (idx, value) => {
    setPart(prev => {
      const next = Array.isArray(prev.models) ? [...prev.models] : [];
      next[idx] = value;
      return { ...prev, models: next };
    });
  };
  const addModelField = () => setPart(prev => ({ ...prev, models: [...(prev.models || []), ''] }));
  const removeModelField = (idx) => {
    setPart(prev => {
      const next = [...(prev.models || [])];
      next.splice(idx, 1);
      return { ...prev, models: next.length ? next : [''] };
    });
  };
  const onImageChange = (e) => setPart(prev=> ({ ...prev, image: e.target.files?.[0] || null }));


  const detectLocation = async () => {
    // Helper: approximate via IP if precise geolocation unavailable
    const ipFallback = async () => {
      try {
        setGeoInfo(g => ({ ...(g||{}), status: 'ip_fallback' }));
        const resp = await fetch('https://ipapi.co/json/');
        if (!resp.ok) throw new Error('IP fallback failed');
        const data = await resp.json();
        if (data && data.latitude && data.longitude) {
          const lat = parseFloat(data.latitude);
          const lng = parseFloat(data.longitude);
            setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
            setGeoInfo({ status: 'approx', accuracy: 50000, time: new Date(), note: 'Approximate (IP based)' });
        } else {
          setGeoInfo({ status: 'error', message: 'Approximate location unavailable' });
        }
      } catch (e) {
        setGeoInfo({ status: 'error', message: e.message || 'Could not determine location' });
      }
    };

    if (!navigator.geolocation) {
      alert('Geolocation not supported by this browser');
      setGeoInfo({ status: 'error', message: 'Geolocation not supported' });
      ipFallback();
      return;
    }
    setGeoInfo({ status: 'detecting' });

    let timeoutId;
    const geoPromise = new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
    try {
      const pos = await geoPromise;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
      setGeoInfo({ status: 'ok', accuracy: pos.coords.accuracy, time: new Date(pos.timestamp) });
      // Reverse geocode (best effort)
      try {
        if (window.google && window.google.maps && typeof window.google.maps.Geocoder === 'function') {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              setForm(f => ({ ...f, address: results[0].formatted_address }));
            }
          });
        }
      } catch (_) { /* ignore */ }
    } catch (err) {
      const code = err?.code;
      let message = err?.message || 'Failed to get location';
      if (code === 1) message = 'Permission denied. Please allow location access and retry.';
      if (code === 2) message = 'Position unavailable. Moving to IP fallback.';
      if (code === 3) message = 'Timed out. Using approximate location.';
      setGeoInfo({ status: 'error', message });
      // Attempt fallback
      ipFallback();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch (e) {
      alert('Camera not available: ' + (e.message || '')); 
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPart(p => ({ ...p, image: file }));
    }, 'image/jpeg', 0.9);
  };

  const saveShop = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/shops/me', {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined
      });
      setShop(data);
      alert('Shop updated');
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to update');
    }
  };

  const createPart = async (e) => {
    e.preventDefault();
    
    const now = Date.now();
    
    // Guard against double submission (React StrictMode, rapid clicks, etc.)
    if (creating || (now - lastSubmissionTime) < 1000) {
      console.log('Prevented duplicate submission');
      return;
    }
    
    setCreating(true);
    setLastSubmissionTime(now);
    setMsg(null);
    
    try {
      // Check shop location
      if (!shop?.location?.coordinates || (shop.location.coordinates[0] === 0 && shop.location.coordinates[1] === 0)) {
        setMsg('Please update your shop coordinates before adding parts.');
        return;
      }

      // Handle model validation
      let finalModel = null;
      let finalModels = [];
      
      if (editingPartId) {
        // For editing, use single model only
        finalModel = (part.model || '').trim();
        if (!finalModel) {
          setMsg('Please add a model');
          return;
        }
      } else {
        // For creating, handle multiple models
        const modelsClean = (Array.isArray(part.models) ? part.models : [])
          .map(s => String(s || '').trim())
          .filter(Boolean);
        const singleModel = (modelsClean[0] || part.model || '').trim();
        
        if (!modelsClean.length && !singleModel) {
          setMsg('Please add at least one model');
          return;
        }
        
        finalModels = modelsClean.length ? modelsClean : [singleModel];
      }

      // Handle image upload
      let imageUrl = null;
      if (part.image) {
        const formData = new FormData();
        formData.append('image', part.image);
        const uploadRes = await api.post('/upload', formData, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });
        imageUrl = uploadRes.data?.url || null;
      }

      // Auto-add company to metadata if new
      const companyTrim = (part.company || '').trim();
      if (companyTrim && !companyOptions.includes(companyTrim)) {
        try {
          await metaService.upsertCompany({ company: companyTrim });
          setCompanyOptions(prev => [...prev, companyTrim]);
        } catch (error) {
          // Ignore meta service errors
        }
      }

      // Build payload
      const payload = {
        name: part.name,
        company: part.company,
        brand: part.brand,
        type: part.category || undefined,
        countInStock: part.countInStock ? Number(part.countInStock) : undefined,
        vehicleYear: Number(part.vehicleYear) || undefined,
        price: Number(part.price),
        description: part.description,
        imageUrl: part.imageUrl || undefined,
        images: editingPartId ? 
          // For updates: combine existing images with new image (if any), remove duplicates
          [...new Set([...(part.existingImages || []), ...(imageUrl ? [imageUrl] : [])])] :
          // For creates: just the new image (if any)  
          (imageUrl ? [imageUrl] : [])
      };

      // Add model(s) to payload
      if (editingPartId) {
        payload.model = finalModel;
      } else {
        if (finalModels.length > 1) {
          payload.models = finalModels;
        } else {
          payload.model = finalModels[0];
        }
      }

      // Submit to API
      if (editingPartId) {
        await bikePartsService.updatePart(editingPartId, payload);
        setMsg('Part updated successfully');
      } else {
        const { data } = await bikePartsService.createPart(payload);
        const createdCount = Array.isArray(data?.created) ? data.created.length : 1;
        setMsg(`Part created successfully${createdCount > 1 ? ` (${createdCount} models)` : ''}`);
      }

      // Reset form
      setPart({ 
        name: '', model: '', models: [''], company: '', vehicleYear: '', 
        price: '', description: '', brand: '', category: '', countInStock: '', 
        image: null, imageUrl: '', existingImages: [] 
      });
      setEditingPartId(null);
      refreshParts();

    } catch (error) {
      console.error('Error in createPart:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save part';
      
      if (errorMessage.includes('duplicate') || errorMessage.includes('11000') || error.response?.status === 409) {
        setMsg('This part already exists. Please modify the details or check existing inventory.');
      } else {
        setMsg(errorMessage);
      }
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (p) => {
    setEditingPartId(p._id);
    setPart({
      name: p.name || '',
      model: p.model || '',
      models: [''], // keep single model editing simple
      company: p.company || '',
      vehicleYear: p.vehicleYear || '',
      price: p.price || '',
      description: p.description || '',
      brand: p.brand || '',
      category: p.type || '',
      countInStock: p.countInStock != null ? String(p.countInStock) : '',
      image: null,
      imageUrl: '',
      existingImages: p.images || []
    });
    setTab('parts');
    setMsg(null);
  };

  const cancelEdit = () => {
    setEditingPartId(null);
    setPart({ name:'', model:'', models:[''], company:'', vehicleYear:'', price:'', description:'', brand:'', category:'', countInStock:'', image:null, imageUrl:'', existingImages:[] });
    setMsg(null);
  };

  // ----- Meta (company/model images) -----
  const refreshMeta = async () => {
    try {
      const [cRes] = await Promise.all([
        metaService.getCompanies()
      ]);
      setCompanyMetaList(Array.isArray(cRes.data) ? cRes.data : []);
      if (modelMetaForm.company) {
        const mRes = await metaService.getModels(modelMetaForm.company);
        setModelMetaList(Array.isArray(mRes.data) ? mRes.data : []);
      }
    } catch (e) {
      // ignore
    }
  };
  useEffect(() => { if (tab === 'meta') refreshMeta(); }, [tab, refreshMeta]);
  useEffect(() => { if (tab === 'meta' && metaTab === 'model' && modelMetaForm.company) {
    metaService.getModels(modelMetaForm.company).then(r => setModelMetaList(r.data || [])).catch(()=> setModelMetaList([]));
  }} , [modelMetaForm.company, metaTab, tab]);

  const handleMetaImageUpload = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = data?.url;
      if (kind === 'company') setCompanyMetaForm(f => ({ ...f, image: url }));
      else setModelMetaForm(f => ({ ...f, image: url }));
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Upload failed');
    }
  };
  const submitCompanyMeta = async (e) => {
    e.preventDefault();
    try {
      await metaService.upsertCompany(companyMetaForm);
      setMetaMsg('Saved company image');
      setTimeout(()=> setMetaMsg(''), 2000);
      setCompanyMetaForm({ company:'', image:'' });
      refreshMeta();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Save failed');
    }
  };
  const submitModelMeta = async (e) => {
    e.preventDefault();
    try {
      await metaService.upsertModel(modelMetaForm);
      setMetaMsg('Saved model image');
      setTimeout(()=> setMetaMsg(''), 2000);
      setModelMetaForm({ company:modelMetaForm.company, model:'', image:'' });
      if (modelMetaForm.company) {
        const mRes = await metaService.getModels(modelMetaForm.company);
        setModelMetaList(Array.isArray(mRes.data) ? mRes.data : []);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Save failed');
    }
  };
  const absolute = (url) => {
    if (!url) return url;
    if (url.startsWith('http')) return url;
    return `http://localhost:5000${url}`;
  };

  if (loading) return <div style={{ padding: '1rem' }}>Loading...</div>;
  if (error) return <div style={{ padding: '1rem', color:'red' }}>{error}</div>;
  if (!shop) return <div style={{ padding: '1rem' }}>No shop found. Ask admin to create one.</div>;

  return (
    <>
    <div style={bgStyle} className="vendor-bg">
  <div style={{background:'#0a2aa7', color:'#fff', padding:'0.75rem 1rem', fontWeight:800}}>Welcome, {user?.name || 'Vendor'}</div>
    <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem', padding:'1rem', alignItems:'center', borderBottom:'2px solid #1d4ed8' }}>
    <button onClick={()=> { setTab('shop'); }} disabled={tab==='shop'} className={tab==='shop' ? 'btn-primary' : 'btn-outline'}>Shop</button>
  <button onClick={()=> { setTab('parts'); setUpdateMode(false); }} disabled={tab==='parts' && !updateMode} className={tab==='parts' && !updateMode ? 'btn-primary' : 'btn-outline'}>Parts</button>
  <button onClick={()=> setTab('meta')} disabled={tab==='meta'} className={tab==='meta' ? 'btn-primary' : 'btn-outline'}>Brand / Model Images</button>
        <button
          type="button"
          className={tab === 'parts' && updateMode ? 'btn-primary' : 'btn-outline'}
          onClick={() => {
            setTab('parts');
            setUpdateMode(true);
            setTimeout(()=> { partsSectionRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }); }, 50);
          }}
          disabled={tab === 'parts' && updateMode}
        >Update Parts</button>
        <div style={{marginLeft:'auto', display:'flex', gap:8}}>
          <button onClick={() => navigate('/')} className="btn-outline">Landing</button>
          <button onClick={() => navigate('/myorders')} className="btn-outline">My Orders</button>
          <button onClick={logout} className="btn-outline">Logout</button>
        </div>
      </div>

      {tab === 'shop' && (
        <form onSubmit={saveShop} className="vendor-card" style={{ display:'grid', gap:'0.75rem', maxWidth: 640, margin:'1rem' }}>
          <h2 style={{margin:0, color:'#1d4ed8'}}>My Shop</h2>
          <input name="name" placeholder="Shop Name" value={form.name} onChange={onChange} className="input-blue" />
          {placesLoaded && mapsApiKey ? (
            <Autocomplete
              onLoad={(ac) => { autoRef.current = ac; }}
              onPlaceChanged={() => {
                const place = autoRef.current?.getPlace?.();
                const lat = place?.geometry?.location?.lat?.();
                const lng = place?.geometry?.location?.lng?.();
                setForm(f => ({
                  ...f,
                  address: place?.formatted_address || f.address,
                  latitude: lat != null ? String(lat) : f.latitude,
                  longitude: lng != null ? String(lng) : f.longitude
                }));
              }}
            >
              <input name="address" placeholder="Search address (Google)" value={form.address} onChange={onChange} className="input-blue" />
            </Autocomplete>
          ) : (
            <input name="address" placeholder="Address" value={form.address} onChange={onChange} className="input-blue" />
          )}
          <input name="phone" placeholder="Contact Number" value={form.phone} onChange={onChange} className="input-blue" />
          {(() => {
            const latStr = String(form.latitude ?? '').trim();
            const lngStr = String(form.longitude ?? '').trim();
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            const valid = latStr && lngStr && !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0);
            if (valid) {
              return (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latStr},${lngStr}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="input-blue"
                  style={{ display:'block', textDecoration:'none', color:'#1d4ed8', fontWeight:700 }}
                >
                  Open Google Maps ({latStr}, {lngStr})
                </a>
              );
            }
            return (
              <input name="website" placeholder="Website" value={form.website} onChange={onChange} className="input-blue" />
            );
          })()}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', alignItems:'end'}}>
            <input name="latitude" placeholder="Latitude" value={form.latitude} onChange={onChange} className="input-blue" />
            <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:'0.5rem'}}>
              <input name="longitude" placeholder="Longitude" value={form.longitude} onChange={onChange} className="input-blue" />
              <button type="button" className="btn-outline" onClick={detectLocation}>Click here to detect shop location</button>
            </div>
          </div>
          {geoInfo && (
            <div style={{fontSize:12, lineHeight:1.4, background:'#eff6ff', padding:'4px 8px', borderRadius:6, color:'#0b2e68'}}>
              {geoInfo.status === 'detecting' && 'Detecting precise GPS coordinates…'}
              {geoInfo.status === 'ok' && (
                <>Detected: {form.latitude}, {form.longitude} • Accuracy ±{Math.round(geoInfo.accuracy)} m at {geoInfo.time?.toLocaleTimeString?.()}.</>
              )}
              {geoInfo.status === 'approx' && (
                <>Approximate (IP): {form.latitude}, {form.longitude} • Accuracy low.</>
              )}
              {geoInfo.status === 'ip_fallback' && 'Attempting approximate location…'}
              {geoInfo.status === 'error' && (
                <span style={{color:'#b91c1c'}}>Error: {geoInfo.message}</span>
              )}
              {!window.isSecureContext && geoInfo.status !== 'ok' && (
                <div style={{marginTop:2}}>Tip: Use HTTPS or run locally (http://localhost) for better accuracy.</div>
              )}
            </div>
          )}
          {/* Enhanced geolocation status block above */}
          <button type="submit" className="btn-primary">Save Shop</button>
        </form>
      )}

      {tab === 'parts' && (
        <div ref={partsSectionRef} style={{ display:'grid', gap:'1rem', maxWidth: 900, margin:'1rem' }}>
          {!updateMode && (
            <form onSubmit={createPart} className="vendor-card" style={{ display:'grid', gap:'0.75rem' }}>
              <h2 style={{margin:0, color:'#1d4ed8'}}>Add Part</h2>
              <input name="name" placeholder="Product Name" value={part.name} onChange={onPartChange} className="input-blue" />
              <div>
                <label style={{display:'block', marginBottom:6, color:'#1d4ed8'}}>Company</label>
                <input list="company-list" name="company" placeholder="Company" value={part.company} onChange={onPartChange} required className="input-blue" />
                <datalist id="company-list">
                  {companyOptions.map(c => <option key={c} value={c} />)}
                </datalist>
                <small style={{fontSize:10, color:'#475569'}}>Select existing company or type a new one to add automatically.</small>
              </div>
              <div>
                <label style={{display:'block', marginBottom:6, color:'#1d4ed8'}}>Model(s)</label>
                <div style={{display:'grid', gap:6}}>
                  {(part.models || ['']).map((m, idx) => (
                    <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                      <div style={{position:'relative'}}>
                        <input list="model-list" placeholder={`Model ${idx+1}`} value={m} onChange={(e)=> onModelChangeAt(idx, e.target.value)} className="input-blue" />
                      </div>
                      <button type="button" className="btn-outline" onClick={() => removeModelField(idx)} disabled={(part.models||[]).length <= 1}>Remove</button>
                    </div>
                  ))}
                  <datalist id="model-list">
                    {modelOptions.map(mo => <option key={mo} value={mo} />)}
                  </datalist>
                </div>
                <div style={{marginTop:8}}>
                  <button type="button" className="btn-outline" onClick={addModelField}>+ Add more model</button>
                </div>
                <div className="chip-list">
                  {(part.models||[]).filter(Boolean).map((m, i) => (
                    <span key={i} className="chip">
                      {m}
                      <span className="x" onClick={()=> removeModelField(i)}>×</span>
                    </span>
                  ))}
                </div>
              </div>
              {/* company moved above */}
              <input name="category" placeholder="Category" value={part.category} onChange={onPartChange} className="input-blue" />
              <input name="countInStock" type="number" placeholder="Count In Stock" value={part.countInStock} onChange={onPartChange} className="input-blue" />
              <select name="vehicleYear" value={part.vehicleYear} onChange={onPartChange} className="input-blue">
                <option value="" disabled>Select Vehicle Year</option>
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <input name="price" type="number" placeholder="Price (INR)" value={part.price} onChange={onPartChange} required className="input-blue" />
              <textarea name="description" placeholder="Description" value={part.description} onChange={onPartChange} className="input-blue" style={{ minHeight:90 }} />
              <div>
                <label style={{display:'block', marginBottom:6, color:'#1d4ed8'}}>Product Image</label>
                <input type="file" accept="image/*" capture="environment" onChange={onImageChange} className="input-blue" style={{ padding:0 }} />
                <input name="imageUrl" placeholder="...or paste an Image URL" value={part.imageUrl} onChange={onPartChange} className="input-blue" style={{ marginTop:8 }} />
                {part.image && (
                  <div style={{marginTop:8}}>
                    <img alt="preview" src={URL.createObjectURL(part.image)} style={{maxWidth:220, maxHeight:220, borderRadius:8, border:'2px solid #1d4ed8'}} />
                  </div>
                )}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0.5rem', alignItems:'center'}}>
                <div style={{color:'#1d4ed8'}}>Or use camera</div>
                {!cameraOn ? (
                  <button type="button" className="btn-outline" onClick={startCamera}>Use Camera</button>
                ) : (
                  <button type="button" className="btn-outline" onClick={stopCamera}>Stop Camera</button>
                )}
                {cameraOn && (
                  <button type="button" className="btn-primary" onClick={capturePhoto}>Capture</button>
                )}
              </div>
              {cameraOn && (
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
                  <video ref={videoRef} style={{width:'100%', background:'#000', border:'2px solid #1d4ed8', borderRadius:8}} playsInline muted />
                  <canvas ref={canvasRef} style={{width:'100%', border:'2px dashed #1d4ed8', borderRadius:8}} />
                </div>
              )}
              <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create'}</button>
              {msg && <div style={{color:'#1d4ed8'}}>{msg}</div>}
            </form>
          )}
          {updateMode && (
            <div className="vendor-card" style={{display:'grid', gap:'0.75rem', width:'100%', maxWidth:'none'}}>
              <h2 style={{margin:0, color:'#1d4ed8'}}>Update Parts</h2>
              <div style={{display:'flex', gap:8}}>
                <input
                  type="text"
                  placeholder="Search name / model / company / brand"
                  value={partFilter}
                  onChange={e=> setPartFilter(e.target.value)}
                  className="input-blue"
                  style={{flex:1}}
                />
                {partFilter && <button type="button" className="btn-outline" onClick={()=> setPartFilter('')}>Clear</button>}
                <button type="button" className="btn-outline" onClick={refreshParts}>Refresh</button>
                <button type="button" className="btn-outline" onClick={()=> { setUpdateMode(false); cancelEdit(); }}>Add New Part</button>
              </div>
              <div style={{fontSize:11, color:'#1d4ed8'}}>Showing {filteredParts.length} of {parts.length} parts</div>
              <div style={{display:'grid', gap:8, maxHeight:300, overflow:'auto'}}>
                {filteredParts.map(p => (
                  <div key={p._id} style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center', background:'#fff', padding:'6px 8px', borderRadius:6, border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:13, fontWeight:600}}>{p.name || p.model} <span style={{fontWeight:400}}>- {p.company}</span></div>
                    <button type="button" className="btn-outline" onClick={()=> startEdit(p)}>Edit</button>
                    <button type="button" className="btn-outline" onClick={async()=>{ if(window.confirm('Delete this part?')){ try{ await bikePartsService.deletePart(p._id); refreshParts(); }catch(e){ alert(e.response?.data?.message||'Delete failed'); } } }}>Del</button>
                  </div>
                ))}
                {!parts.length && <div style={{fontSize:12, color:'#475569'}}>No parts yet.</div>}
                {parts.length && !filteredParts.length && <div style={{fontSize:12, color:'#475569'}}>No match for "{partFilter}"</div>}
              </div>
              {editingPartId && (
                <form onSubmit={createPart} style={{display:'grid', gap:'0.75rem', marginTop:'1rem', borderTop:'1px solid #e2e8f0', paddingTop:'0.75rem'}}>
                  <h3 style={{margin:0, color:'#1d4ed8'}}>Edit Part</h3>
                  <input name="name" placeholder="Product Name" value={part.name} onChange={onPartChange} className="input-blue" />
                  <input name="model" placeholder="Model" value={part.model} onChange={onPartChange} className="input-blue" />
                  <div>
                    <label style={{display:'block', marginBottom:4, color:'#1d4ed8'}}>Company</label>
                    <input list="company-list" name="company" placeholder="Company" value={part.company} onChange={onPartChange} required className="input-blue" />
                  </div>
                  <input name="brand" placeholder="Brand" value={part.brand} onChange={onPartChange} className="input-blue" />
                  <input name="category" placeholder="Category" value={part.category} onChange={onPartChange} className="input-blue" />
                  <input name="countInStock" type="number" placeholder="Count In Stock" value={part.countInStock} onChange={onPartChange} className="input-blue" />
                  <select name="vehicleYear" value={part.vehicleYear} onChange={onPartChange} className="input-blue">
                    <option value="" disabled>Select Vehicle Year</option>
                    {YEAR_OPTIONS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <input name="price" type="number" placeholder="Price (INR)" value={part.price} onChange={onPartChange} required className="input-blue" />
                  <textarea name="description" placeholder="Description" value={part.description} onChange={onPartChange} className="input-blue" style={{ minHeight:90 }} />
                  
                  {/* Image Upload Section for Edit Form */}
                  <div>
                    <label style={{display:'block', marginBottom:6, color:'#1d4ed8'}}>Product Image</label>
                    
                    {/* Display existing images when editing */}
                    {editingPartId && part.existingImages && part.existingImages.length > 0 && (
                      <div style={{marginBottom:12}}>
                        <p style={{fontSize:'0.9em', color:'#666', marginBottom:8}}>Existing images ({part.existingImages.length}):</p>
                        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                          {part.existingImages.map((img, idx) => (
                            <div key={idx} style={{position:'relative'}}>
                              <img 
                                alt={`existing-${idx}`} 
                                src={img.startsWith('http') ? img : `http://localhost:5000${img}`} 
                                style={{width:80, height:80, objectFit:'cover', borderRadius:6, border:'2px solid #10b981'}} 
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newImages = part.existingImages.filter((_, i) => i !== idx);
                                  setPart(prev => ({...prev, existingImages: newImages}));
                                }}
                                style={{
                                  position:'absolute', top:-8, right:-8, 
                                  background:'#dc2626', color:'#fff', border:'none',
                                  borderRadius:'50%', width:20, height:20,
                                  cursor:'pointer', fontSize:'12px'
                                }}
                                title="Remove this image"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <input type="file" accept="image/*" capture="environment" onChange={onImageChange} className="input-blue" style={{ padding:0 }} />
                    <input name="imageUrl" placeholder="...or paste an Image URL" value={part.imageUrl} onChange={onPartChange} className="input-blue" style={{ marginTop:8 }} />
                    {part.image && (
                      <div style={{marginTop:8}}>
                        <img alt="preview" src={URL.createObjectURL(part.image)} style={{maxWidth:220, maxHeight:220, borderRadius:8, border:'2px solid #1d4ed8'}} />
                      </div>
                    )}
                    {/* Show current image if no new image selected */}
                    {!part.image && part.imageUrl && (
                      <div style={{marginTop:8}}>
                        <p style={{fontSize:'0.9em', color:'#666'}}>Current image:</p>
                        <img alt="current" src={part.imageUrl.startsWith('http') ? part.imageUrl : `http://localhost:5000${part.imageUrl}`} style={{maxWidth:220, maxHeight:220, borderRadius:8, border:'2px solid #ccc'}} />
                      </div>
                    )}
                  </div>
                  
                  {/* Camera functionality for Edit Form */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0.5rem', alignItems:'center'}}>
                    <div style={{color:'#1d4ed8'}}>Or use camera</div>
                    {!cameraOn ? (
                      <button type="button" className="btn-outline" onClick={startCamera}>Use Camera</button>
                    ) : (
                      <button type="button" className="btn-outline" onClick={stopCamera}>Stop Camera</button>
                    )}
                    {cameraOn && (
                      <button type="button" className="btn-primary" onClick={capturePhoto}>Capture</button>
                    )}
                  </div>
                  {cameraOn && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
                      <video ref={videoRef} autoPlay style={{width:'100%', maxWidth:300, borderRadius:8, border:'2px solid #1d4ed8'}} />
                      <canvas ref={canvasRef} style={{width:'100%', maxWidth:300, borderRadius:8, border:'2px solid #ccc'}} />
                    </div>
                  )}
                  
                  <div style={{display:'flex', gap:8}}>
                    <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Saving...' : 'Save Changes'}</button>
                    <button type="button" className="btn-outline" onClick={cancelEdit}>Cancel</button>
                  </div>
                  {msg && <div style={{color:'#1d4ed8'}}>{msg}</div>}
                </form>
              )}
            </div>
          )}
        </div>
      )}
      {tab === 'meta' && (
        <div className="vendor-card" style={{ display:'grid', gap:'1rem', maxWidth: 760, margin:'1rem' }}>
          <h2 style={{margin:0, color:'#1d4ed8'}}>Manage Brand & Model Images</h2>
          <div style={{display:'flex', gap:8}}>
            <button type="button" onClick={()=> setMetaTab('company')} className={metaTab==='company' ? 'btn-primary' : 'btn-outline'}>Company</button>
            <button type="button" onClick={()=> setMetaTab('model')} className={metaTab==='model' ? 'btn-primary' : 'btn-outline'}>Model</button>
            <button type="button" onClick={async()=> { await refreshMeta(); setMetaMsg('Refreshed'); setTimeout(()=> setMetaMsg(''),1500); }} className="btn-outline" style={{marginLeft:'auto'}}>Refresh</button>
          </div>
          {metaTab === 'company' && (
            <form onSubmit={submitCompanyMeta} style={{display:'grid', gap:8}}>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <input placeholder="Company Name" value={companyMetaForm.company} onChange={e=> { setCompanyMetaForm(f=> ({...f, company:e.target.value})); setEditingCompany(false); }} className="input-blue" required />
                {editingCompany && <span style={{fontSize:12, color:'#1d4ed8'}}>Editing</span>}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
                <input placeholder="Image URL or upload below" value={companyMetaForm.image} onChange={e=> setCompanyMetaForm(f=> ({...f, image:e.target.value}))} className="input-blue" />
                <input type="file" accept="image/*" onChange={e=> handleMetaImageUpload(e, 'company')} style={{padding:0}} />
              </div>
              <div style={{display:'flex', gap:8}}>
                <button type="submit" className="btn-primary">{editingCompany ? 'Update' : 'Save'} Company Image</button>
                {editingCompany && (
                  <>
                    <button type="button" className="btn-outline" onClick={()=> setCompanyMetaForm(f=> ({...f, image:''}))}>Clear Image</button>
                    <button type="button" className="btn-outline" onClick={()=> { setCompanyMetaForm({ company:'', image:'' }); setEditingCompany(false); }}>Cancel</button>
                  </>
                )}
              </div>
            </form>
          )}
          {metaTab === 'model' && (
            <form onSubmit={submitModelMeta} style={{display:'grid', gap:8}}>
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                <input placeholder="Company" value={modelMetaForm.company} onChange={e=> { setModelMetaForm(f=> ({...f, company:e.target.value})); setEditingModel(false); }} className="input-blue" required />
                <input placeholder="Model" value={modelMetaForm.model} onChange={e=> { setModelMetaForm(f=> ({...f, model:e.target.value})); setEditingModel(false); }} className="input-blue" required />
                {editingModel && <span style={{fontSize:12, color:'#1d4ed8', alignSelf:'center'}}>Editing</span>}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
                <input placeholder="Image URL or upload below" value={modelMetaForm.image} onChange={e=> setModelMetaForm(f=> ({...f, image:e.target.value}))} className="input-blue" />
                <input type="file" accept="image/*" onChange={e=> handleMetaImageUpload(e, 'model')} style={{padding:0}} />
              </div>
              <div style={{display:'flex', gap:8}}>
                <button type="submit" className="btn-primary">{editingModel ? 'Update' : 'Save'} Model Image</button>
                {editingModel && (
                  <>
                    <button type="button" className="btn-outline" onClick={()=> setModelMetaForm(f=> ({...f, image:''}))}>Clear Image</button>
                    <button type="button" className="btn-outline" onClick={()=> { setModelMetaForm({ company:modelMetaForm.company, model:'', image:'' }); setEditingModel(false); }}>Cancel</button>
                  </>
                )}
              </div>
            </form>
          )}
          {metaMsg && <div style={{color:'#1d4ed8'}}>{metaMsg}</div>}
          <div style={{display:'grid', gap:8}}>
            {metaTab==='company' && (
              <div style={{display:'grid', gap:8}}>
                <h3 style={{margin:'0.5rem 0 0', fontSize:'1rem'}}>Existing Companies</h3>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12}}>
                  {companyMetaList.map(c => (
                    <div key={c._id} style={{border:'1px solid #1d4ed8', borderRadius:8, padding:8, background:'#f8fafc', cursor:'pointer'}} onClick={()=> { setCompanyMetaForm({ company:c.company, image:c.image||'' }); setEditingCompany(true); }} title="Click to edit">
                      <div style={{fontWeight:600, fontSize:13}}>{c.company}</div>
                      {c.image ? <img alt={c.company} src={absolute(c.image)} style={{width:'100%', height:80, objectFit:'cover', borderRadius:4, marginTop:4}} /> : <div style={{height:80, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#1d4ed8'}}>{c.company[0]}</div>}
                    </div>
                  ))}
                  {!companyMetaList.length && <div style={{fontSize:12, color:'#475569'}}>No companies yet</div>}
                </div>
              </div>
            )}
            {metaTab==='model' && (
              <div style={{display:'grid', gap:8}}>
                <h3 style={{margin:'0.5rem 0 0', fontSize:'1rem'}}>Existing Models ({modelMetaForm.company || 'select company'})</h3>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12}}>
                  {modelMetaList.map(m => (
                    <div key={m._id} style={{border:'1px solid #1d4ed8', borderRadius:8, padding:8, background:'#f8fafc', cursor:'pointer'}} onClick={()=> { setModelMetaForm({ company:m.company, model:m.model, image:m.image||'' }); setEditingModel(true); }} title="Click to edit">
                      <div style={{fontWeight:600, fontSize:13}}>{m.model}</div>
                      {m.image ? <img alt={m.model} src={absolute(m.image)} style={{width:'100%', height:80, objectFit:'cover', borderRadius:4, marginTop:4}} /> : <div style={{height:80, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#1d4ed8'}}>{m.model.split(/\s+/).slice(0,2).join(' ')}</div>}
                    </div>
                  ))}
                  {!modelMetaList.length && <div style={{fontSize:12, color:'#475569'}}>No models yet</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  {/* Map modal removed */}
    </>
  );
};


export default VendorDashboard;
