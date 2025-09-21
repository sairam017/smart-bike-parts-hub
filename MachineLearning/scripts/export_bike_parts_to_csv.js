// Script to export bike parts and shop data to CSV for ML
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const BikePart = require('../../server/models/BikePart');
const Shop = require('../../server/models/Shop');

const CSV_PATH = path.join(__dirname, '../data/bike_parts_dataset.csv');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bikeparts';

async function main() {
  await mongoose.connect(MONGO_URI);
  const parts = await BikePart.find({}).populate('shop');
  const headers = [
    'product_id','name','type','company','model','year','price','shop_id','image_url','rating','num_reviews','shop_name','shop_lat','shop_lon'
  ];
  const rows = [headers.join(',')];
  for (const part of parts) {
    const shop = part.shop || {};
    const images = Array.isArray(part.images) && part.images.length ? part.images[0] : '';
    const row = [
      part._id,
      JSON.stringify(part.name || ''),
      JSON.stringify(part.type || ''),
      JSON.stringify(part.company || ''),
      JSON.stringify(part.model || ''),
      part.vehicleYear || '',
      part.price || '',
      shop._id || '',
      JSON.stringify(images),
      part.rating || 0,
      part.numReviews || 0,
      JSON.stringify(shop.name || ''),
      shop.location && shop.location.coordinates ? shop.location.coordinates[1] : '',
      shop.location && shop.location.coordinates ? shop.location.coordinates[0] : ''
    ];
    rows.push(row.join(','));
  }
  fs.writeFileSync(CSV_PATH, rows.join('\n'), 'utf8');
  console.log('Exported', parts.length, 'rows to', CSV_PATH);
  mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
