import React, { useState } from 'react';
import orderService from '../../services/orderService';
import useAuth from '../../hooks/useAuth';

const OrderModal = ({ 
  isOpen, 
  onClose, 
  selectedProducts = [],
  onOrderSuccess
}) => {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    collectionDate: '',
    paymentMethod: 'Cash on Delivery',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  
  const { user } = useAuth();

  // Calculate total amount
  const totalAmount = selectedProducts.reduce((sum, product) => 
    sum + (product.price * (product.quantity || 1)), 0
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      setError('Please select at least one product');
      return;
    }

    // Validate form data
    const orderData = orderService.formatOrderData(
      selectedProducts.map(p => ({ ...p, quantity: p.quantity || 1 })),
      {
        email: formData.email,
        phone: formData.phone
      },
      {
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
        collectionDate: formData.collectionDate,
        paymentMethod: formData.paymentMethod
      }
    );

    const validation = orderService.validateOrderData(orderData);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await orderService.createOrder(orderData);
      setOrderId(result._id);
      setSuccess(true);
      
      if (onOrderSuccess) {
        onOrderSuccess(result);
      }

      // Auto-close after success message
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFormData({
          email: '',
          phone: '',
          address: '',
          city: '',
          postalCode: '',
          collectionDate: '',
          paymentMethod: 'Cash on Delivery',
          notes: ''
        });
        setOrderId('');
      }, 3000);

    } catch (error) {
      console.error('Order submission error:', error);
      setError(error.response?.data?.message || 'Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Tomorrow as minimum
    return today.toISOString().split('T')[0];
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#059669' }}>Order Placed Successfully!</h3>
            <p style={{ margin: '8px 0', color: '#6b7280' }}>
              Order ID: <strong>{orderId}</strong>
            </p>
            <p style={{ margin: 0, color: '#6b7280' }}>
              You will receive a confirmation email shortly.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>
                🛒 Place Order
              </h3>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            {/* Order Summary */}
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>Order Summary</h4>
              {selectedProducts.map((product, index) => (
                <div key={product._id || index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: index < selectedProducts.length - 1 ? '1px solid #e5e7eb' : 'none'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {product.name || product.model}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {product.company} • Qty: {product.quantity || 1}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    ₹{(product.price * (product.quantity || 1)).toLocaleString()}
                  </div>
                </div>
              ))}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '2px solid #d1d5db',
                fontSize: '16px',
                fontWeight: '700',
                color: '#1f2937'
              }}>
                <span>Total Amount:</span>
                <span>₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Delivery Address *
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  placeholder="Enter your complete delivery address"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="City"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Postal Code
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="560001"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Collection Date *
                  </label>
                  <input
                    type="date"
                    name="collectionDate"
                    value={formData.collectionDate}
                    onChange={handleInputChange}
                    min={getMinDate()}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="Online Payment">Online Payment</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Additional Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  placeholder="Any special instructions or requirements..."
                />
              </div>

              {error && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0, fontSize: '14px', color: '#dc2626' }}>
                    ⚠️ {error}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedProducts.length === 0}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: loading ? '#9ca3af' : '#059669',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    minWidth: '120px'
                  }}
                >
                  {loading ? '🔄 Placing...' : `🛒 Place Order (₹${totalAmount.toLocaleString()})`}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderModal;