import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PaymentPage = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState('qr');

  const submit = e => {
    e.preventDefault();
    sessionStorage.setItem('paymentMethod', method);
    navigate('/pay');
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Payment Method</h2>
      <form onSubmit={submit}>
        <label><input type="radio" name="method" value="qr" checked={method==='qr'} onChange={e=>setMethod(e.target.value)} /> QR / UPI</label>
        <label><input type="radio" name="method" value="cod" checked={method==='cod'} onChange={e=>setMethod(e.target.value)} /> COD</label>
        <button type="submit">Continue</button>
      </form>
    </div>
  );
};

export default PaymentPage;
