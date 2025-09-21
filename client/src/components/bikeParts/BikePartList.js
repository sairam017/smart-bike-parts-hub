import React, { useEffect, useState, useContext, useCallback } from 'react';
import relatedMap from '../../utils/relatedParts';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import bikePartsService from '../../services/bikePartsService';
import LocationContext from '../../context/LocationContext';
import './bikeParts.css';
import { formatINR } from '../../utils/currency';

const BikePartList = () => {
    const [parts, setParts] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [types, setTypes] = useState([]);
    const [years, setYears] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { location: userLoc } = useContext(LocationContext) || {};
    const [distanceCache, setDistanceCache] = useState({});
    const [prefShopProductId, setPrefShopProductId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const location = useLocation();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');


    // All hooks must be called at the top level, never conditionally
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const c = params.get('company') || '';
        const t = params.get('type') || '';
        const m = params.get('model') || '';
        const y = params.get('year') || '';
        const kw = params.get('keyword') || '';
        setSelectedCompany(c);
        setSelectedType(t);
        setSelectedModel(m);
        setSelectedYear(y);
        setSearchTerm(kw);
        setLoading(true);
        Promise.all([
            bikePartsService.getCompanies(),
            bikePartsService.getTypes(),
            bikePartsService.getYears(),
            bikePartsService.getParts({ company: c || undefined, type: t || undefined, model: m || undefined }),
        ])
        .then(([cRes, tRes, yRes, pRes]) => {
            setCompanies(cRes.data?.companies || []);
            setTypes(tRes.data?.types || []);
            setYears(yRes.data?.years || []);
            const data = pRes.data;
            setParts(Array.isArray(data) ? data : data.products || []);
        })
        .catch(err => setError(err.response?.data?.message || 'Failed to load'))
        .finally(()=> setLoading(false));
    }, [location.search]);

    useEffect(() => {
        if (!selectedCompany) {
            setModels([]);
            return;
        }
        setLoading(true);
        bikePartsService.getModelsByCompany(selectedCompany)
            .then(r => setModels(r.data?.models || []))
            .catch(err => setError(err.response?.data?.message || 'Failed to load models'))
            .finally(()=> setLoading(false));
    }, [selectedCompany]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const keyword = params.get('keyword') || undefined;
        const filters = { ...(keyword ? { keyword } : {}) };
        if (selectedCompany) filters.company = selectedCompany;
        if (selectedType) filters.type = selectedType;
        if (selectedModel) filters.model = selectedModel;
        if (selectedYear) filters.year = selectedYear;
        setLoading(true);
        bikePartsService.getParts(filters)
            .then(response => {
                const data = response.data;
                setParts(Array.isArray(data) ? data : data.products || []);
            })
            .catch(err => setError(err.response?.data?.message || 'Failed to load parts'))
            .finally(()=> setLoading(false));
    }, [selectedCompany, selectedModel, selectedType, selectedYear, location.search]);

    const haversineKm = (lat1, lon1, lat2, lon2) => {
        const toRad = (v) => v * Math.PI / 180;
        const R = 6371;
        const dLat = toRad(lat2-lat1);
        const dLon = toRad(lon2-lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const computeDistanceFor = useCallback((part) => {
        if (!userLoc || !part?.shop?.location?.coordinates) return null;
        const [lng, lat] = part.shop.location.coordinates;
        const km = haversineKm(userLoc.latitude, userLoc.longitude, lat, lng);
        return km;
    }, [userLoc]);

    useEffect(() => {
        if (!userLoc) return;
        const next = {};
        parts.forEach(p => {
            const d = computeDistanceFor(p);
            if (d != null) next[p._id] = d;
        });
        setDistanceCache(next);
        const entries = Object.entries(next).sort((a,b)=> a[1]-b[1]);
        if (entries.length) setPrefShopProductId(entries[0][0]);
    }, [userLoc, parts, computeDistanceFor]);

    // Only after all hooks, handle conditional rendering
    if (loading) {
        return <div className="parts-wrap">Loading products... If this takes too long, please check your connection or try again.</div>;
    }
    if (error) {
        return <div className="parts-wrap" style={{ color: 'red' }}>{error}</div>;
    }

    // Removed Add to Cart & related suggestion logic per request

    // Removed openMaps & map modal logic (unused)

    // Quick order removed in cleanup; ordering handled in product detail page

    if (loading) return <div className="parts-wrap">Loading...</div>;
    if (error) return <div className="parts-wrap" style={{ color: 'red' }}>{error}</div>;

    return (
        <div className="parts-wrap" style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
            {/* Horizontal Filters */}
            <div style={{background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'0.75rem', boxShadow:'0 6px 18px rgba(2,6,23,.06)', display:'flex', flexWrap:'wrap', gap:'0.5rem', alignItems:'center'}}>
                <span style={{fontWeight:800, color:'#0a2aa7'}}>Filter:</span>
                <form onSubmit={e=> { e.preventDefault();
                    const params = new URLSearchParams(location.search);
                    if (searchTerm) params.set('keyword', searchTerm); else params.delete('keyword');
                    navigate({ pathname: '/parts', search: params.toString() });
                }} style={{display:'flex', gap:6, alignItems:'center'}}>
                    <input value={searchTerm} onChange={e=> setSearchTerm(e.target.value)} placeholder="Search part name" style={{padding:'6px 10px', border:'1px solid #cbd5e1', borderRadius:8, fontSize:'.8rem'}} />
                    <button type="submit" className="btn-outline" style={{padding:'6px 12px'}}>Search</button>
                </form>
                <select value={selectedType} onChange={e=> setSelectedType(e.target.value)} style={selStyle}>
                    <option value="">Type</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {/* Brand filter removed */}
                <select value={selectedCompany} onChange={e=> { setSelectedCompany(e.target.value); setSelectedModel(''); }} style={selStyle}>
                    <option value="">Company</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={selectedModel} onChange={e=> setSelectedModel(e.target.value)} disabled={!selectedCompany} style={selStyle}>
                    <option value="">Model{!selectedCompany?' (select company)':''}</option>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={selectedYear} onChange={e=> setSelectedYear(e.target.value)} style={selStyle}>
                    <option value="">Year</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={()=> { setSelectedType(''); setSelectedCompany(''); setSelectedModel(''); setSelectedYear(''); setSearchTerm('');
                    const params = new URLSearchParams();
                    navigate({ pathname: '/parts', search: params.toString() });
                 }} className="btn-outline" style={{padding:'6px 12px'}}>Reset</button>
                <div style={{marginLeft:'auto', fontSize:12, color:'#475569'}}>Showing {parts.length} items</div>
            </div>

            {/* Parts Grid */}
            <section>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 0 .5rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                        <h2 style={{margin:0}}>Available Parts</h2>
                        <button
                            disabled={!selectedIds.length}
                            style={{padding:'8px 18px', borderRadius:8, background:'#1d4ed8', color:'#fff', fontWeight:600, border:'none', fontSize:'1rem'}}
                            onClick={() => {
                                const selectedParts = parts.filter(p => selectedIds.includes(p._id));
                                if (selectedParts.length === 1) {
                                    // Only one selected, go to its detail page
                                    navigate(`/product/${selectedParts[0]._id}`);
                                } else if (selectedParts.length > 1) {
                                    // Multiple selected, pass all IDs in state
                                    navigate(`/product/${selectedParts[0]._id}`, { state: { selectedIds: selectedParts.map(p => p._id) } });
                                }
                                // Recommendations will be fetched on the product detail page
                            }}
                        >Get Confirm</button>
                    </div>
                    {recommendations.length > 0 && (
                        <div style={{marginLeft:'2rem', background:'#f1f5f9', padding:'0.5rem 1rem', borderRadius:10}}>
                            <h4 style={{margin:'0 0 8px', fontSize:'1rem'}}>Related Items</h4>
                            <ul style={{margin:0, paddingLeft:18}}>
                                {recommendations.map(r => <li key={r} style={{fontSize:'.95rem'}}>{r}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
                {!parts.length && <p>No parts found{searchTerm?` for "${searchTerm}"`:''}.</p>}
                <div className="parts-list">
                    {parts.map(part => {
                        const distanceKm = distanceCache[part._id];
                        const highlight = part._id === prefShopProductId;
                        const checked = selectedIds.includes(part._id);
                        return (
                            <div key={part._id} className="part-card compact" style={highlight ? {outline:'2px solid #1d4ed8'} : {}}>
                                <div style={{display:'flex', alignItems:'center', gap:6}}>
                                    <input type="checkbox" checked={checked} onChange={e => {
                                        setSelectedIds(ids => e.target.checked ? [...ids, part._id] : ids.filter(id => id !== part._id));
                                    }} />
                                    <Link to={`/product/${part._id}`} style={{display:'block', flex:1}}>
                                        {part.images?.length ? (
                                            <img alt={part.model || part.name || 'part'} src={ensureAbsolute(part.images[0])} style={{width:'100%', height:110, objectFit:'contain', background:'#f1f5f9', borderRadius:8}} />
                                        ) : (
                                            <div style={{width:'100%', height:110, background:'#f1f5f9', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12}}>No Image</div>
                                        )}
                                    </Link>
                                </div>
                                <h4 style={{marginTop:4, fontSize:'.7rem'}}>{part.name || part.model}</h4>
                                <div className="part-meta" style={{fontSize:'.6rem'}}>{part.company ? part.company+' • ' : ''}{part.model || (part.type || 'Part')}{part.vehicleYear ? ' • '+part.vehicleYear : ''} <span className="part-price" style={{fontSize:'.5rem'}}>{formatINR(part.price)}</span></div>
                                {distanceKm != null && (
                                    <div style={{marginTop:4, fontSize:'.5rem', color:'#1e293b', display:'flex', gap:4, alignItems:'center'}}>
                                        <span style={{background: highlight? '#1d4ed8':'#e2e8f0', color: highlight? '#fff':'#0f172a', padding:'2px 6px', borderRadius:20}}>{distanceKm.toFixed(1)} km</span>
                                        {highlight && <span style={{color:'#1d4ed8', fontWeight:600}}>Nearest</span>}
                                    </div>
                                )}
                                {part.description && <ExpandableMini text={part.description} />}
                            </div>
                        );
                    })}
                </div>
            </section>
            {/* Map modal removed */}
    {/* Toasts removed with action buttons */}
        </div>
    );
};

function ensureAbsolute(url){
    if (!url) return url;
    if (url.startsWith('http')) return url;
    // Point to local server files
    return `http://localhost:5000${url}`;
}

const selStyle = { padding:'6px 10px', border:'1px solid #cbd5e1', borderRadius:8, background:'#fff', fontSize:'.8rem' };

export default BikePartList;
 
// (Removed unused ExpandableText component in cleanup)

// Compact expandable for cards
function ExpandableMini({ text }){
    const [open, setOpen] = React.useState(false);
    const limit = 80;
    if (!text) return null;
    if (text.length <= limit) return <p style={{margin:'4px 0 0', fontSize:'.55rem', lineHeight:1.2, color:'#475569'}}>{text}</p>;
    return (
        <div style={{marginTop:4}}>
            <p style={{margin:0, fontSize:'.55rem', lineHeight:1.2, color:'#475569'}}>
                {open ? text : text.slice(0,limit)+'…'}
            </p>
            <button onClick={()=> setOpen(o=>!o)} style={{background:'none', border:'none', color:'#1d4ed8', fontSize:'.55rem', padding:0, cursor:'pointer'}}>
                {open? 'View less' : 'View more'}
            </button>
        </div>
    );
}
