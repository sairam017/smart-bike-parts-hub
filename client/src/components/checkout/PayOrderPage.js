import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import api from '../../services/api';

const PayOrderPage = () => {
  const navigate = useNavigate();
  const { cart, dispatch } = useCart();
  const shipping = JSON.parse(sessionStorage.getItem('shipping') || '{}');
  const paymentMethod = sessionStorage.getItem('paymentMethod');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const createAndPay = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const orderItems = cart.items.map(i => ({ name: i.name, qty: i.qty || 1, price: i.price, product: i.id }));
      const { data: order } = await api.post('/orders', { orderItems, shippingAddress: shipping, paymentMethod });
      const { data: paid } = await api.put(`/orders/${order._id}/pay`);
      setMessage('Payment Success');
      dispatch({ type: 'CLEAR_CART' });
      sessionStorage.removeItem('shipping');
      sessionStorage.removeItem('paymentMethod');
      setTimeout(()=> navigate('/myorders'), 1000);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Payment</h2>
      <p>Scan QR (placeholder)</p>
      <button disabled={loading || !cart.items.length} onClick={createAndPay}>{loading ? 'Processing...' : 'Payment Done'}</button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default PayOrderPage;
