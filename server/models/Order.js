const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderItems: [
    {
      name: String,
      qty: Number,
      price: Number,
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'BikePart' }
    }
  ],
  shippingAddress: {
    address: String,
    city: String,
    postalCode: String,
    country: String
  },
  paymentMethod: String,
  phone: { type: String },
  collectionDate: { type: Date },
  smsSentAt: { type: Date },
  smsError: { type: String },
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  isDelivered: { type: Boolean, default: false },
  deliveredAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
