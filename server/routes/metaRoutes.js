const express = require('express');
const CompanyMeta = require('../models/CompanyMeta');
const ModelMeta = require('../models/ModelMeta');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Public: list all company metadata
router.get('/companies', async (_req, res) => {
  const companies = await CompanyMeta.find({}).sort({ company: 1 });
  res.json(companies);
});

// Public: list all model metadata for a company
router.get('/models', async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ message: 'company is required' });
  const models = await ModelMeta.find({ company }).sort({ model: 1 });
  res.json(models);
});

// Upsert company image (vendor or admin)
router.post('/companies', auth, async (req, res) => {
  if (!['vendor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  const { company, image } = req.body;
  if (!company) return res.status(400).json({ message: 'company is required' });
  try {
    const doc = await CompanyMeta.findOneAndUpdate(
      { company },
      { company, image, updatedBy: req.user.id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to upsert company' });
  }
});

// Upsert model image (vendor or admin)
router.post('/models', auth, async (req, res) => {
  if (!['vendor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  const { company, model, image } = req.body;
  if (!company || !model) return res.status(400).json({ message: 'company and model are required' });
  try {
    const doc = await ModelMeta.findOneAndUpdate(
      { company, model },
      { company, model, image, updatedBy: req.user.id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(doc);
  } catch (e) {
    // Handle duplicate key gracefully
    if (e.code === 11000) {
      return res.status(409).json({ message: 'Duplicate company/model combination' });
    }
    res.status(500).json({ message: e.message || 'Failed to upsert model' });
  }
});

module.exports = router;
