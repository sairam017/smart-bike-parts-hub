const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
const connectDB = require('./config/db');
const User = require('./models/User');
const Shop = require('./models/Shop');
const BikePart = require('./models/BikePart');

async function ensureAdmin(){
  try {
    const email = 'admin@gmail.com';
    let admin = await User.findOne({ email });
    if(!admin){
      admin = await User.create({ name: 'admin', email, password: 'admin123', role: 'admin' });
      console.log('Seeded default admin user');
    } else {
      let changed = false;
      if(admin.role !== 'admin'){ admin.role = 'admin'; changed = true; }
      // Force reset password to known value
      admin.password = 'admin123';
      changed = true;
      if(changed){
        await admin.save();
        console.log('Verified/updated admin user');
      }
    }
  } catch (e){
    console.error('Failed to ensure admin user', e.message);
  }
}

dotenv.config();
connectDB().then(async () => {
  await ensureAdmin();
  if (process.env.AUTO_SEED === 'true') {
    await seedIfEmpty();
  }
});

const app = express();

// CORS with explicit origin & credentials
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Ensure uploads directory exists and serve it statically
const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.error('Failed to create uploads directory', e.message);
}
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/shops', require('./routes/shopRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/meta', require('./routes/metaRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/route-plan-local', require('./routes/routePlanRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));

// Route planning proxy (Python FastAPI service)
app.post('/api/route-plan', async (req, res) => {
  try {
    const mlUrl = process.env.ML_ROUTE_URL || 'http://localhost:8010/plan';
    const response = await axios.post(mlUrl, req.body, { timeout: 5000 });
    res.json(response.data);
  } catch (e) {
    res.status(500).json({ message: 'Route planning failed', detail: e.message });
  }
});

// Debug DB stats (admin only)
app.get('/api/debug/db-stats', require('./middleware/authMiddleware'), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const [userCount, shopCount, partCount] = await Promise.all([
      User.countDocuments(), Shop.countDocuments(), BikePart.countDocuments()
    ]);
    res.json({ userCount, shopCount, partCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Error middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

const BASE_PORT = parseInt(process.env.PORT, 10) || 5000;
function start(port, attempt = 0) {
  const server = app.listen(port, () => console.log(`Server running on port ${port}`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (attempt < 5) {
        const nextPort = port + 1;
        console.warn(`Port ${port} in use, retrying on ${nextPort} (attempt ${attempt + 1})`);
        setTimeout(() => start(nextPort, attempt + 1), 250);
      } else {
        console.error(`Failed to bind after ${attempt + 1} attempts. Exiting.`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
  return server;
}
start(BASE_PORT);

// Optional: auto start Python ML service (FastAPI) if enabled.
if (process.env.AUTO_START_ML === 'true') {
  const mlUrl = process.env.ML_ROUTE_URL || 'http://localhost:8010/plan';
  const { spawn } = require('child_process');
  (async () => {
    try {
      // quick probe
      await axios.get(mlUrl.replace(/\/plan$/, '/health'), { timeout: 1500 });
      console.log('[ML] Existing ML service reachable at', mlUrl);
    } catch {
      console.log('[ML] Launching local FastAPI ML service...');
      const mlDir = path.join(__dirname, '..', 'MachineLearning');
      const py = process.env.PYTHON_BIN || 'python';
      const child = spawn(py, ['-m', 'uvicorn', 'src.api_service:app', '--port', (process.env.ML_PORT||'8010'), '--reload'], {
        cwd: mlDir,
        stdio: 'inherit'
      });
      child.on('exit', code => console.log('[ML] service exited code', code));
    }
  })();
}

async function seedIfEmpty(){
  try {
    const partCount = await BikePart.countDocuments();
    if (partCount > 0) return;
    console.log('Seeding sample data (AUTO_SEED=true)...');
    let vendor = await User.findOne({ email: 'vendor@example.com' });
    if (!vendor) vendor = await User.create({ name: 'Sample Vendor', email: 'vendor@example.com', password: 'vendor123', role: 'vendor' });
    let shop = await Shop.findOne({ vendor: vendor._id });
    if (!shop) shop = await Shop.create({ name: 'Sample Shop', vendor: vendor._id, address: 'Test Address', location: { type: 'Point', coordinates: [77.5946, 12.9716] } });
    await BikePart.insertMany([
      { company: 'Hero', model: 'Splendor', brand: 'OEM', type: 'Engine', price: 1200, countInStock: 10, vendor: vendor._id, shop: shop._id, images: [], name: 'Hero Splendor Engine Part' },
      { company: 'Bajaj', model: 'Pulsar 150', brand: 'Aftermarket', type: 'Body', price: 800, countInStock: 5, vendor: vendor._id, shop: shop._id, images: [], name: 'Pulsar 150 Body Panel' }
    ]);
    console.log('Sample data seeded');
  } catch (e) {
    console.error('Seeding failed:', e.message);
  }
}
