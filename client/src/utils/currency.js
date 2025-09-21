export const formatINR = (value) => {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    // Fallback
    return `₹${n.toFixed(2)}`;
  }
};
