import React, { useEffect, useState, useContext, useCallback, useMemo, useRef } from 'react';
import relatedMap from '../../utils/relatedParts';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import bikePartsService from '../../services/bikePartsService';
import LocationContext from '../../context/LocationContext';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import './bikeParts.css';
import { formatINR } from '../../utils/currency';
import { calculateDistanceToShop, formatDistance, debugDistance } from '../../utils/distanceUtils';
import OrderModal from '../orders/OrderModal';
import mapsService from '../../services/mapsService';
import ProductMap from '../maps/ProductMap';

const BikePartList = () => {
    // Debug: Log when component re-renders (disabled for production)
    // console.log('BikePartList render at:', new Date().toLocaleTimeString());
    
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
    
    // Location tracking with stabilization to prevent GPS fluctuation re-renders
    const { location: rawUserLoc } = useContext(LocationContext) || {};
    const [stableUserLoc, setStableUserLoc] = useState(null);
    const lastLocationRef = useRef(null);
    
    useEffect(() => {
        if (!rawUserLoc) {
            setStableUserLoc(null);
            return;
        }
        
        // If this is the first location, use it immediately
        if (!lastLocationRef.current) {
            setStableUserLoc(rawUserLoc);
            lastLocationRef.current = rawUserLoc;
            return;
        }
        
        // Only update if significant movement (>50m) to prevent GPS fluctuation re-renders
        const distance = calculateDistanceToShop(lastLocationRef.current, [rawUserLoc.longitude, rawUserLoc.latitude]);
        if (distance > 0.05) { // 50 meters threshold
            console.log('[Location] Significant movement detected:', (distance * 1000).toFixed(0), 'm');
            setStableUserLoc(rawUserLoc);
            lastLocationRef.current = rawUserLoc;
        }
    }, [rawUserLoc]);
    
    const userLoc = stableUserLoc;
    const [distanceCache, setDistanceCache] = useState({});
    const [prefShopProductId, setPrefShopProductId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const location = useLocation();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    
    // Cart and Auth
    const { user } = useAuth();
    const { dispatch: cartDispatch } = useCart();
    
    // Image preview state
    const [hoveredProduct, setHoveredProduct] = useState(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Throttle mouse movement to prevent excessive re-renders
    const throttleTimer = useRef(null);
    const updateMousePosition = useCallback((x, y) => {
        if (throttleTimer.current) return;
        
        throttleTimer.current = setTimeout(() => {
            setMousePosition({ x, y });
            throttleTimer.current = null;
        }, 100); // More aggressive throttling to prevent blinking
    }, []);


    
    // Order modal state (used by individual part order buttons)
    const [showOrderModal, setShowOrderModal] = useState(false);
    

    const [orderSuccess, setOrderSuccess] = useState(false);
    
    // Shop locations for selected parts
    const [selectedPartsShops, setSelectedPartsShops] = useState([]);
    const [loadingShops, setLoadingShops] = useState(false);
    const [showMapView, setShowMapView] = useState(false);

    // Quick add to cart function
    const quickAddToCart = (part) => {
        if (!user) {
            alert('Please login to add items to cart');
            navigate('/login');
            return;
        }
        
        cartDispatch({
            type: 'ADD_TO_CART',
            payload: {
                id: part._id,
                name: part.name || part.model,
                price: part.price,
                image: part.images?.[0] || null,
                qty: 1
            }
        });
        
        alert('Added to cart!');
    };


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
            const productsArray = Array.isArray(data) ? data : data.products || [];
            setParts(productsArray);
        })
        .catch(err => {
            console.error('Loading error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load');
        })
        .finally(()=> setLoading(false));
    }, [location.search]);

    useEffect(() => {
        if (!selectedCompany) {
            setModels([]);
            return;
        }
        setLoading(true);
        bikePartsService.getModelsByCompany(selectedCompany)
            .then(r => {
                setModels(r.data?.models || []);
            })
            .catch(err => {
                console.error('Failed to load models:', err);
                setError(err.response?.data?.message || err.message || 'Failed to load models');
            })
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
                const productsArray = Array.isArray(data) ? data : data.products || [];
                setParts(productsArray);
            })
            .catch(err => {
                console.error('Failed to load filtered parts:', err);
                setError(err.response?.data?.message || err.message || 'Failed to load parts');
            })
            .finally(()=> setLoading(false));
    }, [selectedCompany, selectedModel, selectedType, selectedYear, location.search]);

    const computeDistanceFor = useCallback((part) => {
        if (!userLoc || !part?.shop?.location?.coordinates) return null;
        const distance = calculateDistanceToShop(userLoc, part.shop.location.coordinates);
        debugDistance('BikePartList', userLoc, part.shop.location.coordinates, distance);
        return distance;
    }, [userLoc]);

    // Memoize parts calculation to prevent unnecessary re-calculations
    const partsWithIds = useMemo(() => parts.map(p => ({ id: p._id, shop: p.shop })), [parts]);

    useEffect(() => {
        if (!userLoc || !partsWithIds.length) {
            setDistanceCache({});
            setPrefShopProductId(null);
            return;
        }
        
        console.log('Distance calculation triggered, userLoc accuracy:', userLoc.accuracy);
        
        const next = {};
        partsWithIds.forEach(({ id, shop }) => {
            if (!shop?.location?.coordinates) return;
            const distance = calculateDistanceToShop(userLoc, shop.location.coordinates);
            // Round to nearest 10m to prevent tiny fluctuations from causing re-renders
            if (distance != null) next[id] = Math.round(distance * 100) / 100;
        });
        
        setDistanceCache(prev => {
            // Check if there are actual changes without expensive JSON.stringify
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            
            if (prevKeys.length !== nextKeys.length) {
                console.log('Distance cache updated: different number of entries');
                return next;
            }
            
            for (const key of nextKeys) {
                if (Math.abs((prev[key] || 0) - (next[key] || 0)) > 0.01) { // Only update if difference > 10m
                    console.log('Distance cache updated: significant distance change');
                    return next;
                }
            }
            
            console.log('Distance cache not updated: no significant changes');
            return prev; // No changes
        });
        
        const entries = Object.entries(next).sort((a,b)=> a[1]-b[1]);
        if (entries.length) {
            setPrefShopProductId(prev => prev !== entries[0][0] ? entries[0][0] : prev);
        }
    }, [userLoc, partsWithIds]); // Remove computeDistanceFor dependency

    // Cleanup throttle timer on unmount
    useEffect(() => {
        return () => {
            if (throttleTimer.current) {
                clearTimeout(throttleTimer.current);
            }
        };
    }, []);

    // Memoize the parts display to prevent unnecessary re-renders
    const partsDisplay = useMemo(() => {
        return parts.map((part) => {
            const distance = distanceCache[part._id];
            const isSelected = selectedIds.includes(part._id);
            const isPref = prefShopProductId === part._id;
            
            // Create stable object reference only when values actually change
            return {
                _id: part._id,
                name: part.name,
                model: part.model,
                company: part.company,
                price: part.price,
                images: part.images,
                description: part.description,
                shop: part.shop,
                type: part.type,
                vehicleYear: part.vehicleYear,
                countInStock: part.countInStock,
                distance: distance,
                isSelected: isSelected,
                isPref: isPref
            };
        });
    }, [parts, distanceCache, selectedIds, prefShopProductId]);





    const handleOrderSuccess = (orderResult) => {
        setOrderSuccess(true);
        setSelectedIds([]); // Clear selected items
        
        // Show success message
        setTimeout(() => {
            setOrderSuccess(false);
        }, 5000);
    };

    // Get selected products for order
    const selectedProducts = parts.filter(part => selectedIds.includes(part._id)).map(part => ({
        ...part,
        quantity: 1 // Default quantity, can be made dynamic later
    }));

    const currentUserLocation = useMemo(() => 
        userLoc ? {
            lat: userLoc.latitude,
            lng: userLoc.longitude
        } : null, 
        [userLoc?.latitude, userLoc?.longitude]
    );

    // Debounced fetch shop locations for selected parts to prevent rapid API calls
    const debounceTimer = useRef(null);
    useEffect(() => {
        if (selectedIds.length === 0) {
            setSelectedPartsShops([]);
            setLoadingShops(false);
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
            return;
        }

        // Clear existing timer
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Set loading state immediately for better UX
        setLoadingShops(true);

        // Debounce the API call by 300ms
        debounceTimer.current = setTimeout(async () => {
            try {
                const shopsData = await mapsService.getShopsForProducts(selectedIds);
                const formattedShops = mapsService.formatShopsForMap(shopsData, currentUserLocation);
                
                // Sort by distance if user location is available
                if (currentUserLocation) {
                    formattedShops.sort((a, b) => (a.distance || 0) - (b.distance || 0));
                }
                
                setSelectedPartsShops(formattedShops);
            } catch (error) {
                console.error('Error fetching shops for selected parts:', error);
                setSelectedPartsShops([]);
            } finally {
                setLoadingShops(false);
            }
        }, 300); // 300ms debounce

        // Cleanup function
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
        };
    }, [selectedIds, currentUserLocation]);

    // Memoized checkbox handler to prevent re-renders
    const handleCheckboxChange = useCallback((partId, checked) => {
        setSelectedIds(ids => checked ? [...ids, partId] : ids.filter(id => id !== partId));
    }, []);

    // Only after all hooks, handle conditional rendering
    if (loading) {
        return <div className="parts-wrap">Loading products... If this takes too long, please check your connection or try again.</div>;
    }
    if (error) {
        return <div className="parts-wrap" style={{ color: 'red' }}>{error}</div>;
    }

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

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
                    {selectedIds.length > 0 && (
                        <div style={{
                            background: '#ecfdf5',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#047857',
                            fontWeight: '600',
                            border: '1px solid #d1fae5'
                        }}>
                            ✓ {selectedIds.length} selected for order
                        </div>
                    )}
                    <div style={{ fontSize: 12, color: '#475569' }}>
                        Showing {parts.length} items
                    </div>
                </div>
            </div>

            {/* Parts Grid */}
            <section>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 0 .5rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                        <h2 style={{margin:0}}>Available Parts</h2>
                        
                        {/* Get Recommendations Button */}
                        <GetRecommendationsButton 
                            selectedIds={selectedIds}
                            parts={parts}
                            navigate={navigate}
                        />
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
                
                {/* Shop Locations for Selected Parts */}
                {selectedIds.length > 0 && (
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🏪 Shop Locations for Selected Parts
                                <span style={{ 
                                    background: '#3b82f6', 
                                    color: 'white', 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    fontSize: '0.8rem' 
                                }}>
                                    {selectedIds.length} selected
                                </span>
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {currentUserLocation && (
                                    <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                                        📍 Sorted by distance from your location
                                    </div>
                                )}
                                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
                                    <button
                                        onClick={() => setShowMapView(false)}
                                        style={{
                                            padding: '6px 12px',
                                            fontSize: '0.8rem',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            background: !showMapView ? '#3b82f6' : 'transparent',
                                            color: !showMapView ? 'white' : '#6b7280'
                                        }}
                                    >
                                        📋 List View
                                    </button>
                                    <button
                                        onClick={() => setShowMapView(true)}
                                        style={{
                                            padding: '6px 12px',
                                            fontSize: '0.8rem',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            background: showMapView ? '#3b82f6' : 'transparent',
                                            color: showMapView ? 'white' : '#6b7280'
                                        }}
                                    >
                                        🗺️ Map View
                                    </button>
                                </div>
                            </div>
                        </div>

                        {loadingShops ? (
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                padding: '20px',
                                color: '#6b7280' 
                            }}>
                                <div style={{ marginRight: '8px' }}>🔄</div>
                                Loading shop locations...
                            </div>
                        ) : selectedPartsShops.length > 0 ? (
                            showMapView ? (
                                // Map View
                                <div style={{ 
                                    height: '500px', 
                                    borderRadius: '8px', 
                                    overflow: 'visible', 
                                    border: '1px solid #e5e7eb',
                                    position: 'relative',
                                    width: '100%',
                                    display: 'block'
                                }}>
                                    <ProductMap
                                        shops={selectedPartsShops}
                                        userLocation={currentUserLocation}
                                        selectedParts={selectedIds.map(id => parts.find(p => p._id === id)).filter(Boolean)}
                                        showShopInfo={true}
                                    />
                                </div>
                            ) : (
                                // Card View
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                                    {selectedPartsShops.map((shop, index) => (
                                        <div key={shop._id || index} style={{
                                            background: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            transition: 'all 0.2s ease',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.transform = 'translateY(0px)';
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1f2937' }}>
                                                    {shop.name}
                                                </h4>
                                                {shop.distance && (
                                                    <div style={{
                                                        background: index === 0 ? '#10b981' : '#3b82f6',
                                                        color: 'white',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600'
                                                    }}>
                                                        {shop.distance.toFixed(2)} km
                                                        {index === 0 && ' (Nearest)'}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div style={{ marginBottom: '8px' }}>
                                                <p style={{ margin: '2px 0', fontSize: '0.875rem', color: '#6b7280' }}>
                                                    📍 {shop.address || 'Address not available'}
                                                </p>
                                                {shop.phone && (
                                                    <p style={{ margin: '2px 0', fontSize: '0.875rem', color: '#6b7280' }}>
                                                        📞 {shop.phone}
                                                    </p>
                                                )}
                                                <p style={{ margin: '2px 0', fontSize: '0.875rem', color: '#6b7280' }}>
                                                    📦 {shop.productCount || 0} products available
                                                </p>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                <button
                                                    onClick={() => {
                                                        const url = `https://www.google.com/maps?q=${shop.lat},${shop.lng}`;
                                                        window.open(url, '_blank');
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '6px 12px',
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: '500',
                                                        cursor: 'pointer',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                                                    onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                                                >
                                                    🗺️ View on Map
                                                </button>
                                                
                                                {currentUserLocation && (
                                                    <button
                                                        onClick={() => {
                                                            const url = `https://www.google.com/maps/dir/${currentUserLocation.lat},${currentUserLocation.lng}/${shop.lat},${shop.lng}`;
                                                            window.open(url, '_blank');
                                                        }}
                                                        style={{
                                                            flex: 1,
                                                            padding: '6px 12px',
                                                            background: '#10b981',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '500',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.background = '#059669'}
                                                        onMouseLeave={(e) => e.target.style.background = '#10b981'}
                                                    >
                                                        🧭 Get Directions
                                                    </button>
                                                )}
                                            </div>

                                            {/* Show coordinates for debugging */}
                                            <div style={{ 
                                                marginTop: '8px', 
                                                fontSize: '0.75rem', 
                                                color: '#9ca3af',
                                                fontFamily: 'monospace'
                                            }}>
                                                📐 {shop.lat?.toFixed(4)}, {shop.lng?.toFixed(4)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div style={{
                                textAlign: 'center',
                                padding: '20px',
                                color: '#6b7280'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
                                <p style={{ margin: 0 }}>No shops found with selected products</p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem' }}>
                                    Try selecting different products or check availability
                                </p>
                            </div>
                        )}

                        {!currentUserLocation && (
                            <div style={{
                                marginTop: '12px',
                                padding: '8px 12px',
                                background: '#fef3c7',
                                border: '1px solid #fbbf24',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                color: '#92400e'
                            }}>
                                💡 <strong>Tip:</strong> Enable location access to see distances and get directions to shops
                            </div>
                        )}
                    </div>
                )}
                
                {/* Parts Grid */}
                <div className="parts-list">
                    {partsDisplay.map(part => {
                        return (
                            <div key={part._id} className="part-card compact" style={part.isPref ? {outline:'2px solid #1d4ed8'} : {}}>
                                <div style={{display:'flex', alignItems:'center', gap:6}}>
                                    <input 
                                        type="checkbox" 
                                        checked={part.isSelected} 
                                        onChange={e => handleCheckboxChange(part._id, e.target.checked)} 
                                    />
                                    <Link to={`/product/${part._id}`} style={{display:'block', flex:1, position:'relative'}}>
                                        {part.images?.length ? (
                                            <>
                                                <img 
                                                    alt={part.model || part.name || 'part'} 
                                                    src={ensureAbsolute(part.images[0])} 
                                                    style={{
                                                        width:'100%', 
                                                        height:110, 
                                                        objectFit:'contain', 
                                                        background:'#f1f5f9', 
                                                        borderRadius:8,
                                                        transition: 'transform 0.2s',
                                                        cursor: 'pointer'
                                                    }} 
                                                    onMouseEnter={(e) => {
                                                        e.target.style.transform = 'scale(1.02)';
                                                        if (part.images.length > 1) {
                                                            setHoveredProduct(part);
                                                            updateMousePosition(e.clientX, e.clientY);
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.target.style.transform = 'scale(1)';
                                                        setHoveredProduct(null);
                                                    }}
                                                    onMouseMove={(e) => {
                                                        if (part.images.length > 1 && hoveredProduct) {
                                                            updateMousePosition(e.clientX, e.clientY);
                                                        }
                                                    }}
                                                />
                                                {/* Multiple images indicator */}
                                                {part.images.length > 1 && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        background: 'rgba(0, 0, 0, 0.7)',
                                                        color: 'white',
                                                        fontSize: '0.7rem',
                                                        padding: '2px 6px',
                                                        borderRadius: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '2px'
                                                    }}>
                                                        📷 {part.images.length}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div style={{width:'100%', height:110, background:'#f1f5f9', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12}}>No Image</div>
                                        )}
                                    </Link>
                                </div>
                                <h4 style={{marginTop:4, fontSize:'.7rem'}}>{part.name || part.model}</h4>
                                <div className="part-meta" style={{fontSize:'.6rem'}}>{part.company ? part.company+' • ' : ''}{part.model || (part.type || 'Part')}{part.vehicleYear ? ' • '+part.vehicleYear : ''} <span className="part-price" style={{fontSize:'.5rem'}}>{formatINR(part.price)}</span></div>
                                {part.distance != null && (
                                    <div style={{marginTop:4, fontSize:'.5rem', color:'#1e293b', display:'flex', gap:4, alignItems:'center'}}>
                                        <span style={{background: part.isPref? '#1d4ed8':'#e2e8f0', color: part.isPref? '#fff':'#0f172a', padding:'2px 6px', borderRadius:20}}>{formatDistance(part.distance)}</span>
                                        {part.isPref && <span style={{color:'#1d4ed8', fontWeight:600}}>Nearest</span>}
                                    </div>
                                )}
                                {part.description && <ExpandableMini text={part.description} />}
                                
                                {/* Action Buttons */}
                                <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            quickAddToCart(part);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '6px 8px',
                                            background: '#1d4ed8',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.6rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = '#1e40af'}
                                        onMouseLeave={(e) => e.target.style.background = '#1d4ed8'}
                                    >
                                        🛒 Cart
                                    </button>
                                    
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (!user) {
                                                alert('Please login to place orders');
                                                navigate('/login');
                                                return;
                                            }
                                            setSelectedIds([part._id]);
                                            setShowOrderModal(true);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '6px 8px',
                                            background: '#059669',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.6rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = '#047857'}
                                        onMouseLeave={(e) => e.target.style.background = '#059669'}
                                    >
                                        � Order
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
            
            {/* Image Preview Tooltip */}
            {hoveredProduct && hoveredProduct.images && hoveredProduct.images.length > 1 && (
                <div style={{
                    position: 'fixed',
                    left: mousePosition.x + 15,
                    top: mousePosition.y - 50,
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    maxWidth: 300
                }}>
                    <div style={{fontSize: '0.8rem', marginBottom: '6px', color: '#64748b'}}>
                        {hoveredProduct.images.length} images available
                    </div>
                    <div style={{display: 'flex', gap: '4px', overflowX: 'auto'}}>
                        {hoveredProduct.images.slice(0, 4).map((img, index) => (
                            <img 
                                key={index}
                                src={ensureAbsolute(img)} 
                                alt={`Preview ${index + 1}`}
                                style={{
                                    width: 60,
                                    height: 45,
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0'
                                }}
                            />
                        ))}
                        {hoveredProduct.images.length > 4 && (
                            <div style={{
                                width: 60,
                                height: 45,
                                background: '#f1f5f9',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                color: '#64748b'
                            }}>
                                +{hoveredProduct.images.length - 4}
                            </div>
                        )}
                    </div>
                </div>
            )}
            


            {/* Order Modal */}
            <OrderModal
                isOpen={showOrderModal}
                onClose={() => setShowOrderModal(false)}
                selectedProducts={selectedProducts}
                onOrderSuccess={handleOrderSuccess}
            />

            {/* Order Success Message */}
            {orderSuccess && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: '#10b981',
                    color: 'white',
                    padding: '16px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    zIndex: 10000,
                    fontSize: '14px',
                    fontWeight: '600'
                }}>
                    ✅ Order placed successfully! Check your email for confirmation.
                </div>
            )}
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




// Memoized Get Recommendations Button to prevent blinking
const GetRecommendationsButton = React.memo(({ selectedIds, parts, navigate }) => {
    const handleClick = useCallback(() => {
        if (selectedIds.length > 0) {
            const selectedProducts = parts.filter(part => selectedIds.includes(part._id));
            navigate('/recommendations', { 
                state: { 
                    selectedProducts,
                    fromParts: true 
                } 
            });
        }
    }, [selectedIds, parts, navigate]);

    const handleMouseEnter = useCallback((e) => {
        if (selectedIds.length > 0) {
            e.target.style.background = '#6d28d9';
            e.target.style.transform = 'translateY(-1px)';
        }
    }, [selectedIds.length]);

    const handleMouseLeave = useCallback((e) => {
        if (selectedIds.length > 0) {
            e.target.style.background = '#7c3aed';
            e.target.style.transform = 'translateY(0px)';
        }
    }, [selectedIds.length]);

    const buttonStyle = useMemo(() => ({
        padding:'8px 18px', 
        borderRadius:8, 
        background: selectedIds.length ? '#7c3aed' : '#9ca3af', 
        color:'#fff', 
        fontWeight:600, 
        border:'none', 
        fontSize:'1rem',
        cursor: selectedIds.length ? 'pointer' : 'not-allowed',
        transition: 'all 0.2s ease',
        marginLeft: '12px'
    }), [selectedIds.length]);

    const buttonText = useMemo(() => (
        `🤖 Get Recommendations (${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'items'})`
    ), [selectedIds.length]);

    return (
        <button
            disabled={!selectedIds.length}
            style={buttonStyle}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {buttonText}
        </button>
    );
});

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
