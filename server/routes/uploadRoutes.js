const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/authMiddleware');

// Storage engine
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

function fileFilter (_req, file, cb){
  if (/^image\//.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files are allowed'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Vendor or admin can upload product images
router.post('/', auth, upload.single('image'), (req, res) => {
  if (!['vendor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.status(201).json({ url: fileUrl, filename: req.file.filename });
});

module.exports = router;
