import api from './api';

const emailService = {
  // Send email with product list and shop information
  sendProductListEmail: async (emailData) => {
    try {
      const response = await api.post('/email/send-product-list', emailData);
      return response.data;
    } catch (error) {
      console.error('Error sending product list email:', error);
      throw error;
    }
  },

  // Send email with shop locations and directions
  sendShopLocationsEmail: async (emailData) => {
    try {
      const response = await api.post('/email/send-shop-locations', emailData);
      return response.data;
    } catch (error) {
      console.error('Error sending shop locations email:', error);
      throw error;
    }
  },

  // Send inquiry email about products
  sendProductInquiry: async (inquiryData) => {
    try {
      const response = await api.post('/email/send-inquiry', inquiryData);
      return response.data;
    } catch (error) {
      console.error('Error sending product inquiry:', error);
      throw error;
    }
  },

  // Validate email format
  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Format products for email
  formatProductsForEmail: (products) => {
    return products.map(product => ({
      name: product.name || product.model,
      company: product.company,
      model: product.model,
      type: product.type,
      price: product.price,
      description: product.description,
      image: product.images?.[0] || null,
      id: product._id
    }));
  },

  // Format shops for email
  formatShopsForEmail: (shops, userLocation = null) => {
    return shops.map(shop => ({
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      products: shop.products || [],
      productCount: shop.productCount || 0,
      coordinates: {
        lat: shop.lat,
        lng: shop.lng
      },
      distance: userLocation ? shop.distance : null,
      googleMapsUrl: `https://www.google.com/maps?q=${shop.lat},${shop.lng}`,
      directionsUrl: userLocation ? 
        `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${shop.lat},${shop.lng}` : 
        null
    }));
  }
};

export default emailService;