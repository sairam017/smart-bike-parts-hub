const express = require('express');
const router = express.Router();
const BikePart = require('../models/BikePart');
const Shop = require('../models/Shop');
const Order = require('../models/Order');
const auth = require('../middleware/authMiddleware');
const axios = require('axios');

// ML Service URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8010';

// Helper function to update CSV when products are added/modified
async function updateCSVPipeline(productData) {
  try {
    // Call FastAPI service to add the new product to CSV
    await axios.post(`${ML_SERVICE_URL}/data-pipeline/sync-product`, productData);
    console.log('CSV updated successfully for product:', productData._id || productData.name);
  } catch (error) {
    console.error('Failed to update CSV:', error.message);
    // Don't throw error - CSV update failure shouldn't break product creation
  }
}

// Public list
// Unique companies (exclude null/empty)
router.get('/groups/companies', async (_req, res) => {
  const companies = await BikePart.distinct('company', { company: { $nin: [null, ''] } });
  res.json({ companies });
});

// Unique models by company
router.get('/groups/models', async (req, res) => {
  const company = req.query.company;
  if (!company) return res.status(400).json({ message: 'company is required' });
  const models = await BikePart.distinct('model', { company, model: { $nin: [null, ''] } });
  res.json({ company, models });
});

// Distinct brands
router.get('/groups/brands', async (_req, res) => {
  const brands = await BikePart.distinct('brand', { brand: { $nin: [null, ''] } });
  res.json({ brands });
});

// Distinct types
router.get('/groups/types', async (_req, res) => {
  const types = await BikePart.distinct('type', { type: { $nin: [null, ''] } });
  res.json({ types });
});

// Distinct vehicle years
router.get('/groups/years', async (_req, res) => {
  const years = await BikePart.distinct('vehicleYear', { vehicleYear: { $ne: null } });
  years.sort((a,b)=> b - a); // descending
  res.json({ years });
});

// Public list
router.get('/', async (req, res) => {
  const pageSize = Number(req.query.pageSize) > 0 ? Math.min(Number(req.query.pageSize), 100) : 10;
  const page = Number(req.query.page) || 1;
  const filter = {};
  const simpleFields = ['brand','company','model','type','shop'];
  simpleFields.forEach(f => { if (req.query[f]) filter[f] = req.query[f]; });
  if (req.query.year) filter.vehicleYear = Number(req.query.year);
  const kw = (req.query.keyword || '').trim();
  if (kw) {
    const regex = { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [ 'name','model','company','brand','type' ].map(f => ({ [f]: regex }));
  }
  try {
    const count = await BikePart.countDocuments(filter);
    const products = await BikePart.find(filter)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .populate({ path: 'shop', select: 'name address location' })
      .lean();
    res.json({ products, page, pages: Math.ceil(count / pageSize), total: count, filterApplied: filter });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Debug: view first 20 raw docs (admin only)
router.get('/debug/raw', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const docs = await BikePart.find({}).limit(20).lean();
    res.json({ count: docs.length, docs });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const product = await BikePart.findById(req.params.id).populate('shop','name address location');
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

// Vendor/Admin create part tied to vendor's own shop
router.post('/', auth, async (req, res) => {
  if (!['vendor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  let shopId = req.body.shop;
  if (req.user.role === 'vendor') {
    const myShop = await Shop.findOne({ vendor: req.user.id });
    if (!myShop) return res.status(400).json({ message: 'Create/update your shop first' });
    shopId = myShop._id;
  }
  // Accept either a single model or an array of models; expand to multiple docs when needed
  const images = Array.isArray(req.body.images) ? req.body.images : [];
  if (req.body.imageUrl) images.unshift(req.body.imageUrl);
  const base = { ...req.body, images };
  const models = Array.isArray(req.body.models) ? req.body.models : [];
  let createdDocs = [];
  if (models.filter(Boolean).length > 1) {
    const docs = models.filter(Boolean).map(m => {
      const name = base.name || [base.company, m].filter(Boolean).join(' ') || 'Bike Part';
      return { ...base, model: m, name, vendor: req.user.id, shop: shopId };
    });
    createdDocs = await BikePart.insertMany(docs);
    
    // Update CSV for each created product
    for (const doc of createdDocs) {
      await updateCSVPipeline(doc);
    }
    
    return res.status(201).json({ created: createdDocs.map(d => d._id) });
  } else {
    const model = (models[0] || base.model || '').trim();
    const name = base.name || [base.company, model].filter(Boolean).join(' ') || 'Bike Part';
    const payload = { ...base, model, name, vendor: req.user.id, shop: shopId };
    const created = await BikePart.create(payload);
    
    // Update CSV for the new product
    await updateCSVPipeline(created);
    
    return res.status(201).json(created);
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  const product = await BikePart.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (req.user.role === 'vendor') {
    const myShop = await Shop.findOne({ vendor: req.user.id });
    if (!myShop || product.shop.toString() !== myShop._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  Object.assign(product, req.body);
  await product.save();
  res.json(product);
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  const product = await BikePart.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (req.user.role === 'vendor') {
    const myShop = await Shop.findOne({ vendor: req.user.id });
    if (!myShop || product.shop.toString() !== myShop._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await product.deleteOne();
  res.json({ message: 'Deleted' });
});

// Review status: can the user review & have they already reviewed
router.get('/:id/review-status', auth, async (req, res) => {
  try {
    const product = await BikePart.findById(req.params.id).select('_id reviews');
    if (!product) return res.status(404).json({ message: 'Not found' });
    const already = product.reviews?.some(r => r.user.toString() === req.user.id) || false;
    let hasPurchased = false;
    if (!already) {
      hasPurchased = !!(await Order.exists({ user: req.user.id, 'orderItems.product': product._id }));
    } else {
      hasPurchased = true; // if already reviewed must have purchased earlier by definition below
    }
    res.json({ canReview: hasPurchased && !already, alreadyReviewed: already });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Users can rate products (1-5) with comment only after purchase; one review per user per product
router.post('/:id/reviews', auth, async (req, res) => {
  try {
    if (!['vendor','admin','customer'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    const { rating, comment } = req.body;
    if (!rating) return res.status(400).json({ message: 'Rating required' });
    const product = await BikePart.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Not found' });
    const already = product.reviews?.find(r => r.user.toString() === req.user.id);
    if (already) return res.status(400).json({ message: 'Product already reviewed' });
    const hasPurchased = await Order.exists({ user: req.user.id, 'orderItems.product': product._id });
    if (!hasPurchased) return res.status(400).json({ message: 'Purchase required before reviewing' });
    product.reviews.push({ user: req.user.id, name: req.user.name, rating: Number(rating), comment });
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((a, r) => a + r.rating, 0) / product.numReviews;
    await product.save();
    res.status(201).json({ message: 'Review added' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
