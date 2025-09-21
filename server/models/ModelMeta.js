const mongoose = require('mongoose');

const ModelMetaSchema = new mongoose.Schema({
  company: { type: String, required: true, index: true, trim: true },
  model: { type: String, required: true, trim: true },
  image: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

ModelMetaSchema.index({ company: 1, model: 1 }, { unique: true });

module.exports = mongoose.model('ModelMeta', ModelMetaSchema);
