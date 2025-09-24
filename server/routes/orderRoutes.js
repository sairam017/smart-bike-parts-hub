const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const BikePart = require('../models/BikePart');
const Shop = require('../models/Shop');
const auth = require('../middleware/authMiddleware');
const { sendSMS } = require('../utils/sms');

// Create order (shop-based without authentication)
router.post('/', async (req, res) => {
  try {
    const { customer, shop, products, deliveryAddress, notes, totalAmount } = req.body;

    // Validate required fields
    if (!customer || !shop || !products || !deliveryAddress) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate contact method
    if (customer.contactMethod === 'email' && !customer.email) {
      return res.status(400).json({ message: 'Email is required when contact method is email' });
    }

    if (customer.contactMethod === 'sms' && !customer.phone) {
      return res.status(400).json({ message: 'Phone is required when contact method is SMS' });
    }

    // Create order
    const order = new Order({
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        contactMethod: customer.contactMethod
      },
      shop: {
        id: shop.id,
        name: shop.name,
        address: shop.address,
        phone: shop.phone
      },
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        subtotal: product.subtotal
      })),
      deliveryAddress,
      notes,
      totalAmount,
      status: 'pending',
      orderDate: new Date()
    });

    const savedOrder = await order.save();

    res.status(201).json({
      success: true,
      orderId: savedOrder._id,
      message: 'Order placed successfully'
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Send email confirmation
router.post('/confirm-email', async (req, res) => {
  try {
    const { orderId, email } = req.body;

    // Here you would integrate with your email service (SendGrid, Nodemailer, etc.)
    // For now, we'll just log it
    console.log(`Sending email confirmation for order ${orderId} to ${email}`);

    // Simulate email sending
    setTimeout(() => {
      console.log(`Email confirmation sent for order ${orderId}`);
    }, 1000);

    res.json({ success: true, message: 'Email confirmation sent' });
  } catch (error) {
    console.error('Error sending email confirmation:', error);
    res.status(500).json({ message: 'Failed to send email confirmation' });
  }
});

// Send SMS confirmation
router.post('/confirm-sms', async (req, res) => {
  try {
    const { orderId, phone } = req.body;

    // Here you would integrate with your SMS service
    // For now, we'll just log it
    console.log(`Sending SMS confirmation for order ${orderId} to ${phone}`);

    // You can use the existing sendSMS utility if available
    try {
      const message = `Your order ${orderId} has been placed successfully! We'll contact you soon with delivery details.`;
      // Uncomment if sendSMS is properly configured
      // await sendSMS(phone, message);
      console.log(`SMS confirmation sent for order ${orderId}`);
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
    }

    res.json({ success: true, message: 'SMS confirmation sent' });
  } catch (error) {
    console.error('Error sending SMS confirmation:', error);
    res.status(500).json({ message: 'Failed to send SMS confirmation' });
  }
});

// Create order (original authenticated version)
router.post('/authenticated', auth, async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, phone, collectionDate } = req.body;
  if (!orderItems || orderItems.length === 0) return res.status(400).json({ message: 'No order items' });
  // Validate and decrement stock atomically (two-phase: check then bulk update)
  try {
    const productIds = orderItems.map(i => i.product).filter(Boolean);
    const parts = await BikePart.find({ _id: { $in: productIds } });
    const partMap = new Map(parts.map(p => [p._id.toString(), p]));
    for (const itm of orderItems) {
      const p = partMap.get(itm.product);
      if (!p) return res.status(400).json({ message: `Part not found: ${itm.product}` });
      if (p.countInStock < itm.qty) return res.status(400).json({ message: `Insufficient stock for ${p.name || p.model || p._id}` });
    }
    // Perform bulk decrement
    const bulk = orderItems.map(itm => ({
      updateOne: {
        filter: { _id: itm.product, countInStock: { $gte: itm.qty } },
        update: { $inc: { countInStock: -itm.qty } }
      }
    }));
    const bulkResult = await BikePart.bulkWrite(bulk, { ordered: true });
    // Double-check all matched
    if (bulkResult.nMatched !== orderItems.length) {
      return res.status(409).json({ message: 'Stock changed during order. Please refresh cart.' });
    }
    const order = await Order.create({
      user: req.user.id,
      orderItems,
      shippingAddress,
      paymentMethod,
      phone,
      collectionDate: collectionDate ? new Date(collectionDate) : undefined
    });
    // Send SMS notification
    if (phone) {
      const first = orderItems[0]?.name || 'item';
      const extra = orderItems.length > 1 ? ` +${orderItems.length - 1} more` : '';
      const when = collectionDate ? new Date(collectionDate).toLocaleDateString() : 'soon';
      try {
        const result = await sendSMS(phone, `Your order ${order._id} (${first}${extra}) placed successfully. Pickup: ${when}.`);
        if (result.ok) {
          order.smsSentAt = new Date();
        } else {
          order.smsError = result.error;
        }
        await order.save();
      } catch (e) {
        order.smsError = e.message;
        await order.save();
      }
    }
    // Send email notification
    try {
      const User = require('../models/User');
      const sendEmail = require('../utils/sendEmail');
      const userDoc = await User.findById(req.user.id);
      if (userDoc && userDoc.email) {
        const first = orderItems[0]?.name || 'item';
        const extra = orderItems.length > 1 ? ` +${orderItems.length - 1} more` : '';
        const when = collectionDate ? new Date(collectionDate).toLocaleDateString() : 'soon';
        const subject = `Order Confirmation - ${order._id}`;
        const text = `Dear ${userDoc.name},\n\nYour order (${first}${extra}) has been placed successfully.\nPickup date: ${when}.\nOrder ID: ${order._id}\nThank you for shopping with Smart Bike Parts Hub!`;
        const html = `<p>Dear ${userDoc.name},</p><p>Your order <b>${first}${extra}</b> has been placed successfully.</p><p>Pickup date: <b>${when}</b></p><p>Order ID: <b>${order._id}</b></p><p>Thank you for shopping with <b>Smart Bike Parts Hub</b>!</p>`;
        await sendEmail(userDoc.email, subject, text, html);
      }
    } catch (e) {
      console.error('Order email failed', e);
    }
    return res.status(201).json(order);
  } catch (e) {
    console.error('Order create failed', e);
    return res.status(500).json({ message: e.message });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  res.json(order);
});

// Pay order
router.put('/:id/pay', auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.user.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  order.isPaid = true;
  order.paidAt = Date.now();
  await order.save();
  res.json(order);
});

// List my orders
router.get('/my/list', auth, async (req, res) => {
  const orders = await Order.find({ user: req.user.id })
    .sort('-createdAt')
    .populate({
      path: 'orderItems.product',
      select: 'name model shop rating numReviews', // include aggregate rating info
      populate: { path: 'shop', select: 'name phone location' }
    })
    .lean();
  res.json(orders);
});

// Admin deliver
router.put('/:id/deliver', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  order.isDelivered = true;
  order.deliveredAt = Date.now();
  await order.save();
  res.json(order);
});

module.exports = router;
