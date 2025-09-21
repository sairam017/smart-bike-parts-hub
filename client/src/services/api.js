import axios from 'axios';

const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL, withCredentials: false });

// Attach stored token
api.interceptors.request.use(cfg => {
    try {
        const token = localStorage.getItem('token');
        if (token) cfg.headers.Authorization = `Bearer ${token}`;
    } catch(_){}
    return cfg;
});

// Global basic error translation for network errors
api.interceptors.response.use(r=>r, err => {
    if (err.message === 'Network Error' && !err.response) {
        console.error('Network error contacting API', baseURL);
    }
    return Promise.reject(err);
});

export default api;
