const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Email transporter configuration (you'll need to update this with actual SMTP settings)
const createTransporter = () => {
  // For development, you can use services like Gmail, SendGrid, or Mailtrap
  // For production, use a proper SMTP service
  
  // Example Gmail configuration (requires app password)
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com', // Replace with your email
      pass: process.env.EMAIL_PASS || 'your-app-password' // Replace with your app password
    }
  });
  
  // Alternative: Using a development mail service like Mailtrap
  /*
  return nodemailer.createTransporter({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS
    }
  });
  */
};

// Send product list via email
router.post('/send-product-list', async (req, res) => {
  try {
    const { email, name, message, products, userLocation } = req.body;

    if (!email || !name || !products || !Array.isArray(products)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: email, name, and products array' 
      });
    }

    const transporter = createTransporter();

    // Create HTML email content
    const productListHtml = products.map(product => `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 8px 0;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937;">${product.name}</h3>
        <p style="margin: 4px 0; color: #6b7280;"><strong>Company:</strong> ${product.company || 'N/A'}</p>
        <p style="margin: 4px 0; color: #6b7280;"><strong>Model:</strong> ${product.model || 'N/A'}</p>
        <p style="margin: 4px 0; color: #6b7280;"><strong>Type:</strong> ${product.type || 'N/A'}</p>
        <p style="margin: 4px 0; color: #1f2937; font-weight: 600;"><strong>Price:</strong> ₹${product.price || 'N/A'}</p>
        ${product.description ? `<p style="margin: 8px 0 0 0; color: #4b5563; font-size: 14px;">${product.description}</p>` : ''}
      </div>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin: 0;">🏍️ Smart Bike Parts Hub</h1>
          <p style="color: #6b7280; margin: 8px 0 0 0;">Your Requested Product List</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; color: #374151;"><strong>Requested by:</strong> ${name}</p>
          <p style="margin: 4px 0 0 0; color: #374151;"><strong>Email:</strong> ${email}</p>
          ${userLocation ? `<p style="margin: 4px 0 0 0; color: #374151;"><strong>Location:</strong> ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}</p>` : ''}
          ${message ? `<p style="margin: 8px 0 0 0; color: #374151;"><strong>Message:</strong> ${message}</p>` : ''}
        </div>

        <h2 style="color: #1f2937; margin: 20px 0 16px 0;">📦 Products (${products.length} items)</h2>
        ${productListHtml}

        <div style="margin-top: 30px; padding: 16px; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;">
          <p style="margin: 0; color: #047857; font-weight: 600;">Next Steps:</p>
          <ul style="margin: 8px 0 0 0; color: #047857;">
            <li>Visit our website to check current availability</li>
            <li>Contact nearby shops for product availability</li>
            <li>Use our map feature to find directions to shops</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Thank you for using Smart Bike Parts Hub!<br>
            Find the best bike parts and locate nearby shops.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'smart-bike-parts@gmail.com',
      to: email,
      subject: `🏍️ Your Bike Parts List - ${products.length} Products`,
      html: htmlContent,
      text: `Hello ${name},\n\nHere are the ${products.length} bike parts you requested:\n\n${products.map(p => `• ${p.name} - ₹${p.price} (${p.company})`).join('\n')}\n\nThank you for using Smart Bike Parts Hub!`
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Product list sent successfully to your email!'
    });

  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Send shop locations via email
router.post('/send-shop-locations', async (req, res) => {
  try {
    const { email, name, message, shops, userLocation } = req.body;

    if (!email || !name || !shops || !Array.isArray(shops)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: email, name, and shops array' 
      });
    }

    const transporter = createTransporter();

    // Create HTML email content
    const shopListHtml = shops.map((shop, index) => `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 8px 0;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937;">${index + 1}. ${shop.name}</h3>
        <p style="margin: 4px 0; color: #6b7280;"><strong>📍 Address:</strong> ${shop.address || 'Address not available'}</p>
        ${shop.phone ? `<p style="margin: 4px 0; color: #6b7280;"><strong>📞 Phone:</strong> ${shop.phone}</p>` : ''}
        <p style="margin: 4px 0; color: #6b7280;"><strong>📦 Products:</strong> ${shop.productCount || 0} items available</p>
        ${shop.distance ? `<p style="margin: 4px 0; color: #059669; font-weight: 600;"><strong>🚗 Distance:</strong> ${shop.distance.toFixed(2)} km away</p>` : ''}
        
        <div style="margin-top: 12px;">
          <a href="${shop.googleMapsUrl}" style="display: inline-block; padding: 8px 12px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; margin-right: 8px;">
            🗺️ View on Map
          </a>
          ${shop.directionsUrl ? `
            <a href="${shop.directionsUrl}" style="display: inline-block; padding: 8px 12px; background: #059669; color: white; text-decoration: none; border-radius: 6px; font-size: 12px;">
              🧭 Get Directions
            </a>
          ` : ''}
        </div>
      </div>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin: 0;">🏍️ Smart Bike Parts Hub</h1>
          <p style="color: #6b7280; margin: 8px 0 0 0;">Shop Locations & Directions</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; color: #374151;"><strong>Requested by:</strong> ${name}</p>
          <p style="margin: 4px 0 0 0; color: #374151;"><strong>Email:</strong> ${email}</p>
          ${userLocation ? `<p style="margin: 4px 0 0 0; color: #374151;"><strong>Your Location:</strong> ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}</p>` : ''}
          ${message ? `<p style="margin: 8px 0 0 0; color: #374151;"><strong>Message:</strong> ${message}</p>` : ''}
        </div>

        <h2 style="color: #1f2937; margin: 20px 0 16px 0;">🏪 Shop Locations (${shops.length} shops)</h2>
        ${shopListHtml}

        <div style="margin-top: 30px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">💡 Tips:</p>
          <ul style="margin: 8px 0 0 0; color: #92400e;">
            <li>Call ahead to confirm product availability</li>
            <li>Check shop opening hours before visiting</li>
            <li>Use the "Get Directions" buttons for turn-by-turn navigation</li>
            <li>Compare prices and stock levels between shops</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Thank you for using Smart Bike Parts Hub!<br>
            Find the best bike parts and locate nearby shops.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'smart-bike-parts@gmail.com',
      to: email,
      subject: `🏪 Shop Locations & Directions - ${shops.length} Shops Found`,
      html: htmlContent,
      text: `Hello ${name},\n\nHere are the ${shops.length} bike part shops near you:\n\n${shops.map((s, i) => `${i + 1}. ${s.name} - ${s.address}${s.distance ? ` (${s.distance.toFixed(2)} km away)` : ''}`).join('\n')}\n\nThank you for using Smart Bike Parts Hub!`
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Shop locations sent successfully to your email!'
    });

  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Send general inquiry email
router.post('/send-inquiry', async (req, res) => {
  try {
    const { email, name, subject, message, products } = req.body;

    if (!email || !name || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: email, name, and message' 
      });
    }

    const transporter = createTransporter();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin: 0;">🏍️ Smart Bike Parts Hub</h1>
          <p style="color: #6b7280; margin: 8px 0 0 0;">Customer Inquiry</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; color: #374151;"><strong>From:</strong> ${name}</p>
          <p style="margin: 4px 0 0 0; color: #374151;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 4px 0 0 0; color: #374151;"><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
        </div>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937;">Message:</h3>
          <p style="margin: 0; color: #374151; line-height: 1.6;">${message}</p>
        </div>

        ${products && products.length > 0 ? `
          <div style="margin-top: 20px;">
            <h3 style="color: #1f2937; margin: 0 0 12px 0;">Related Products:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #374151;">
              ${products.map(p => `<li>${p.name} - ₹${p.price} (${p.company})</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            This inquiry was sent from Smart Bike Parts Hub
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'smart-bike-parts@gmail.com',
      to: email,
      subject: `Inquiry Received: ${subject || 'General Inquiry'}`,
      html: htmlContent,
      text: `Hello ${name},\n\nWe have received your inquiry:\n\n${message}\n\nWe will get back to you soon!\n\nThank you for contacting Smart Bike Parts Hub!`
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Your inquiry has been sent successfully!'
    });

  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send inquiry. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;