import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './landing.css';
import bikePartsService from '../../services/bikePartsService';
import metaService from '../../services/metaService';
import { formatINR } from '../../utils/currency';
import Carousel from '../common/Carousel';
import useAuth from '../../hooks/useAuth';
import useCart from '../../hooks/useCart';

const LandingPage = () => {
  const [q, setQ] = useState('');
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [types, setTypes] = useState([]);
  const [allPartsSample, setAllPartsSample] = useState([]); // initial fetch sample for menus
  const [openMenu, setOpenMenu] = useState('');
  const [selCompany, setSelCompany] = useState('');
  const [companyModels, setCompanyModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selModel, setSelModel] = useState('');
  const [modelParts, setModelParts] = useState([]);
  const [modelPartsLoading, setModelPartsLoading] = useState(false);
  const [companyMeta, setCompanyMeta] = useState([]); // {company,image}
  const [modelMeta, setModelMeta] = useState([]); // for selected company
  const navigate = useNavigate();
  const location = useLocation();
  const [orderMessage, setOrderMessage] = useState(null);
  const [selCategory, setSelCategory] = useState('all');
  const [searchFeedback, setSearchFeedback] = useState('');
  // Refs for auto-scroll targets
  const modelsRef = useRef(null);
  const partsRef = useRef(null);
  const { user, logout, updateProfile } = useAuth();
  const { totalItems } = useCart?.() || { totalItems:0 };
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const toggleMenu = () => setUserMenuOpen(o => !o);
  const startEditProfile = () => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setProfileCurrentPassword('');
    setProfileNewPassword('');
    setShowProfileModal(true);
    setUserMenuOpen(false);
  };
  const submitProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      if ((profileNewPassword || profileEmail !== user.email) && !profileCurrentPassword) {
        alert('Enter current password to change email or set a new password');
        setProfileSaving(false);
        return;
      }
      await updateProfile({
        name: profileName,
        email: profileEmail,
        currentPassword: profileCurrentPassword,
        newPassword: profileNewPassword
      });
      setShowProfileModal(false);
  navigate('/');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Update failed');
    } finally {
      setProfileSaving(false);
    }
  };
  const onSearch = (e) => {
    e.preventDefault();
    const query = (q || '').trim();
    // If nothing typed and no specific category chosen, do nothing
    if (!query && (!selCategory || selCategory === 'all')) {
      setSearchFeedback('Enter a keyword or choose a category');
      return; // silently ignore or add alert if desired
    }
    // If category chosen but no query, allow category navigation
    if (!query && selCategory && selCategory !== 'all') {
      const params = new URLSearchParams();
      params.set('type', selCategory);
      navigate(`/parts?${params.toString()}`);
      setSearchFeedback('');
      return;
    }
    // Build a list of searchable strings from loaded sample to validate query
    const haystack = [];
    allPartsSample.forEach(p => {
      if (!p) return;
      ['name','model','company','brand','type'].forEach(k => { if (p[k]) haystack.push(String(p[k]).toLowerCase()); });
    });
    companies.forEach(c => haystack.push(String(c).toLowerCase()));
    types.forEach(t => haystack.push(String(t).toLowerCase()));
    const qLower = query.toLowerCase();
    const matched = haystack.some(h => h.includes(qLower));
  if (!matched) { setSearchFeedback('No matching products yet. Try another term.'); return; }
    const params = new URLSearchParams();
    params.set('keyword', query);
    if (selCategory && selCategory !== 'all') params.set('type', selCategory);
    navigate(`/parts?${params.toString()}`);
  setSearchFeedback('');
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
  bikePartsService.getParts(),
      bikePartsService.getCompanies().catch(()=>({ data:{ companies:[] }})),
      bikePartsService.getTypes().catch(()=>({ data:{ types:[] }})),
      metaService.getCompanies().catch(()=> ({ data: [] }))
    ])
      .then(([res, cRes, tRes, metaC]) => {
        const arr = Array.isArray(res.data) ? res.data : res.data.products || [];
        const sorted = [...arr].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        if (mounted) {
          setLatest(sorted.slice(0, 8));
          setAllPartsSample(arr); // keep raw sample (up to page size)
        }
        if (mounted) setCompanies(cRes.data?.companies || []);
        if (mounted) setTypes(tRes.data?.types || []);
        if (mounted) setCompanyMeta(metaC.data || []);
      })
      .catch((e) => setError(e.response?.data?.message || 'Failed to load latest products'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Handle order confirmation message from navigation state
  useEffect(() => {
    if (location.state?.message) {
      setOrderMessage({
        text: location.state.message,
        orderId: location.state.orderId,
        type: 'success'
      });

      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        setOrderMessage(null);
      }, 5000);

      // Clear the location state to prevent showing the message again on refresh
      navigate(location.pathname, { replace: true });

      return () => clearTimeout(timer);
    }
  }, [location.state, navigate, location.pathname]);

  // Load models when company selected
  useEffect(() => {
    if (!selCompany) { setCompanyModels([]); setSelModel(''); setModelParts([]); return; }
    setModelsLoading(true);
    Promise.all([
      bikePartsService.getModelsByCompany(selCompany).catch(()=> ({ data: { models: [] }})),
      metaService.getModels(selCompany).catch(()=> ({ data: [] }))
    ])
      .then(([modelsRes, metaModels]) => {
        setCompanyModels(modelsRes.data?.models || []);
        setModelMeta(metaModels.data || []);
      })
      .catch(()=> setCompanyModels([]))
      .finally(()=> setModelsLoading(false));
  }, [selCompany]);

  // Load parts for company+model
  useEffect(() => {
    if (!selCompany || !selModel) { setModelParts([]); return; }
    setModelPartsLoading(true);
    bikePartsService.getParts({ company: selCompany, model: selModel })
      .then(res => {
        const arr = Array.isArray(res.data) ? res.data : res.data.products || [];
        setModelParts(arr);
      })
      .catch(()=> setModelParts([]))
      .finally(()=> setModelPartsLoading(false));
  }, [selCompany, selModel]);

  // Scroll to models list when a company is selected
  useEffect(() => {
    if (selCompany && modelsRef.current) {
      setTimeout(() => {
        const el = modelsRef.current;
        const headerH = document.querySelector('.lp-header')?.getBoundingClientRect().height || 0;
        const extra = 24; // extra gap
        const y = el.getBoundingClientRect().top + window.scrollY - headerH - extra;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 60);
    }
  }, [selCompany]);

  // Scroll to parts list when a model is selected
  useEffect(() => {
    if (selCompany && selModel && partsRef.current) {
      setTimeout(() => {
        const el = partsRef.current;
        const headerH = document.querySelector('.lp-header')?.getBoundingClientRect().height || 0;
        const extra = 20;
        const y = el.getBoundingClientRect().top + window.scrollY - headerH - extra;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 80);
    }
  }, [selModel]);

  // Detect welcome param
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('welcome')) {
      setShowWelcome(true);
      // remove param after 4s (visual only)
      const t = setTimeout(()=> setShowWelcome(false), 4000);
      return ()=> clearTimeout(t);
    }
  }, []);

  return (
    <div className="lp-wrap">
      {showWelcome && user && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand to-brand-light text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in-down z-50">
          <span className="font-semibold">Welcome, {user.name}!</span>
          <button onClick={()=> setShowWelcome(false)} className="text-white/80 hover:text-white text-sm">✕</button>
        </div>
      )}

      {/* Order Confirmation Message */}
      {orderMessage && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in-down z-50 max-w-md text-center">
          <div>
            <div className="font-semibold text-lg">🎉 {orderMessage.text}</div>
            {orderMessage.orderId && (
              <div className="text-sm opacity-90 mt-1">Order ID: {orderMessage.orderId}</div>
            )}
          </div>
          <button 
            onClick={() => setOrderMessage(null)} 
            className="text-white/80 hover:text-white text-sm ml-2 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <header className="lp-header">
        <div className="lp-brand">Smart Bike Parts Hub</div>
  <form className="lp-search" onSubmit={onSearch}>
          <select className="lp-cats" value={selCategory} onChange={(e)=> setSelCategory(e.target.value)}>
            <option value="all">All categories</option>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input className="lp-input" placeholder="Search parts, brands, models..." value={q} onChange={(e)=> setQ(e.target.value)} />
          <button className="lp-btn" type="submit">Search</button>
        </form>
  {searchFeedback && <div className="lp-search-feedback">{searchFeedback}</div>}
        <div className="lp-actions">
          {!user ? (
            <button type="button" className="lp-link" onClick={()=> navigate('/login')}>Login / Signup</button>
          ) : (
            <div className="lp-user-menu">
              <button type="button" className="lp-link" onClick={toggleMenu}>Hello, {user.name || user.email}</button>
              {userMenuOpen && (
                <div className="lp-user-dropdown" onMouseLeave={()=> setUserMenuOpen(false)}>
                  <button type="button" onClick={()=> {navigate(user.role === 'vendor' ? '/vendor/dashboard' : (user.role === 'admin' ? '/admin/dashboard' : '/')); setUserMenuOpen(false);}}>Dashboard</button>
                  <button type="button" onClick={()=> {navigate('/cart'); setUserMenuOpen(false);}}>Cart {totalItems ? `(${totalItems})` : ''}</button>
                  <button type="button" onClick={()=> {navigate('/myorders'); setUserMenuOpen(false);}}>My Orders</button>
                  <button type="button" onClick={startEditProfile}>Update Profile</button>
                  <button type="button" onClick={()=> { logout(); setUserMenuOpen(false); }}>Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mega menu row - moved just below menu bar */}
      <nav className="lp-mega" onMouseLeave={()=> setOpenMenu('')}>
        <MegaItem label="Spares by Bike" open={openMenu==='bike'} onOpen={()=> setOpenMenu('bike')}>
          <div className="lp-panel-cols">
            {(companies.length? companies : ['BAJAJ','HERO','Honda','SUZUKI','TVS','YAMAHA','MAHINDRA','KTM','Royal Enfield','Kawasaki']).map(c => (
              <a key={c} href={`/parts?company=${encodeURIComponent(c)}`}>{c}</a>
            ))}
          </div>
        </MegaItem>
        <MegaItem label="Spares by Category" open={openMenu==='cat'} onOpen={()=> setOpenMenu('cat')}>
          <div className="lp-panel-cols">
            {(types.length? types : ['Brake Disc Caliper','Brake Disc Plate','Brake Drum','Master Cylinder','Chain Sprocket','Clutch Assembly','Fuel Injector','Rear Shock Absorber','Fork Pipe','Wheel Rim']).map(t => (
              <a key={t} href={`/parts?type=${encodeURIComponent(t)}`}>{t}</a>
            ))}
          </div>
        </MegaItem>
        <MegaItem label="Bike Body Parts" open={openMenu==='body'} onOpen={()=> setOpenMenu('body')}>
          <div className="lp-panel-cols">
            {(() => {
              const BODY_KEYWORDS = ['engine','head','side','tank','tail','silencer','sticker','kick','gear','panel','guard','light','seat','mudguard','visor'];
              // derive product (part) names from sample list
              const bodyProducts = (allPartsSample || [])
                .filter(p => {
                  const hay = [p.name, p.model, p.type, p.company, p.brand].filter(Boolean).join(' ').toLowerCase();
                  return BODY_KEYWORDS.some(k => hay.includes(k));
                })
                .map(p => ({ id: p._id, name: p.name || p.model || 'Part', type: p.type }));
              const unique = [];
              const seen = new Set();
              for (const bp of bodyProducts) {
                const key = bp.name.toLowerCase();
                if (!seen.has(key)) { seen.add(key); unique.push(bp); }
                if (unique.length >= 18) break;
              }
              if (unique.length) {
                return unique.map(p => (
                  <a key={p.id} href={`/parts?keyword=${encodeURIComponent(p.name)}`}>{p.name}</a>
                ));
              }
              // Fallback to keyword-based types if no product names matched
              const bodyTypesFromTypes = (types || []).filter(t => BODY_KEYWORDS.some(k => t?.toLowerCase().includes(k))).slice(0,12);
              if (bodyTypesFromTypes.length) {
                return bodyTypesFromTypes.map(t => <a key={t} href={`/parts?type=${encodeURIComponent(t)}`}>{t}</a>);
              }
              return <span style={{fontSize:12, color:'#475569'}}>No body part products yet</span>;
            })()}
          </div>
        </MegaItem>
        <MegaItem label="Ultra-Bright Bike LED Bulbs" open={openMenu==='led'} onOpen={()=> setOpenMenu('led')}>
          <div className="lp-panel-cols">
            {['H4 LED Bulb','H7 LED Bulb','Indicator LED','Brake Light LED'].map(t=> (
              <a key={t} href={`/parts?type=${encodeURIComponent(t)}`}>{t}</a>
            ))}
          </div>
        </MegaItem>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-content">
          <h1>Explore parts by bike model</h1>
          <p>Find quality parts from local vendors. Vendors add parts, you discover them here.</p>
          <div className="lp-cta">
            <button className="lp-cta-btn" onClick={()=> navigate('/parts')}>Shop Now</button>
          </div>
        </div>
      </section>

  {/* Latest Products section remains; explorer moved below */}

      <section className="lp-section" id="latest-products">
        <div className="lp-section-head">
          <h2>Latest Products</h2>
          <button className="lp-link subtle" onClick={() => navigate('/parts')}>View all</button>
        </div>
        {loading && <div className="lp-products-loading">Loading products…</div>}
        {error && !loading && <div className="lp-products-error">{error}</div>}
        {!loading && !error && latest.length > 0 && (
          <div className="lp-carousel">
            <Carousel
              items={latest}
              autoPlayMs={3000}
              renderItem={(p)=> (
                <article className="lp-card lp-card--carousel" onClick={() => navigate('/parts')}>
                  {p.images?.[0] ? (
                    <img alt={p.name || p.model || 'part'} src={ensureAbsolute(p.images[0])} className="lp-carousel-img" />
                  ) : (
                    <div className="lp-card-img lp-card-img--placeholder lp-carousel-img">No Image</div>
                  )}
                  <div className="lp-card-body lp-card-body--carousel" style={{textAlign:'center'}}>
                    <h3 className="lp-card-title">{p.name || p.model}</h3>
                    <div className="lp-card-sub">{p.brand || p.company} • {(p.type || 'Part')}</div>
                    <div className="lp-card-meta" style={{justifyContent:'center', gap:12}}>
                      <Stars value={Number(p.rating) || 0} count={p.numReviews || 0} />
                      <div className="lp-price">{formatINR(p.price)}</div>
                    </div>
                  </div>
                </article>
              )}
            />
          </div>
        )}
        {/* Removed grid of products per request */}
      </section>

      {/* Company -> Model -> Parts explorer moved below carousel */}
  <section className="lp-section lp-browse" id="browse-by-bike">
        <div className="lp-section-head" style={{marginBottom: '0.5rem'}}>
          <h2 style={{marginBottom:0}}>Browse by Bike</h2>
          {selCompany && selModel && (
            <button className="lp-link subtle" onClick={()=> navigate(`/parts?company=${encodeURIComponent(selCompany)}&model=${encodeURIComponent(selModel)}`)}>Open Parts Page</button>
          )}
        </div>
        <div className="lp-row-scroll brands">
          {(companies.length ? companies : ['BAJAJ','HERO','Honda','SUZUKI','TVS','YAMAHA','MAHINDRA','KTM','Royal Enfield']).map(c => {
            const meta = companyMeta.find(m => m.company === c);
            const img = meta?.image;
            const active = c === selCompany;
            return (
              <button key={c} type="button" className={`brand-card ${active ? 'active' : ''}`} onClick={()=> setSelCompany(prev => prev===c? '' : c)} title={c}>
                {img ? <img src={ensureAbsolute(img)} alt={c} loading="lazy" /> : <div className="brand-fallback">{c[0]}</div>}
                <span className="label">{c}</span>
              </button>
            );
          })}
        </div>
        {selCompany && (
          <div style={{marginTop:'0.65rem'}} ref={modelsRef}>
            <div style={{fontWeight:800, color:'#0a2aa7', marginBottom:6}}>Models {modelsLoading && <span style={{fontWeight:400, fontSize:12}}>Loading…</span>}</div>
            <div className="lp-row-scroll models">
              {companyModels.map(m => {
                const active = m === selModel;
                const meta = modelMeta.find(mm => mm.model === m);
                const img = meta?.image;
                return (
                  <button key={m} type="button" className={`model-card ${active? 'active' : ''}`} onClick={()=> setSelModel(prev => prev===m? '' : m)}>
                    {img ? <img src={ensureAbsolute(img)} alt={m} loading="lazy" /> : <div className="model-fallback">{m.split(/\s+/).slice(0,2).join(' ')}</div>}
                    <span className="label" title={m}>{m}</span>
                  </button>
                );
              })}
              {!companyModels.length && !modelsLoading && <div style={{padding:'4px 8px', fontSize:12, color:'#475569'}}>No models found</div>}
            </div>
          </div>
        )}
        {selCompany && selModel && (
          <div style={{marginTop:'0.8rem'}} ref={partsRef}>
            <div className="lp-section-head" style={{marginBottom: '0.4rem'}}>
              <h3 style={{margin:0,fontSize:'1.05rem'}}>Parts for {selModel}</h3>
              {modelParts.length > 0 && <div style={{fontSize:12, color:'#475569'}}>{modelParts.length} item{modelParts.length===1?'':'s'}</div>}
            </div>
            {modelPartsLoading && <div className="lp-products-loading" style={{padding:'0.4rem 0'}}>Loading parts…</div>}
            {!modelPartsLoading && !modelParts.length && <div className="lp-products-empty" style={{padding:'0.4rem 0'}}>No parts found for this model.</div>}
            {!modelPartsLoading && modelParts.length > 0 && (
              <div className="lp-products-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))'}}>
                {modelParts.slice(0,12).map(p => (
                  <article key={p._id} className="lp-card" onClick={() => navigate(`/parts?company=${encodeURIComponent(selCompany)}&model=${encodeURIComponent(selModel)}`)}>
                    {p.images?.[0] ? (
                      <img alt={p.name || p.model || 'part'} src={ensureAbsolute(p.images[0])} className="lp-card-img" />
                    ) : (
                      <div className="lp-card-img lp-card-img--placeholder">No Image</div>
                    )}
                    <div className="lp-card-body">
                      <h3 className="lp-card-title" style={{fontSize:'.9rem'}}>{p.name || p.model}</h3>
                      <div className="lp-card-sub" style={{fontSize:'.7rem'}}>{p.brand || p.company} • {(p.type || 'Part')}</div>
                      {p.description && (
                        <div className="lp-card-desc" style={{fontSize:'.65rem', color:'#475569', marginTop:4}}>
                          {p.description.length > 70 ? p.description.slice(0,70) + '…' : p.description}
                        </div>
                      )}
                      <div className="lp-card-meta" style={{marginTop:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <Stars value={Number(p.rating)||0} count={p.numReviews||0} />
                        </div>
                        <div className="lp-price" style={{fontSize:'.8rem'}}>{formatINR(p.price)}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
  {showProfileModal && (
        <div className="lp-modal-backdrop" onClick={(e)=> { if (e.target === e.currentTarget) setShowProfileModal(false); }}>
          <form className="lp-modal" onSubmit={submitProfile}>
    <h3>Update Profile</h3>
    <input value={profileName} onChange={e=> setProfileName(e.target.value)} placeholder="Name" required />
    <input value={profileEmail} onChange={e=> setProfileEmail(e.target.value)} placeholder="Email" type="email" required />
    <div style={{fontSize:12,color:'#475569'}}>To change email or password, enter current password.</div>
    <input value={profileCurrentPassword} onChange={e=> setProfileCurrentPassword(e.target.value)} placeholder="Current Password" type="password" />
    <input value={profileNewPassword} onChange={e=> setProfileNewPassword(e.target.value)} placeholder="New Password" type="password" />
            <div className="lp-modal-actions" style={{display:'flex', gap:12, justifyContent:'flex-end', marginTop:8}}>
              <button type="submit" className="lp-btn" style={{padding:'0.55rem 1.1rem', fontWeight:600, background:'#0a2aa7', color:'#fff', border:'1px solid #0a2aa7', borderRadius:10}} disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Submit'}</button>
              <button type="button" className="lp-link subtle" style={{padding:'0.55rem 1.1rem', border:'1px solid #0a2aa7', borderRadius:10}} onClick={()=> setShowProfileModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

function Stars({ value = 0, count = 0 }) {
  const full = Math.round(value);
  return (
    <div className="lp-stars" title={`${value.toFixed?.(1) || value} • ${count} reviews`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? 'on' : ''}>★</span>
      ))}
      <span className="lp-reviews">{count}</span>
    </div>
  );
}

function ensureAbsolute(url) {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return `http://localhost:5000${url}`;
}

function MegaItem({ label, children, open, onOpen }){
  return (
    <div className={`lp-mega-item ${open?'open':''}`} onMouseEnter={onOpen}>
      <button type="button" className="lp-mega-btn">{label} <span className="caret">▾</span></button>
      {open && (
        <div className="lp-mega-panel">
          {children}
        </div>
      )}
    </div>
  );
}

export default LandingPage;
