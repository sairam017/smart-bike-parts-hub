import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { CartProvider } from './context/CartContext';
import BikePartList from './components/bikeParts/BikePartList';
import ProductDetailPage from './components/bikeParts/ProductDetailPage';
import MapPage from './components/maps/MapPage';
import RecommendationsPage from './components/recommendations/RecommendationsPage';
import LandingPage from './components/landing/LandingPage';
import AdminUsersPage from './components/admin/AdminUsersPage';
import AdminProductsPage from './components/admin/AdminProductsPage';
import LoginPage from './components/auth/LoginPage';
import useAuth from './hooks/useAuth';
import useCart from './hooks/useCart';
import ShopsList from './components/shops/ShopsList';
import CreateVendorPage from './components/admin/CreateVendorPage';
import VendorDashboard from './components/vendor/VendorDashboard';
import CartPage from './components/cart/CartPage';
import MyOrdersPage from './components/checkout/MyOrdersPage';

// Context-aware auth guard
const RequireAuth = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{padding:'1rem'}}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = React.useState('users');
  const buttonStyle = (section) => ({
    border: '2px solid #1d4ed8',
    borderRadius: 10,
    padding: '0.9rem 1rem',
    color: activeSection === section ? '#fff' : '#1d4ed8',
    background: activeSection === section ? '#0a2aa7' : '#fff',
    fontWeight: 700,
    minWidth: 160,
    textAlign: 'center',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: activeSection === section ? '0 2px 8px rgba(10,42,167,0.08)' : 'none',
    transition: 'all 0.2s',
  });
  return (
    <div style={{ minHeight:'100vh', background:'#fff' }}>
      <div style={{background:'#0a2aa7', color:'#fff', padding:'1rem 1.25rem', fontWeight:800, fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div>Smart Bike Parts Hub</div>
        <button onClick={() => { logout(); navigate('/'); }} style={{background:'#fff', color:'#0a2aa7', border:'none', borderRadius:8, padding:'0.5rem 0.9rem', fontWeight:700, cursor:'pointer'}}>Logout</button>
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>
        <h2 style={{margin:'0.5rem 0 1rem', color:'#1d4ed8'}}>Welcome, Admin</h2>
        <div style={{display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'2rem'}}>
          <button style={buttonStyle('users')} onClick={() => setActiveSection('users')}>Users</button>
          <button style={buttonStyle('products')} onClick={() => setActiveSection('products')}>Products</button>
          <button style={buttonStyle('addVendor')} onClick={() => setActiveSection('addVendor')}>Add Vendor</button>
        </div>
        <div style={{marginTop:'1rem'}}>
          {activeSection === 'users' && <AdminUsersPage />}
          {activeSection === 'products' && <AdminProductsPage />}
          {activeSection === 'addVendor' && <CreateVendorPage />}
        </div>
      </div>
    </div>
  );
};

const NavBar = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  // Hide navbar on vendor dashboard for a cleaner vendor workspace
  if (
    location.pathname.startsWith('/vendor/dashboard') ||
    location.pathname.startsWith('/admin/dashboard') ||
    location.pathname === '/' ||
    location.pathname === '/login'
  ) return null;
  return (
    <nav style={{ display:'flex', gap:'1rem', padding:'0.75rem 1rem', background:'#222', color:'#fff', alignItems:'center' }}>
  <Link style={{color:'#fff'}} to="/">Home</Link>
  {location.pathname !== '/parts' && <Link style={{color:'#fff'}} to="/parts">Parts</Link>}
  {user && (
    <Link style={{color:'#fff', position:'relative'}} to="/cart">
      🛒 Cart
      {totalItems > 0 && (
        <span style={{
          position:'absolute',
          top:'-8px',
          right:'-12px',
          background:'#ef4444',
          color:'white',
          borderRadius:'50%',
          fontSize:'0.7rem',
          minWidth:'18px',
          height:'18px',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          fontWeight:'bold'
        }}>
          {totalItems}
        </span>
      )}
    </Link>
  )}
  {/* {user && <Link style={{color:'#fff'}} to="/shops">Shops</Link>} */}
  {user && <Link style={{color:'#fff'}} to="/myorders">My Orders</Link>}
      {user?.role === 'admin' && <Link style={{color:'#fff'}} to="/admin/dashboard">Admin</Link>}
      {user?.role === 'vendor' && <Link style={{color:'#fff'}} to="/vendor/dashboard">Vendor</Link>}
      {!user && <Link style={{marginLeft:'auto', color:'#fff'}} to="/login">Login</Link>}
      {user && location.pathname !== '/parts' && <button onClick={()=> { logout(); navigate('/'); }} style={{ marginLeft:'auto' }}>Logout</button>}
    </nav>
  );
};

function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <CartProvider>
        <Router>
          <NavBar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/parts" element={<BikePartList />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/recommendations" element={<RequireAuth><RecommendationsPage /></RequireAuth>} />
            <Route path="/maps" element={<RequireAuth><MapPage /></RequireAuth>} />
            {/* <Route path="/shops" element={<RequireAuth><ShopsList /></RequireAuth>} /> */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/dashboard" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
            <Route path="/admin/vendors/create" element={<RequireAuth roles={['admin']}><CreateVendorPage /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth roles={['admin']}><AdminUsersPage /></RequireAuth>} />
            <Route path="/admin/products" element={<RequireAuth roles={['admin']}><AdminProductsPage /></RequireAuth>} />
            <Route path="/vendor/dashboard" element={<RequireAuth roles={['vendor','admin']}><VendorDashboard /></RequireAuth>} />
            <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
            <Route path="/myorders" element={<RequireAuth><MyOrdersPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        </CartProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

// Decides what to show at root
// No longer used; landing page is public

export default App;
