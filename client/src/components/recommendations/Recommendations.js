import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import recommendationService from '../../services/recommendationService';
import LocationContext from '../../context/LocationContext';
import { formatINR } from '../../utils/currency';
import { calculateDistanceToShop, formatDistance } from '../../utils/distanceUtils';

// Utility function to ensure absolute URLs
const ensureAbsolute = (src) => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return `http://localhost:5000${src}`;
};

const RecommendationCard = ({ product, userLocation }) => {
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

  return (
    <Link
      to={`/product/${product._id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '1rem',
        background: '#fff',
        transition: 'transform 0.2s, box-shadow 0.2s',
        height: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      }}
    >
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
    </Link>
  );
};

const Recommendations = ({ productId, currentProduct }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
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
        } else {
          setRecommendations([]);
          setSource('no_recommendations');
        }

      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [productId, userLoc]);

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
          🤖 AI Recommendations
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
          🤖 AI Recommendations
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
          🤖 AI Recommendations
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
          />
        ))}
      </div>

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
    </div>
  );
};

export default Recommendations;