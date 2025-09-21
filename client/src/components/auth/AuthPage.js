import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';

const AuthPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'customer' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleMode = () => { setIsLogin(!isLogin); setError(null); };

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!isLogin) {
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
      }
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await api.post('/auth/register', { name: form.name, email: form.email, password: form.password, role: form.role });
        await login(form.email, form.password);
      }
      // After login decide redirect based on decoded token (role is in context user.role)
      const token = localStorage.getItem('token');
      if (!token) return;
      // user payload stored in context via login already
      // minimal wait to ensure context updated
      setTimeout(() => {
        const stored = JSON.parse(atob(token.split('.')[1]));
        const role = stored.user?.role;
        if (role === 'admin') navigate('/admin/dashboard');
        else if (role === 'vendor') navigate('/vendor/dashboard');
        else navigate('/');
      }, 100);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.msg || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', padding: '1rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <h1 style={{textAlign:'center', fontSize:18, marginBottom:4}}>Auth Portal</h1>
      <h2 style={{ textAlign: 'center' }}>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div>
            <label>Name</label>
            <input name="name" value={form.name} onChange={onChange} required />
          </div>
        )}
        <div>
          <label>Email</label>
          <input type="email" name="email" value={form.email} onChange={onChange} required />
        </div>
        <div>
          <label>Password</label>
          <input type="password" name="password" value={form.password} onChange={onChange} required />
        </div>
        {!isLogin && (
          <>
            <div>
              <label>Confirm Password</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={onChange} required />
            </div>
            <div>
              <label>Role</label>
              <select name="role" value={form.role} onChange={onChange}>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </>
        )}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
          {loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
        </button>
      </form>
      <button onClick={toggleMode} style={{ marginTop: '0.75rem', width: '100%' }}>
        {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
      </button>
    </div>
  );
};

export default AuthPage;
