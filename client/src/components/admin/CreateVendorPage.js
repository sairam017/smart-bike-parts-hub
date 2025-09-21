import React, { useState, useMemo } from 'react';
import adminService from '../../services/adminService';
import useAuth from '../../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import './admin.css';


const CreateVendorPage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ vendorName: '', shopName: '', contactNumber: '', email: '', password: '', confirmPassword: '' });
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const pwMismatch = useMemo(() => form.password && form.confirmPassword && form.password !== form.confirmPassword, [form.password, form.confirmPassword]);
  const canSubmit = useMemo(() => form.vendorName && form.shopName && form.contactNumber && form.email && form.password && form.confirmPassword && !pwMismatch, [form, pwMismatch]);

  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (pwMismatch) { setError('Passwords do not match'); return; }
    setSubmitting(true); setError(null); setSuccess(null);
    try {
      const payload = { ...form };
  const { data } = await adminService.createVendorWithShop(payload);
  setSuccess(`Vendor ${data.vendor.name} created with shop ${data.shop.name}`);
  setTimeout(()=> navigate('/'), 1000);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to create vendor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>Create Vendor</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <div className="field">
          <label>Vendor Name</label>
          <input name="vendorName" value={form.vendorName} onChange={onChange} required />
        </div>
        <div className="field">
          <label>Shop Name</label>
          <input name="shopName" value={form.shopName} onChange={onChange} required />
        </div>
        <div className="field">
          <label>Contact Number</label>
          <input name="contactNumber" value={form.contactNumber} onChange={onChange} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" name="email" value={form.email} onChange={onChange} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" name="password" value={form.password} onChange={onChange} required />
        </div>
        <div className="field">
          <label>Confirm Password</label>
          <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={onChange} required />
          {pwMismatch && <small className="error-text">Passwords do not match</small>}
        </div>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        <button type="submit" disabled={!canSubmit || submitting} className="primary-btn">
          {submitting ? 'Creating...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default CreateVendorPage;
