import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import authService from '../services/authService';
import jwtDecode from 'jwt-decode';

const AuthContext = createContext();

const decodeTokenSafe = (token) => {
  try { return jwtDecode(token); } catch { return null; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((token) => {
    if (!token) return;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  const loadFromStorage = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    const decoded = decodeTokenSafe(token);
    if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      setLoading(false);
      return;
    }
    applyToken(token);
    setUser({ id: decoded.id, role: decoded.role, email: decoded.email, name: decoded.name });
    setLoading(false);
  }, [applyToken]);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    applyToken(data.token);
    const decoded = decodeTokenSafe(data.token);
    setUser({ id: decoded.id, role: decoded.role, email: decoded.email, name: decoded.name });
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', data.token);
    applyToken(data.token);
    const decoded = decodeTokenSafe(data.token);
    setUser({ id: decoded.id, role: decoded.role, email: decoded.email, name: decoded.name });
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateProfile = async ({ name, email, currentPassword, newPassword }) => {
    const payload = { name };
    if (email) payload.email = email;
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }
    const { data } = await authService.updateProfile(payload);
    if (data?.token) {
      localStorage.setItem('token', data.token);
      applyToken(data.token);
      const decoded = decodeTokenSafe(data.token);
      setUser({ id: decoded.id, role: decoded.role, email: decoded.email, name: decoded.name });
    }
    return data;
  };

  return (
  <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
