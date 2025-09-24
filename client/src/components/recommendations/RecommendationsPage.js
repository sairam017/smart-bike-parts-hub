import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LocationContext from '../../context/LocationContext';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import recommendationService from '../../services/recommendationService';
import { formatINR } from '../../utils/currency';
import { calculateDistanceToShop, formatDistance } from '../../utils/distanceUtils';

// Utility function to ensure absolute URLs
const ensureAbsolute = (src) => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return `http://localhost:5000${src}`;
};

// Enhanced Product Card for selected and recommended products
const ProductCard = ({ 
  product, 
  userLocation, 
  isSelected = false, 
  onToggle = null,
  selectionMode = false,
  isOriginalSelection = false
}) => {
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    if (userLocation && product.shop?.location?.coordinates) {
      try {
        const dist = calculateDistanceToShop(userLocation, product.shop.location.coordinates);
        setDistance(dist);
      } catch (error) {
        console.error('Error calculating distance:', error);
      }
    }
  }, [userLocation, product.shop]);

  const firstImage = product.images && product.images.length > 0 ? product.images[0] : null;

  const handleClick = (e) => {
    if (selectionMode && onToggle && !isOriginalSelection) {
      e.preventDefault();
      onToggle(product);
    }
  };

  return (
    <div
      style={{
        border: `2px solid ${
          isOriginalSelection ? '#059669' : 
          selectionMode && isSelected ? '#1d4ed8' : '#e5e7eb'
        }`,
        borderRadius: 8,
        padding: '1rem',
        background: 
          isOriginalSelection ? '#f0fdf4' :
          selectionMode && isSelected ? '#eff6ff' : '#fff',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        height: '100%',
        cursor: selectionMode && !isOriginalSelection ? 'pointer' : 'default',
        position: 'relative'
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (selectionMode && !isOriginalSelection) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (selectionMode && !isOriginalSelection) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      }}
    >
      {/* Selection Indicator */}
      {isOriginalSelection && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: '#059669',
          color: 'white',
          borderRadius: '12px',
          fontSize: '0.7rem',
          fontWeight: 'bold'
        }}>
          Selected
        </div>
      )}
      
      {selectionMode && !isOriginalSelection && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: isSelected ? '#1d4ed8' : '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {isSelected ? '✓' : ''}
        </div>
      )}

      {/* Product Image */}
      <div style={{
        width: '100%',
        height: 120,
        background: '#f1f5f9',
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {firstImage ? (
          <img
            src={ensureAbsolute(firstImage)}
            alt={product.name || product.model}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem;">No Image</div>';
            }}
          />
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No Image</div>
        )}
      </div>

      {/* Product Info */}
      <div style={{ marginBottom: '0.5rem' }}>
        <h4 style={{
          margin: '0 0 0.25rem 0',
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#1e293b',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {product.name || product.model}
        </h4>
        
        <div style={{
          fontSize: '0.75rem',
          color: '#64748b',
          marginBottom: '0.25rem'
        }}>
          {product.company} • {product.model}
        </div>
      </div>

      {/* Price */}
      <div style={{
        fontSize: '0.9rem',
        fontWeight: 700,
        color: '#059669',
        marginBottom: '0.5rem'
      }}>
        {formatINR(product.price)}
      </div>

      {/* ML Recommendation Info */}
      {product.similarity_score && (
        <div style={{
          fontSize: '0.7rem',
          color: '#7c3aed',
          marginBottom: '0.25rem',
          fontWeight: 500
        }}>
          🤖 {Math.round(product.similarity_score * 100)}% match
        </div>
      )}

      {/* Distance */}
      {distance !== null && (
        <div style={{
          fontSize: '0.7rem',
          color: '#1d4ed8',
          marginBottom: '0.25rem'
        }}>
          📍 {formatDistance(distance)} away
        </div>
      )}

      {/* Stock Status */}
      {typeof product.countInStock === 'number' && (
        <div style={{
          fontSize: '0.7rem',
          color: product.countInStock > 0 ? '#15803d' : '#dc2626',
          fontWeight: 500
        }}>
          {product.countInStock > 0 ? `${product.countInStock} in stock` : 'Out of stock'}
        </div>
      )}
    </div>
  );
};

const RecommendationsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { location: userLocation } = useContext(LocationContext) || {};
  const { user } = useAuth();
  const { dispatch: cartDispatch } = useCart();
  
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedRecommendations, setSelectedRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize selected products from navigation state
  useEffect(() => {
    const navState = location.state;
    if (navState?.selectedProducts) {
      setSelectedProducts(navState.selectedProducts);
    } else {
      // If no products selected, redirect back to parts
      navigate('/parts');
      return;
    }
  }, [location.state, navigate]);

  // Fetch recommendations for selected products
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (selectedProducts.length === 0) return;

      try {
        setLoading(true);
        setError('');

        // Get recommendations for all selected products
        const allRecommendations = [];
        
        for (const product of selectedProducts) {
          try {
            const response = await recommendationService.getMLRecommendations(product._id, userLocation);
            if (response.data.items && response.data.items.length > 0) {
              // Add source info to recommendations
              const productsWithSource = response.data.items.map(item => ({
                ...item,
                recommendedFor: product.name || product.model
              }));
              allRecommendations.push(...productsWithSource);
            }
          } catch (err) {
            console.error(`Error fetching recommendations for ${product.name}:`, err);
          }
        }

        // Remove duplicates and filter out already selected products
        const uniqueRecommendations = allRecommendations.filter((rec, index, self) => {
          // Check if this recommendation is unique by _id
          const isUnique = self.findIndex(r => r._id === rec._id) === index;
          // Check if this recommendation is not already in selected products
          const notAlreadySelected = !selectedProducts.some(sp => sp._id === rec._id);
          return isUnique && notAlreadySelected;
        });

        setRecommendations(uniqueRecommendations);
        console.log('Total recommendations loaded:', uniqueRecommendations.length);

      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [selectedProducts, userLocation]);

  // Toggle recommendation selection
  const toggleRecommendation = (product) => {
    setSelectedRecommendations(prev => {
      const isSelected = prev.find(p => p._id === product._id);
      if (isSelected) {
        return prev.filter(p => p._id !== product._id);
      } else {
        return [...prev, product];
      }
    });
  };

  // Continue to maps with all selected products
  const continueToMaps = () => {
    const allSelectedProducts = [...selectedProducts, ...selectedRecommendations];
    navigate('/maps', {
      state: {
        selectedProducts: allSelectedProducts,
        fromRecommendations: true
      }
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <h2>Loading Recommendations...</h2>
          <p>Finding the best products for you based on your selections</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>
          🤖 AI-Powered Recommendations
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
          Based on your {selectedProducts.length} selected product{selectedProducts.length !== 1 ? 's' : ''}, 
          we found {recommendations.length} personalized recommendation{recommendations.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Selected Products Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ 
          margin: '0 0 1rem 0', 
          color: '#059669',
          fontSize: '1.3rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ✅ Your Selected Products ({selectedProducts.length})
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          {selectedProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              userLocation={userLocation}
              isOriginalSelection={true}
            />
          ))}
        </div>
      </div>

      {/* Recommendations Section */}
      {recommendations.length > 0 ? (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ 
            margin: '0 0 1rem 0', 
            color: '#7c3aed',
            fontSize: '1.3rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🎯 Recommended for You ({recommendations.length})
          </h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            Select additional products you'd like to add to your shopping list. We'll find shops that have all your items.
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {recommendations.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                userLocation={userLocation}
                isSelected={selectedRecommendations.some(p => p._id === product._id)}
                onToggle={toggleRecommendation}
                selectionMode={true}
              />
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '3rem'
        }}>
          <h3 style={{ color: '#64748b', margin: '0 0 1rem 0' }}>
            No Additional Recommendations Found
          </h3>
          <p style={{ color: '#9ca3af' }}>
            Your selected products are quite unique! You can still proceed to find shops with your current selection.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        background: '#f0f9ff',
        padding: '2rem',
        borderRadius: '12px',
        border: '1px solid #0ea5e9'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontWeight: 'bold', color: '#0c4a6e', marginBottom: '4px', fontSize: '1.1rem' }}>
              Ready to Find Shops?
            </div>
            <div style={{ fontSize: '1rem', color: '#0369a1' }}>
              {selectedProducts.length} original selection{selectedProducts.length !== 1 ? 's' : ''}
              {selectedRecommendations.length > 0 && ` + ${selectedRecommendations.length} additional recommendation${selectedRecommendations.length !== 1 ? 's' : ''}`}
              {' = '}
              <strong>{selectedProducts.length + selectedRecommendations.length} total products</strong>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => navigate('/parts')}
              style={{
                padding: '12px 24px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#4b5563'}
              onMouseLeave={(e) => e.target.style.background = '#6b7280'}
            >
              ← Back to Parts
            </button>

            <button
              onClick={() => {
                if (!user) {
                  alert('Please login to place an order');
                  navigate('/login');
                  return;
                }

                const allSelectedProducts = [...selectedProducts, ...selectedRecommendations];
                if (allSelectedProducts.length === 0) {
                  alert('Please select at least one product to place an order');
                  return;
                }

                // Add all selected products to cart
                allSelectedProducts.forEach(product => {
                  cartDispatch({
                    type: 'ADD_TO_CART',
                    payload: {
                      _id: product._id,
                      name: product.name || product.model,
                      price: product.price,
                      image: product.images?.[0] || '',
                      countInStock: product.countInStock || 1,
                      quantity: 1
                    }
                  });
                });

                // Show success message and redirect to cart
                alert(`${allSelectedProducts.length} products added to cart successfully!`);
                navigate('/cart');
              }}
              style={{
                padding: '12px 24px',
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#047857'}
              onMouseLeave={(e) => e.target.style.background = '#059669'}
            >
              🛒 Add to Cart ({selectedProducts.length + selectedRecommendations.length} items)
            </button>
            
            <button
              onClick={continueToMaps}
              style={{
                padding: '12px 24px',
                background: '#1d4ed8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#1e40af'}
              onMouseLeave={(e) => e.target.style.background = '#1d4ed8'}
            >
              🗺️ Find Shops ({selectedProducts.length + selectedRecommendations.length} items)
            </button>
          </div>
        </div>
        
        {selectedRecommendations.length > 0 && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
              Additional Recommendations Selected:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {selectedRecommendations.map((product) => (
                <span
                  key={product._id}
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 8px',
                    background: '#dbeafe',
                    color: '#1e40af',
                    borderRadius: '4px',
                    border: '1px solid #93c5fd'
                  }}
                >
                  {product.name || product.model}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default RecommendationsPage;