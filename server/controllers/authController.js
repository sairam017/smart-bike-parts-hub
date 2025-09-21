const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Token now contains flat fields: id, role, email, name
const genToken = (user) => {
  const payload = { id: user._id, role: user.role, email: user.email, name: user.name };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
};

exports.register = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;
    email = String(email || '').trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    // Enforce role rules: only an authenticated admin (set by upstream middleware) can create vendor/admin
    if (!req.user || req.user.role !== 'admin') {
      role = 'customer'; // override any supplied role
    } else if (!['customer','vendor','admin'].includes(role)) {
      role = 'customer';
    }

    const user = await User.create({ name, email, password, role });
    // Send welcome email to new customer
    if (role === 'customer') {
      try {
        const sendEmail = require('../utils/sendEmail');
        await sendEmail(
          user.email,
          'Welcome to Smart Bike Parts Locator app',
          `Hi ${user.name},\n\nWelcome to Smart Bike Parts Locator app! We're excited to have you onboard.\n\nFind the best bike parts and shops with us.\n\nBest regards,\nSmart Bike Parts Hub Team`
        );
      } catch (mailErr) {
        console.error('Failed to send welcome email:', mailErr);
      }
    }
    const token = genToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await user.matchPassword(password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    const token = genToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update profile: supports name, email, password changes.
// For changing email or password, require currentPassword verification.
// Body: { name?, email?, currentPassword?, newPassword? }
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let needPasswordCheck = false;
    if (typeof email === 'string' && email.trim().toLowerCase() !== user.email) needPasswordCheck = true;
    if (newPassword) needPasswordCheck = true;

    if (needPasswordCheck) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password required' });
      const ok = await user.matchPassword(currentPassword);
      if (!ok) return res.status(400).json({ message: 'Current password incorrect' });
    }

    if (name) user.name = name;
    if (typeof email === 'string' && email.trim().toLowerCase() !== user.email) {
      const newEmail = email.trim().toLowerCase();
      const taken = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
      if (taken) return res.status(400).json({ message: 'Email already in use' });
      user.email = newEmail;
    }
    if (newPassword) user.password = newPassword; // will hash via pre-save

    await user.save();
    const token = genToken(user);
    res.json({
      message: 'Profile updated',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};
