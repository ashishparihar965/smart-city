import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout">
      {/* Mobile Top Header */}
      <div className="mobile-top-header">
        <div className="mobile-logo-group">
          <img src="/logo.jpg" alt="SmartCity" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          <span>SmartCity</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay for mobile side drawer */}
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
