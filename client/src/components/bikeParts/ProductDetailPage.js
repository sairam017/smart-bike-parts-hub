import React, { useEffect, useState, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import bikePartsService from '../../services/bikePartsService';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';
import useCart from '../../hooks/useCart';
import LocationContext from '../../context/LocationContext';
import { formatINR } from '../../utils/currency';
import { calculateDistanceToShop, formatDistance, debugDistance } from '../../utils/distanceUtils';

// Utility function to ensure absolute URLs
const ensureAbsolute = (src) => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return `http://localhost:5000${src}`;
};

// Enhanced Image Gallery Component
function ImageGallery({ images, productName, onImageClick }) {
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState(new Set());

  useEffect(() => {
    setMainImageIndex(0);
    setImageErrors(new Set());
  }, [images]);

  const handleImageError = (index) => {
    setImageErrors(prev => new Set([...prev, index]));
  };

  const validImages = images?.filter((img, index) => !imageErrors.has(index)) || [];

  if (!validImages.length) {
    return (
      <div style={{
        width: '100%', 
        height: 300, 
        background: '#f1f5f9', 
        borderRadius: 12, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: '#94a3b8',
        fontSize: '1.1rem',
        border: '2px solid #e2e8f0'
      }}>
        No Image Available
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Main large image */}
      <div 
        style={{
          width: '100%',
          height: 300,
          background: '#f1f5f9',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'zoom-in',
          border: '2px solid #e2e8f0',
          marginBottom: '0.5rem'
        }}
        onClick={() => onImageClick && onImageClick(Math.min(mainImageIndex, validImages.length - 1))}
      >
        <img 
          src={ensureAbsolute(validImages[Math.min(mainImageIndex, validImages.length - 1)])} 
          alt={productName} 
          style={{
            width: '100%', 
            height: '100%', 
            objectFit: 'contain'
          }}
          onError={() => handleImageError(Math.min(mainImageIndex, validImages.length - 1))}
        />
      </div>
      
      {/* Thumbnail navigation - only show if multiple images */}
      {validImages.length > 1 && (
        <div style={{
          display: 'flex', 
          gap: 8, 
          overflowX: 'auto',
          paddingBottom: '0.5rem'
        }}>
          {validImages.map((img, index) => (
            <div
              key={index}
              style={{
                minWidth: 80,
                height: 60,
                background: '#f1f5f9',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                border: index === mainImageIndex ? '2px solid #1d4ed8' : '2px solid #e2e8f0',
                transition: 'border-color 0.2s'
              }}
              onClick={() => setMainImageIndex(index)}
            >
              <img 
                src={ensureAbsolute(img)} 
                alt={`${productName} ${index + 1}`}
                style={{
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover'
                }}
                onError={() => handleImageError(index)}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Image counter */}
      {validImages.length > 1 && (
        <div style={{
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#64748b',
          marginTop: '0.25rem'
        }}>
          {Math.min(mainImageIndex + 1, validImages.length)} of {validImages.length}
        </div>
      )}
    </div>
  );
}

// Image Modal for full-screen viewing
function ImageModal({ images, isOpen, selectedIndex, onClose, productName }) {
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);
  
  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
  };

  useEffect(() => {
    setCurrentIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !images || images.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          color: 'white',
          fontSize: '1.5rem',
          padding: '0.5rem',
          borderRadius: '50%',
          cursor: 'pointer',
          width: 50,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </button>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={prevImage}
          style={{
            position: 'absolute',
            left: '1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '50%',
            cursor: 'pointer'
          }}
        >
          ‹
        </button>
      )}

      {/* Image */}
      <img
        src={ensureAbsolute(images[currentIndex])}
        alt={`${productName} ${currentIndex + 1}`}
        style={{
          maxWidth: '90%',
          maxHeight: '90%',
          objectFit: 'contain',
          borderRadius: '8px'
        }}
      />

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={nextImage}
          style={{
            position: 'absolute',
            right: '1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '50%',
            cursor: 'pointer'
          }}
        >
          ›
        </button>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '0.5rem 1rem',
          borderRadius: '1rem',
          fontSize: '0.9rem'
        }}>
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cartCtx = useCart();
  const cart = cartCtx?.cart || { items: [] };
  const dispatch = cartCtx?.dispatch || (() => {});
  const { location: userLoc } = useContext(LocationContext) || {};
  
  // Image gallery state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  // Single product state (simplified)
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [distanceKm, setDistanceKm] = useState(null);

  // Fetch single product by ID
  useEffect(() => {
    if (!id) {
      setError('No product ID provided');
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError('');

    console.log('Fetching product with ID:', id); // Debug log

    bikePartsService.getPartById(id)
      .then(response => {
        console.log('API Response:', response); // Debug log
        if (!isCancelled) {
          setProduct(response.data);
          setQty(1); // Reset quantity
        }
      })
      .catch(err => {
        console.error('Error fetching product:', err); // Debug log
        if (!isCancelled) {
          if (err?.response?.status === 404) {
            setError('Product not found. Please check the product ID or try again later.');
          } else if (err?.response?.status === 500) {
            setError('Server error. Please try again later.');
          } else {
            setError('Failed to load product details. Please try again.');
          }
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [id]);

  // Calculate distance when user location or product changes
  useEffect(() => {
    if (!product?.shop?.location?.coordinates || !userLoc) {
      setDistanceKm(null);
      return;
    }

    try {
      const distance = calculateDistanceToShop(userLoc, product.shop.location.coordinates);
      debugDistance('ProductDetailPage', userLoc, product.shop.location.coordinates, distance);
      setDistanceKm(distance);
    } catch (error) {
      console.error('Error calculating distance:', error);
      setDistanceKm(null);
    }
  }, [userLoc, product]);

  // Quantity handlers
  const increaseQty = () => {
    const maxStock = typeof product?.countInStock === 'number' && product.countInStock > 0 ? product.countInStock : 99;
    setQty(prev => Math.min(maxStock, prev + 1));
  };

  const decreaseQty = () => {
    setQty(prev => Math.max(1, prev - 1));
  };

  const handleQtyChange = (e) => {
    const value = Number(e.target.value) || 1;
    const maxStock = typeof product?.countInStock === 'number' && product.countInStock > 0 ? product.countInStock : 99;
    setQty(Math.min(maxStock, Math.max(1, value)));
  };

  // Action handlers
  const addToCart = () => {
    if (!product) return;

    if (typeof product.countInStock === 'number') {
      if (product.countInStock <= 0) {
        alert('This product is out of stock.');
        return;
      }
      
      const existing = cart.items.find(i => i.id === product._id);
      const existingQty = existing?.qty || 0;
      
      if (existingQty + qty > product.countInStock) {
        const remaining = product.countInStock - existingQty;
        if (remaining > 0) {
          alert(`Only ${remaining} more in stock (total available ${product.countInStock}).`);
        } else {
          alert('No more stock available for this product.');
        }
        return;
      }
    }

    dispatch({ 
      type: 'ADD_TO_CART', 
      payload: { 
        id: product._id, 
        name: product.name || product.model, 
        price: product.price, 
        qty 
      } 
    });
    
    alert('Added to cart successfully!');
    navigate('/');
  };

  const openMaps = () => {
    if (!product?.shop?.location?.coordinates) {
      alert('Shop location not available');
      return;
    }
    
    const [lng, lat] = product.shop.location.coordinates;
    const destination = `${lat},${lng}`;
    const base = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    const url = userLoc ? 
      `${base}&origin=${encodeURIComponent(`${userLoc.latitude},${userLoc.longitude}`)}` : 
      base;
    
    window.open(url, '_blank');
  };

  const placeOrder = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!product) return;

    if (typeof product.countInStock === 'number' && qty > product.countInStock) {
      alert(`Only ${product.countInStock} in stock. Reduce quantity.`);
      return;
    }

    const phone = window.prompt('Enter your active phone number (+country / 10 digits)');
    if (!phone) return;

    const dateStr = window.prompt('Enter collection date (YYYY-MM-DD)');
    if (!dateStr) return;

    try {
      setPlacing(true);
      const orderItems = [{
        name: product.name || product.model,
        qty,
        price: product.price,
        product: product._id
      }];
      
      const shippingAddress = userLoc ? 
        { lat: userLoc.latitude, lng: userLoc.longitude } : 
        { address: 'Unknown' };

      await api.post('/orders', {
        orderItems,
        shippingAddress,
        paymentMethod: 'cod',
        phone,
        collectionDate: dateStr
      });

      alert('Order placed successfully!');
      navigate('/');
    } catch (error) {
      console.error('Order failed:', error);
      alert(error.response?.data?.message || 'Order failed. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const handleImageClick = (imageIndex) => {
    setSelectedImageIndex(imageIndex);
    setIsImageModalOpen(true);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        maxWidth: 1000,
        margin: '0 auto'
      }}>
        <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading product details...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        maxWidth: 1000,
        margin: '0 auto'
      }}>
        <div style={{ color: '#dc2626', fontSize: '1.1rem', marginBottom: '1rem' }}>
          {error}
        </div>
        <button 
          style={{
            padding: '8px 16px', 
            borderRadius: 8, 
            background: '#1d4ed8', 
            color: '#fff', 
            border: 'none', 
            cursor: 'pointer',
            marginRight: '1rem'
          }} 
          onClick={() => window.history.back()}
        >
          Go Back
        </button>
        <button 
          style={{
            padding: '8px 16px', 
            borderRadius: 8, 
            background: '#059669', 
            color: '#fff', 
            border: 'none', 
            cursor: 'pointer'
          }} 
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  // No product found
  if (!product) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        maxWidth: 1000,
        margin: '0 auto'
      }}>
        <div style={{ color: '#dc2626', fontSize: '1.1rem', marginBottom: '1rem' }}>
          Product not found
        </div>
        <button 
          style={{
            padding: '8px 16px', 
            borderRadius: 8, 
            background: '#1d4ed8', 
            color: '#fff', 
            border: 'none', 
            cursor: 'pointer'
          }} 
          onClick={() => window.history.back()}
        >
          Go Back
        </button>
      </div>
    );
  }

  const totalPrice = product.price * qty;
  const isOutOfStock = typeof product.countInStock === 'number' && product.countInStock <= 0;
  const isOverStock = typeof product.countInStock === 'number' && qty > product.countInStock;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1rem' }}>
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '1.5rem',
        background: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Product Header */}
        <div style={{ marginBottom: '1rem' }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            marginBottom: '0.5rem', 
            color: '#1e293b',
            fontWeight: 700
          }}>
            {product.name || product.model}
          </h1>
          <div style={{ 
            fontSize: '1rem', 
            marginBottom: '1rem', 
            color: '#64748b' 
          }}>
            {product.company} • {product.model} • {product.vehicleYear}
          </div>
        </div>

        {/* Enhanced Image Gallery */}
        <ImageGallery 
          images={product.images} 
          productName={product.name || product.model}
          onImageClick={handleImageClick}
        />

        {/* Product Details */}
        <div style={{ marginBottom: '1rem' }}>
          {distanceKm != null && (
            <div style={{
              fontWeight: 600,
              color: '#1d4ed8',
              fontSize: '1rem',
              marginBottom: '0.5rem'
            }}>
              📍 Distance: {formatDistance(distanceKm)} away
            </div>
          )}

          {product.description && (
            <div style={{
              margin: '1rem 0',
              fontSize: '1rem',
              lineHeight: 1.6,
              color: '#374151'
            }}>
              {product.description}
            </div>
          )}

          <div style={{
            fontSize: '1.2rem',
            color: '#059669',
            fontWeight: 700,
            marginBottom: '0.5rem'
          }}>
            Price: {formatINR(product.price)} each
          </div>

          {typeof product.countInStock === 'number' && (
            <div style={{
              fontSize: '0.9rem',
              color: product.countInStock > 0 ? '#15803d' : '#dc2626',
              fontWeight: 600,
              marginBottom: '1rem'
            }}>
              Stock: {product.countInStock} {product.countInStock === 1 ? 'unit' : 'units'} available
            </div>
          )}
        </div>

        {/* Quantity Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>Quantity:</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '2px solid #cbd5e1',
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              <button
                type="button"
                onClick={decreaseQty}
                style={{
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 700
                }}
              >
                -
              </button>
              <input
                type="number"
                value={qty}
                onChange={handleQtyChange}
                style={{
                  width: 60,
                  textAlign: 'center',
                  fontSize: '1rem',
                  border: 'none',
                  outline: 'none',
                  background: '#fff',
                  padding: '8px 4px'
                }}
                min="1"
                max={typeof product.countInStock === 'number' ? product.countInStock : 99}
              />
              <button
                type="button"
                onClick={increaseQty}
                style={{
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 700
                }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{
            marginLeft: 'auto',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: '#059669'
          }}>
            Total: {formatINR(totalPrice)}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          marginTop: '1.5rem'
        }}>
          <button
            onClick={addToCart}
            disabled={isOutOfStock}
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              borderRadius: 8,
              background: isOutOfStock ? '#9ca3af' : '#1d4ed8',
              color: '#fff',
              border: 'none',
              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
          >
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>

          <button
            onClick={openMaps}
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              borderRadius: 8,
              background: '#059669',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
          >
            📍 Get Directions
          </button>

          <button
            onClick={placeOrder}
            disabled={placing || isOutOfStock || isOverStock}
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              borderRadius: 8,
              background: (placing || isOutOfStock || isOverStock) ? '#9ca3af' : '#dc2626',
              color: '#fff',
              border: 'none',
              cursor: (placing || isOutOfStock || isOverStock) ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
          >
            {placing ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>

        {/* Shop Information */}
        {product.shop && (
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ 
              margin: '0 0 0.5rem 0', 
              color: '#1e293b',
              fontSize: '1.1rem'
            }}>
              Available at: {product.shop.name}
            </h3>
            {product.shop.address && (
              <p style={{ 
                margin: '0', 
                color: '#64748b',
                fontSize: '0.9rem'
              }}>
                📍 {product.shop.address}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Image Modal for full-screen viewing */}
      <ImageModal
        images={product.images || []}
        isOpen={isImageModalOpen}
        selectedIndex={selectedImageIndex}
        onClose={() => setIsImageModalOpen(false)}
        productName={product.name || product.model}
      />
    </div>
  );
};

export default ProductDetailPage;
