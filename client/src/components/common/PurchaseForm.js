import React, { useState } from 'react';

const PurchaseForm = ({ 
  shop, 
  products = [], 
  quantity = 1, 
  onComplete, 
  onCancel 
}) => {
  const [contactMethod, setContactMethod] = useState('email'); // 'email' or 'sms'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (contactMethod === 'email' && !email.trim()) {
      alert('Please enter your email address');
      return;
    }

    if (contactMethod === 'sms' && !phone.trim()) {
      alert('Please enter your phone number');
      return;
    }

    setLoading(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const contactInfo = {
        name: customerName,
        email: contactMethod === 'email' ? email : '',
        phone: contactMethod === 'sms' ? phone : '',
        method: contactMethod
      };
      
      onComplete(contactInfo);
    } catch (error) {
      alert('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '1.5rem',
      background: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      marginTop: '1rem'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: '8px',
        color: 'white'
      }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem' }}>
          🛒 Complete Your Purchase
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
          Order from {shop?.name} - Enter your details to receive order confirmation
        </p>
      </div>

      {/* Order Summary */}
      <div style={{
        background: '#f8fafc',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: '#1e293b' }}>Order Summary</h3>
        
        <div style={{ marginBottom: '0.75rem' }}>
          <strong style={{ color: '#059669' }}>Shop: </strong>
          <span>{shop?.name}</span>
        </div>
        
        {shop?.address && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#64748b' }}>
            📍 {shop.address}
          </div>
        )}
        
        {shop?.phone && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#64748b' }}>
            📞 {shop.phone}
          </div>
        )}

        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
          <strong style={{ color: '#1e293b' }}>Products ({products.length}): </strong>
          <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
            {products.length} item{products.length !== 1 ? 's' : ''} • Quantity: {quantity}
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <form onSubmit={handleSubmit}>
        {/* Customer Name */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 600,
            color: '#374151'
          }}>
            Your Name *
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your full name"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '1rem',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#1d4ed8'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            required
          />
        </div>

        {/* Contact Method Selection */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 600,
            color: '#374151'
          }}>
            How would you like to receive confirmation? *
          </label>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="email"
                checked={contactMethod === 'email'}
                onChange={(e) => setContactMethod(e.target.value)}
                style={{ marginRight: '0.5rem' }}
              />
              📧 Email
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="sms"
                checked={contactMethod === 'sms'}
                onChange={(e) => setContactMethod(e.target.value)}
                style={{ marginRight: '0.5rem' }}
              />
              📱 SMS
            </label>
          </div>
        </div>

        {/* Email Input */}
        {contactMethod === 'email' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151'
            }}>
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1d4ed8'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              required
            />
          </div>
        )}

        {/* Phone Input */}
        {contactMethod === 'sms' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151'
            }}>
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1d4ed8'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              required
            />
          </div>
        )}

        {/* Terms Notice */}
        <div style={{
          background: '#eff6ff',
          padding: '0.75rem',
          borderRadius: '6px',
          border: '1px solid #bfdbfe',
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          color: '#1e40af'
        }}>
          <strong>Note:</strong> By proceeding, you confirm your order. You will receive a confirmation {contactMethod === 'email' ? 'email' : 'SMS'} with pickup details and shop contact information.
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              opacity: loading ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              background: loading ? '#9ca3af' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? '🔄 Placing Order...' : '🛒 Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseForm;