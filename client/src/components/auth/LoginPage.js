import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import './auth.css';

// Enhanced login + inline register toggle
const LoginPage = () => {
  const { login, register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      // Redirect all roles to home with welcome flag
      navigate(`/?welcome=1`, { replace: true });
    }
  }, [user, loading, navigate]);

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null); setSuccess(null);
    try {
      if (isRegister) {
        if (form.password !== form.confirmPassword) throw new Error('Passwords do not match');
        await register(form.name, form.email, form.password);
        setSuccess('Registration successful');
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>{isRegister ? 'Register' : 'Login'}</h2>
        {loading && <p className="muted">Loading context...</p>}
        <form onSubmit={onSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label>Name</label>
              <input name="name" value={form.name} onChange={onChange} required />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={onChange} required />
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Password</label>
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={onChange}
              required
              style={{ paddingRight: '2.2rem' }}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                outline: 'none',
                height: '24px',
                width: '24px'
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg height="20" width="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 10C3.5 5.5 7.5 3 10 3C12.5 3 16.5 5.5 18 10C16.5 14.5 12.5 17 10 17C7.5 17 3.5 14.5 2 10Z" stroke="#1d4ed8" strokeWidth="2"/>
                  <circle cx="10" cy="10" r="3" stroke="#1d4ed8" strokeWidth="2"/>
                </svg>
              ) : (
                <svg height="20" width="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 10C3.5 5.5 7.5 3 10 3C12.5 3 16.5 5.5 18 10C16.5 14.5 12.5 17 10 17C7.5 17 3.5 14.5 2 10Z" stroke="#1d4ed8" strokeWidth="2"/>
                  <path d="M4 4L16 16" stroke="#1d4ed8" strokeWidth="2"/>
                </svg>
              )}
            </button>
          </div>
          {isRegister && (
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Confirm Password</label>
              <input
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={onChange}
                required
                style={{ paddingRight: '2.2rem' }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(v => !v)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  outline: 'none',
                  height: '24px',
                  width: '24px'
                }}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg height="20" width="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 10C3.5 5.5 7.5 3 10 3C12.5 3 16.5 5.5 18 10C16.5 14.5 12.5 17 10 17C7.5 17 3.5 14.5 2 10Z" stroke="#1d4ed8" strokeWidth="2"/>
                    <circle cx="10" cy="10" r="3" stroke="#1d4ed8" strokeWidth="2"/>
                  </svg>
                ) : (
                  <svg height="20" width="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 10C3.5 5.5 7.5 3 10 3C12.5 3 16.5 5.5 18 10C16.5 14.5 12.5 17 10 17C7.5 17 3.5 14.5 2 10Z" stroke="#1d4ed8" strokeWidth="2"/>
                    <path d="M4 4L16 16" stroke="#1d4ed8" strokeWidth="2"/>
                  </svg>
                )}
              </button>
            </div>
          )}
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}
          <button type="submit" disabled={submitting} className="primary-btn full">
            {submitting ? 'Please wait...' : (isRegister ? 'Create Account' : 'Login')}
          </button>
        </form>
        <div className="switch-line">
          {isRegister ? 'Have an account?' : 'New user?'}{' '}
          <button type="button" className="link-btn" onClick={()=> { setIsRegister(!isRegister); setError(null); setSuccess(null); }}>
            {isRegister ? 'Login here' : 'Register here'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
