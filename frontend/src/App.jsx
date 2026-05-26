import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  ShoppingCart, 
  Truck, 
  Users, 
  FileBarChart2, 
  Menu, 
  X,
  Bell
} from 'lucide-react';
import { api } from './services/api';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import PurchasesView from './components/PurchasesView';
import SalesView from './components/SalesView';
import SuppliersView from './components/SuppliersView';
import SupplierDetailsView from './components/SupplierDetailsView';
import ReportsView from './components/ReportsView';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  
  // Data States
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  
  // App States
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState('Checking...');

  // Add Toast Notification
  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // API Data Fetching
  const fetchDashboardStats = async () => {
    try {
      const res = await api.getDashboard();
      setDashboardStats(res.data);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.getProducts();
      setProducts(res.data);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.getSuppliers();
      setSuppliers(res.data);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await api.getPurchases();
      setPurchases(res.data);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const fetchSales = async () => {
    try {
      const res = await api.getSales();
      setSales(res.data);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        api.getDashboard().then(res => setDashboardStats(res.data)),
        api.getProducts().then(res => setProducts(res.data)),
        api.getSuppliers().then(res => setSuppliers(res.data)),
        api.getPurchases().then(res => setPurchases(res.data)),
        api.getSales().then(res => setSales(res.data))
      ]);
      setDbStatus('Connected');
    } catch (err) {
      console.error(err);
      setDbStatus('Offline / Connection Error');
      addToast('Cannot connect to the central database server. Check your backend URL or server status.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Sync dashboard and other state on tab change
  useEffect(() => {
    fetchDashboardStats();
    if (currentView === 'inventory') fetchProducts();
    if (currentView === 'suppliers') fetchSuppliers();
    if (currentView === 'purchases') fetchPurchases();
    if (currentView === 'sales') fetchSales();
  }, [currentView]);

  const handleSelectSupplier = (name) => {
    setSelectedSupplierName(name);
    setCurrentView('supplier-details');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView 
            stats={dashboardStats} 
            loading={loading || !dashboardStats} 
            onViewChange={setCurrentView}
            onSelectSupplier={handleSelectSupplier}
          />
        );
      case 'inventory':
        return (
          <InventoryView 
            products={products}
            suppliers={suppliers}
            fetchProducts={fetchProducts}
            fetchSuppliers={fetchSuppliers}
            addToast={addToast}
          />
        );
      case 'sales':
        return (
          <SalesView 
            sales={sales}
            products={products}
            fetchSales={fetchSales}
            fetchProducts={fetchProducts}
            addToast={addToast}
          />
        );
      case 'purchases':
        return (
          <PurchasesView 
            purchases={purchases}
            products={products}
            suppliers={suppliers}
            fetchPurchases={fetchPurchases}
            fetchProducts={fetchProducts}
            fetchSuppliers={fetchSuppliers}
            addToast={addToast}
          />
        );
      case 'suppliers':
        return (
          <SuppliersView 
            suppliers={suppliers}
            fetchSuppliers={fetchSuppliers}
            onViewChange={setCurrentView}
            setSelectedSupplierName={setSelectedSupplierName}
            addToast={addToast}
          />
        );
      case 'supplier-details':
        return (
          <SupplierDetailsView 
            supplierName={selectedSupplierName}
            onViewChange={setCurrentView}
            addToast={addToast}
            fetchSuppliers={fetchSuppliers}
          />
        );
      case 'reports':
        return (
          <ReportsView 
            sales={sales}
            products={products}
            purchases={purchases}
            addToast={addToast}
          />
        );
      default:
        return <div>View not found</div>;
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory (Stone)', icon: Database },
    { id: 'sales', label: 'Sales / Client Billing', icon: ShoppingCart },
    { id: 'purchases', label: 'Purchases (Gadi)', icon: Truck },
    { id: 'suppliers', label: 'Supplier Accounts', icon: Users },
    { id: 'reports', label: 'Profit & Loss / Reports', icon: FileBarChart2 }
  ];

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <nav className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h2>AADHYA SHAKTI</h2>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id || (item.id === 'suppliers' && currentView === 'supplier-details');
            return (
              <li key={item.id}>
                <a 
                  className={`menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentView(item.id);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon className="menu-item-icon" />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
        <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-card)', marginTop: 'auto' }}>
          Marble & Granite Business v1.0
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="main-content">
        
        {/* Top Navbar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-card)', paddingBottom: '1rem', marginBottom: '0.5rem' }} className="no-print">
          {/* Mobile hamburger */}
          <button 
            className="btn btn-secondary" 
            style={{ display: 'none', padding: '0.5rem' }} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span 
              className="badge clear" 
              style={{ 
                textTransform: 'none', 
                fontSize: '0.8rem', 
                fontWeight: '600',
                backgroundColor: dbStatus === 'Connected' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: dbStatus === 'Connected' ? 'var(--color-success)' : 'var(--color-danger)',
                border: dbStatus === 'Connected' ? '1px solid rgba(74, 222, 128, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
              }}
            >
              Database: {dbStatus}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button className="btn-icon" style={{ position: 'relative' }}>
              <Bell size={20} />
              {products.some(p => p.availableStockSqft < 500) && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', background: 'var(--color-danger)', borderRadius: '50%' }} />
              )}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Aadhya Shakti Admin</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Super User</span>
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        {renderCurrentView()}
      </main>

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Custom responsive mobile display logic */}
      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-toggle {
            display: inline-flex !important;
          }
        }
      `}</style>

    </div>
  );
}
