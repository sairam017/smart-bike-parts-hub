const express = require('express');
const router = express.Router();
const { register, login, updateProfile } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
// Public registration (always creates customer only now)
router.post('/register', register);

// Admin create user with role (vendor/admin/customer)
router.post('/admin/create', auth, (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  next();
}, register);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', login);

// Authenticated user profile update
router.put('/profile', auth, updateProfile);

module.exports = router;
