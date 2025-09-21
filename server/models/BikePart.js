const mongoose = require('mongoose');

const BikePartSchema = new mongoose.Schema({
    name: { type: String }, // optional if using model/company naming
    model: { type: String },
    company: { type: String },
    vehicleYear: { type: Number },
    brand: { type: String },
    type: { type: String },
    compatibility: [String],
    countInStock: { type: Number, default: 0 },
    price: { type: Number, required: true },
    images: [{ type: String }],
    description: { type: String },
    reviews: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: String,
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: String,
        createdAt: { type: Date, default: Date.now }
    }],
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true }
}, { timestamps: true });

module.exports = mongoose.model('BikePart', BikePartSchema);
