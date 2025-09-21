import api from './api';

const register = (userData) => {
    return api.post('/auth/register', userData);
};

const login = (userData) => {
    return api.post('/auth/login', userData);
};

const updateProfile = (payload) => {
    return api.put('/auth/profile', payload);
};

const authService = {
    register,
    login,
    updateProfile,
};

export default authService;
