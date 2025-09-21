const mongoose = require('mongoose');

const CompanyMetaSchema = new mongoose.Schema({
  company: { type: String, required: true, unique: true, trim: true },
  image: { type: String }, // stored as /uploads/... path or external URL
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('CompanyMeta', CompanyMetaSchema);
