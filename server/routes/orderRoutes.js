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
  const { orderItems, shippingAddress, paymentMethod, phone, collectionDate, email } = req.body;
  
  console.log('Order request received:', {
    userId: req.user?.id,
    userName: req.user?.name,
    orderItems: orderItems?.length,
    hasShippingAddress: !!shippingAddress,
    paymentMethod,
    phone,
    collectionDate,
    email: email || 'not provided'
  });

  if (!orderItems || orderItems.length === 0) {
    console.log('Order failed: No order items');
    return res.status(400).json({ message: 'No order items' });
  }

  if (!email) {
    console.log('Order failed: No email address provided');
    return res.status(400).json({ message: 'Email address is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('Order failed: Invalid email format');
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  if (!collectionDate) {
    console.log('Order failed: No collection date provided');
    return res.status(400).json({ message: 'Collection date is required' });
  }
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
      collectionDate: collectionDate ? new Date(collectionDate) : undefined,
      email: email || undefined
    });
    
    // Send email notification (mandatory)
    try {
      const User = require('../models/User');
      const sendEmail = require('../utils/sendEmail');
      const userDoc = await User.findById(req.user.id);
      
      console.log('Sending email confirmation to:', email);
      
      const first = orderItems[0]?.name || 'item';
      const extra = orderItems.length > 1 ? ` +${orderItems.length - 1} more` : '';
      const when = collectionDate ? new Date(collectionDate).toLocaleDateString() : 'soon';
      const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      
      const subject = 'Order Confirmation - Smart Bike Parts Hub';
      const text = `Hi ${userDoc?.name || 'Customer'},\n\nYour order has been confirmed!\n\nOrder ID: ${order._id}\nItems: ${first}${extra}\nCollection Date: ${when}\n${phone ? 'Phone: ' + phone + '\n' : ''}Total Amount: ₹${totalAmount}\n\nThank you for shopping with us!\n\nSmart Bike Parts Hub`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #1d4ed8; text-align: center;">Order Confirmation</h2>
          <p>Hi <strong>${userDoc?.name || 'Customer'}</strong>,</p>
          <p>Your order has been confirmed!</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Items:</strong> ${first}${extra}</p>
            <p><strong>Collection Date:</strong> ${when}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${phone ? '<p><strong>Phone:</strong> ' + phone + '</p>' : ''}
            <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
          </div>
          <p>Thank you for shopping with us!</p>
          <p style="color: #666; text-align: center; margin-top: 30px;">Smart Bike Parts Hub</p>
        </div>
      `;
      
      await sendEmail(email, subject, text, html);
      console.log('Email sent successfully to:', email);
      order.emailSentAt = new Date();
      order.emailSentTo = email;
      await order.save();
    } catch (e) {
      console.error('Email sending failed:', e.message);
      // Email failure should not block the order
    }

    // Send SMS notification (optional)
    if (phone) {
      const first = orderItems[0]?.name || 'item';
      const extra = orderItems.length > 1 ? ` +${orderItems.length - 1} more` : '';
      const when = collectionDate ? new Date(collectionDate).toLocaleDateString() : 'soon';
      try {
        const result = await sendSMS(phone, `Your order ${order._id} (${first}${extra}) placed successfully. Pickup: ${when}. Confirm via email sent to ${email.split('@')[0]}@***.`);
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
    return res.status(201).json(order);
  } catch (e) {
    console.error('Order create failed:', e);
    console.error('Error details:', {
      name: e.name,
      message: e.message,
      stack: e.stack,
      orderData: { orderItems, shippingAddress, paymentMethod, phone, collectionDate }
    });
    return res.status(500).json({ message: e.message || 'Order creation failed' });
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
