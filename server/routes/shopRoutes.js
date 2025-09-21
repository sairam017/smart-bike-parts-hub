const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const auth = require('../middleware/authMiddleware');

// Public list with optional geo filter (for customers)
router.get('/', async (req, res) => {
  const { lat, lng, radius } = req.query;
  let query = {};
  if (lat && lng && radius) {
    query = {
      location: { $geoWithin: { $centerSphere: [[ parseFloat(lng), parseFloat(lat) ], parseFloat(radius)/6378.1 ] } }
    };
  }
  const shops = await Shop.find(query).populate('vendor','name email');
  res.json(shops);
});

// Vendor: get my shop (single)
router.get('/me', auth, async (req, res) => {
  if(!['vendor','admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  const filter = req.user.role === 'vendor' ? { vendor: req.user.id } : {};
  const shop = await Shop.findOne(filter).populate('vendor','name email');
  if(!shop) return res.status(404).json({ message: 'Shop not found' });
  res.json(shop);
});

// Vendor/Admin: update my shop address and coordinates
router.put('/me', auth, async (req, res) => {
  try {
    if(!['vendor','admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    const filter = req.user.role === 'vendor' ? { vendor: req.user.id } : { _id: req.body.id };
    const shop = await Shop.findOne(filter);
    if(!shop) return res.status(404).json({ message: 'Shop not found' });
    const { name, address, phone, website, latitude, longitude } = req.body;
    if(name !== undefined) shop.name = name;
    if(address !== undefined) shop.address = address;
    if(phone !== undefined) shop.phone = phone;
    if(website !== undefined) shop.website = website;
    if(latitude != null && longitude != null) {
      const latNum = parseFloat(latitude); const lngNum = parseFloat(longitude);
      if (isNaN(latNum) || isNaN(lngNum)) return res.status(400).json({ message: 'Invalid coordinates' });
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return res.status(400).json({ message: 'Coordinates out of range' });
      shop.location = { type: 'Point', coordinates: [ lngNum, latNum ] };
    }
    await shop.save();
    res.json(shop);
  } catch (e) {
    console.error('Update shop error', e);
    res.status(500).json({ message: 'Failed to update shop', error: e.message });
  }
});

// Vendor/Admin create
router.post('/', auth, async (req, res) => {
  try {
    if(!['vendor','admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    const { name, address, phone, website, latitude, longitude } = req.body;
    if(latitude == null || longitude == null) return res.status(400).json({ message: 'Missing coordinates' });
    const latNum = parseFloat(latitude); const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) return res.status(400).json({ message: 'Invalid coordinates' });
    const shop = await Shop.create({
      name, address, phone, website, vendor: req.user.id,
      location: { type: 'Point', coordinates: [ lngNum, latNum ] }
    });
    res.status(201).json(shop);
  } catch (e) {
    console.error('Create shop error', e);
    res.status(500).json({ message: 'Failed to create shop', error: e.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if(!shop) return res.status(404).json({ message: 'Not found' });
  if(shop.vendor.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { name, address, phone, website, latitude, longitude } = req.body;
  if(name !== undefined) shop.name = name;
  if(address !== undefined) shop.address = address;
  if(phone !== undefined) shop.phone = phone;
  if(website !== undefined) shop.website = website;
  if(latitude != null && longitude != null) shop.location = { type: 'Point', coordinates: [ parseFloat(longitude), parseFloat(latitude) ] };
  await shop.save();
  res.json(shop);
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if(!shop) return res.status(404).json({ message: 'Not found' });
  if(shop.vendor.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await shop.deleteOne();
  res.json({ message: 'Deleted' });
});

module.exports = router;
