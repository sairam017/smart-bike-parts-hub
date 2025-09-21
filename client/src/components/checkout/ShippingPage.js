import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const ShippingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ address: '', city: '', postalCode: '', country: '' });

  if (!user) return <div>Please login</div>;

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = e => {
    e.preventDefault();
    sessionStorage.setItem('shipping', JSON.stringify(form));
    navigate('/payment');
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Shipping</h2>
      <form onSubmit={submit}>
        <input name="address" placeholder="Address" value={form.address} onChange={onChange} required />
        <input name="city" placeholder="City" value={form.city} onChange={onChange} required />
        <input name="postalCode" placeholder="Postal Code" value={form.postalCode} onChange={onChange} required />
        <input name="country" placeholder="Country" value={form.country} onChange={onChange} required />
        <button type="submit">Continue</button>
      </form>
    </div>
  );
};

export default ShippingPage;
