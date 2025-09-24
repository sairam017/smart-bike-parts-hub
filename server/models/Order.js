const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Existing user-based orders (optional for backward compatibility)
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
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
  deliveredAt: Date,

  // New shop-based order fields
  customer: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    contactMethod: { type: String, enum: ['email', 'sms'] }
  },
  shop: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    name: { type: String },
    address: { type: String },
    phone: { type: String }
  },
  products: [
    {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'BikePart' },
      name: { type: String },
      price: { type: Number },
      quantity: { type: Number },
      subtotal: { type: Number }
    }
  ],
  deliveryAddress: { type: String },
  notes: { type: String },
  totalAmount: { type: Number },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  orderDate: { type: Date, default: Date.now },
  
  // Order type to differentiate between user-based and shop-based orders
  orderType: { 
    type: String, 
    enum: ['user_based', 'shop_based'],
    default: function() {
      return this.user ? 'user_based' : 'shop_based';
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
