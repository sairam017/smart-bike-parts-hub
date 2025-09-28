import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import recommendationService from '../../services/recommendationService';
import LocationContext from '../../context/LocationContext';
import { formatINR } from '../../utils/currency';
import { calculateDistanceToShop, formatDistance } from '../../utils/distanceUtils';
import ShopAvailabilityMap from '../maps/ShopAvailabilityMap';

// Utility function to ensure absolute URLs
const ensureAbsolute = (src) => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return `http://localhost:5000${src}`;
};

// Enhanced Recommendation Card for selection mode
const RecommendationCard = ({ 
  product, 
  userLocation, 
  isSelected = false, 
  onToggle = null,
  selectionMode = false 
}) => {
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    if (userLocation && product.shop?.location?.coordinates) {
      try {
        const dist = calculateDistanceToShop(userLocation, product.shop.location.coordinates);
        setDistance(dist);
      } catch (error) {
        console.error('Error calculating distance for recommendation:', error);
      }
    }
  }, [userLocation, product.shop]);

  const firstImage = product.images && product.images.length > 0 ? product.images[0] : null;

  const handleClick = (e) => {
    if (selectionMode && onToggle) {
      e.preventDefault();
      onToggle(product);
    }
  };

  const CardContent = (
    <div
      style={{
        border: `2px solid ${selectionMode && isSelected ? '#1d4ed8' : '#e5e7eb'}`,
        borderRadius: 8,
        padding: '1rem',
        background: selectionMode && isSelected ? '#eff6ff' : '#fff',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        height: '100%',
        cursor: selectionMode ? 'pointer' : 'default',
        position: 'relative'
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!selectionMode) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selectionMode) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      }}
    >
      {/* Selection Checkbox */}
      {selectionMode && (
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

      {/* Recommendation Reason */}
      {product.recommendation_reason && (
        <div style={{
          fontSize: '0.7rem',
          color: '#6b7280',
          marginTop: '0.25rem',
          fontStyle: 'italic'
        }}>
          {product.recommendation_reason}
        </div>
      )}
    </div>
  );

  if (selectionMode) {
    return CardContent;
  }

  return (
    <Link
      to={`/product/${product._id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block'
      }}
    >
      {CardContent}
    </Link>
  );
};

const Recommendations = ({ 
  productId, 
  currentProduct,
  onRecommendationsLoad = null,
  showContinueButton = false 
}) => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [selectedRecommendations, setSelectedRecommendations] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const { location: userLoc } = useContext(LocationContext) || {};

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        setError('');

        // Try ML recommendations first
        const response = await recommendationService.getMLRecommendations(productId, userLoc);
        
        if (response.data.items && response.data.items.length > 0) {
          setRecommendations(response.data.items);
          setSource(response.data.source || 'recommendations');
          
          // Don't automatically call the callback - let user decide what to select
          console.log('Recommendations loaded:', response.data.items.length, 'items');
        } else {
          setRecommendations([]);
          setSource('no_recommendations');
          console.log('No recommendations found');
        }

      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
        setRecommendations([]);
        console.log('Recommendation error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [productId, userLoc, onRecommendationsLoad]);

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

  // Continue to maps with selected recommendations
  const continueToMaps = () => {
    // Navigate to the dedicated map page with selected products
    const selectedProducts = currentProduct ? [currentProduct] : [];
    navigate('/maps', {
      state: {
        selectedProducts,
        recommendedProducts: selectedRecommendations
      }
    });
  };

  if (loading) {
    return (
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#f8fafc',
        borderRadius: 8,
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          color: '#1e293b',
          fontSize: '1.2rem',
          fontWeight: 600
        }}>
          Recommendations (Likely related to your product)
        </h3>
        <div style={{ 
          textAlign: 'center', 
          color: '#64748b',
          fontSize: '0.9rem'
        }}>
          Loading personalized recommendations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#fef2f2',
        borderRadius: 8,
        border: '1px solid #fecaca'
      }}>
        <h3 style={{ 
          margin: '0 0 0.5rem 0', 
          color: '#991b1b',
          fontSize: '1.2rem',
          fontWeight: 600
        }}>
          Recommendations Unavailable
        </h3>
        <div style={{ color: '#dc2626', fontSize: '0.9rem' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#f8fafc',
        borderRadius: 8,
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ 
          margin: '0 0 0.5rem 0', 
          color: '#1e293b',
          fontSize: '1.2rem',
          fontWeight: 600
        }}>
          More Recommendations
        </h3>
        <div style={{ 
          color: '#64748b',
          fontSize: '0.9rem'
        }}>
          No similar products found at the moment.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '2rem',
      padding: '1.5rem',
      background: '#f8fafc',
      borderRadius: 8,
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ 
          margin: '0 0 0.25rem 0', 
          color: '#1e293b',
          fontSize: '1.2rem',
          fontWeight: 600
        }}>
          Recommendations
        </h3>
        <div style={{ 
          fontSize: '0.8rem',
          color: '#64748b'
        }}>
          {source === 'ml_recommendations' && '✨ ML-powered suggestions based on product similarity'}
          {source === 'basic_recommendations' && '📝 Basic recommendations based on category'}
          {!source && 'Personalized recommendations for you'}
          {recommendations.length > 0 && ` • ${recommendations.length} products found`}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        {recommendations.map((product) => (
          <RecommendationCard
            key={product._id}
            product={product}
            userLocation={userLoc}
            isSelected={selectedRecommendations.some(p => p._id === product._id)}
            onToggle={showContinueButton ? toggleRecommendation : null}
            selectionMode={showContinueButton}
          />
        ))}
      </div>

      {/* Selection Summary and Continue Button */}
      {showContinueButton && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#f0f9ff',
          borderRadius: '8px',
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
              <div style={{ fontWeight: 'bold', color: '#0c4a6e', marginBottom: '4px' }}>
                {selectedRecommendations.length} additional products selected
              </div>
              <div style={{ fontSize: '0.9rem', color: '#0369a1' }}>
                {selectedRecommendations.length === 0 
                  ? 'Select products to add to your shopping list'
                  : 'We\'ll find shops that have all your selected items'
                }
              </div>
            </div>
            
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
              🗺️ Get Maps
            </button>
          </div>
          
          {selectedRecommendations.length > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'white',
              borderRadius: '6px',
              border: '1px solid #bfdbfe'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
                Selected Products:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {selectedRecommendations.map((product, index) => (
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
      )}

      {recommendations.length > 6 && (
        <div style={{
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          <div style={{
            fontSize: '0.8rem',
            color: '#64748b'
          }}>
            Showing {Math.min(recommendations.length, 6)} of {recommendations.length} recommendations
          </div>
        </div>
      )}

      {/* Map Button and Map Section removed as per request */}
    </div>
  );
};

export default Recommendations;