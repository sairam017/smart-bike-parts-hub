import React, { createContext, useReducer, useEffect } from 'react';
import jwtDecode from 'jwt-decode';

const CartContext = createContext();

const cartReducer = (state, action) => {
  switch(action.type){
    case 'ADD_TO_CART': {
      const item = action.payload;
      const existing = state.items.find(i => i.id === item.id);
      let items;
      if (existing) {
        items = state.items.map(i => i.id === item.id ? { ...i, qty: (i.qty || 1) + (item.qty || 1) } : i);
      } else {
        items = [...state.items, { ...item, qty: item.qty || 1 }];
      }
      return { ...state, items };
    }
    case 'UPDATE_QTY': {
      const { id, qty } = action.payload;
      const items = state.items.map(i => i.id === id ? { ...i, qty } : i).filter(i => i.qty > 0);
      return { ...state, items };
    }
    case 'REMOVE_FROM_CART': {
      return { ...state, items: state.items.filter(i => i.id !== action.payload.id) };
    }
    case 'CLEAR_CART':
      return { ...state, items: [] };
    default:
      return state;
  }
};

const initial = { items: [] };

// Helper to get current user id from stored token (avoid circular auth import)
const currentUserId = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try { const d = jwtDecode(token); return d.id; } catch { return null; }
};

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initial, () => {
    const uid = currentUserId();
    if (!uid) {
      // keep anonymous cart under generic key
      const anon = localStorage.getItem('cart');
      return anon ? JSON.parse(anon) : initial;
    }
    const storedMapRaw = localStorage.getItem('userCarts');
    if (storedMapRaw) {
      try {
        const obj = JSON.parse(storedMapRaw);
        if (obj && obj[uid]) return obj[uid];
      } catch { /* ignore */ }
    }
    return initial;
  });

  useEffect(() => {
    const uid = currentUserId();
    if (!uid) {
      localStorage.setItem('cart', JSON.stringify(state));
      return;
    }
    const raw = localStorage.getItem('userCarts');
    let map = {};
    if (raw) { try { map = JSON.parse(raw) || {}; } catch { map = {}; } }
    map[uid] = state;
    localStorage.setItem('userCarts', JSON.stringify(map));
  }, [state]);

  const totalItems = state.items.reduce((s,i)=> s + (i.qty || 1), 0);
  const totalPrice = state.items.reduce((s,i)=> s + (i.price * (i.qty || 1)), 0);

  return (
    <CartContext.Provider value={{ cart: state, dispatch, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
