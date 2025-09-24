import api from './api';

const orderService = {
  // Create a new order (authenticated)
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/orders/authenticated', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  // Create a shop-based order (without authentication)
  createShopOrder: async (orderData) => {
    try {
      const response = await api.post('/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating shop order:', error);
      throw error;
    }
  },

  // Get user's orders
  getMyOrders: async () => {
    try {
      const response = await api.get('/orders/my/list');
      return response.data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  },

  // Get single order
  getOrder: async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  },

  // Pay for order
  payOrder: async (orderId) => {
    try {
      const response = await api.put(`/orders/${orderId}/pay`);
      return response.data;
    } catch (error) {
      console.error('Error paying for order:', error);
      throw error;
    }
  },

  // Send email confirmation
  sendEmailConfirmation: async (orderId, email) => {
    try {
      const response = await api.post('/orders/confirm-email', { orderId, email });
      return response.data;
    } catch (error) {
      console.error('Error sending email confirmation:', error);
      throw error;
    }
  },

  // Send SMS confirmation
  sendSMSConfirmation: async (orderId, phone) => {
    try {
      const response = await api.post('/orders/confirm-sms', { orderId, phone });
      return response.data;
    } catch (error) {
      console.error('Error sending SMS confirmation:', error);
      throw error;
    }
  },

  // Format order data for API
  formatOrderData: (products, userInfo, deliveryInfo) => {
    return {
      orderItems: products.map(product => ({
        product: product._id,
        name: product.name || product.model,
        price: product.price,
        qty: product.quantity || 1
      })),
      shippingAddress: {
        address: deliveryInfo.address,
        city: deliveryInfo.city,
        postalCode: deliveryInfo.postalCode,
        country: deliveryInfo.country || 'India'
      },
      paymentMethod: deliveryInfo.paymentMethod || 'Cash on Delivery',
      phone: userInfo.phone,
      email: userInfo.email,
      collectionDate: deliveryInfo.collectionDate
    };
  },

  // Format shop-based order data
  formatShopOrderData: (products, customer, shop, deliveryAddress, notes) => {
    const totalAmount = products.reduce((sum, product) => 
      sum + (product.price * (product.quantity || 1)), 0
    );

    return {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        contactMethod: customer.contactMethod || 'email'
      },
      shop: {
        id: shop._id,
        name: shop.name,
        address: shop.address,
        phone: shop.phone
      },
      products: products.map(product => ({
        id: product._id,
        name: product.name || product.model,
        price: product.price,
        quantity: product.quantity || 1,
        subtotal: product.price * (product.quantity || 1)
      })),
      deliveryAddress,
      notes,
      totalAmount
    };
  },

  // Calculate order total
  calculateTotal: (products) => {
    return products.reduce((sum, product) => 
      sum + (product.price * (product.quantity || 1)), 0
    );
  },

  // Validate order data
  validateOrderData: (orderData) => {
    const errors = [];

    if (!orderData.orderItems || orderData.orderItems.length === 0) {
      errors.push('At least one product is required');
    }

    if (!orderData.email) {
      errors.push('Email address is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(orderData.email)) {
        errors.push('Please enter a valid email address');
      }
    }

    if (!orderData.phone) {
      errors.push('Phone number is required');
    }

    if (!orderData.collectionDate) {
      errors.push('Collection date is required');
    }

    if (!orderData.shippingAddress?.address) {
      errors.push('Delivery address is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

export default orderService;