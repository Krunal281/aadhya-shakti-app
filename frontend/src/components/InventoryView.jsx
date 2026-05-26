import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Camera, AlertTriangle, Layers } from 'lucide-react';
import { api } from '../services/api';

export default function InventoryView({ products, suppliers, fetchProducts, fetchSuppliers, addToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'Granite',
    supplierName: '',
    initialSqft: '',
    initialPricePerSqft: '',
    sellingPricePerSqft: '',
    photo: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (suppliers.length > 0 && !formData.supplierName) {
      setFormData(prev => ({ ...prev, supplierName: suppliers[0].name }));
    }
  }, [suppliers]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      type: 'Granite',
      supplierName: suppliers[0]?.name || '',
      initialSqft: '',
      initialPricePerSqft: '',
      sellingPricePerSqft: '',
      photo: ''
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      type: product.type,
      supplierName: product.supplierName,
      initialSqft: product.initialSqft || 0,
      initialPricePerSqft: product.initialPricePerSqft || 0,
      sellingPricePerSqft: product.sellingPricePerSqft || 0,
      photo: product.photo || ''
    });
    setIsEditModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const data = {
      ...formData,
      initialSqft: Number(formData.initialSqft) || 0,
      initialPricePerSqft: Number(formData.initialPricePerSqft) || 0,
      sellingPricePerSqft: Number(formData.sellingPricePerSqft) || 0
    };

    if (data.initialSqft < 0 || data.initialPricePerSqft < 0 || data.sellingPricePerSqft < 0) {
      addToast('Stock quantity and prices cannot be negative.', 'error');
      setLoading(false);
      return;
    }

    try {
      if (isEditModalOpen && selectedProduct) {
        await api.updateProduct(selectedProduct._id, data);
        addToast(`Product "${data.name}" updated successfully.`, 'success');
      } else {
        await api.createProduct(data);
        addToast(`Product "${data.name}" registered successfully.`, 'success');
      }
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      fetchProducts();
      fetchSuppliers(); // Re-fetch suppliers since new products can change supplier summary
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
      try {
        await api.deleteProduct(product._id);
        addToast(`Product "${product.name}" deleted successfully.`, 'success');
        fetchProducts();
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'All' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getStockStatusClass = (available) => {
    if (available < 500) return 'low';
    if (available < 1500) return 'medium';
    return 'high';
  };

  const getStockStatusLabel = (available) => {
    if (available < 500) return 'Low Stock';
    if (available < 1500) return 'Medium Stock';
    return 'In Stock';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header controls */}
      <div className="page-header">
        <div className="page-title">
          <h1>Stone Inventory</h1>
          <p>Manage granite and marble stock items, weighted average pricing, and catalog details.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} /> Add New Stone
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card filter-bar">
        <div style={{ display: 'flex', flex: 1, gap: '0.75rem', minWidth: '250px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by product or supplier..." 
              className="form-control search-input"
              style={{ paddingLeft: '2.5rem', width: '100%' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select 
            className="form-control"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">All Types</option>
            <option value="Marble">Marbles</option>
            <option value="Granite">Granites</option>
            <option value="Chemical Bag">Chemical Bags</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No products found matching filters. Click "Add New Stone" to register a product.
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map(product => {
            const stockPct = Math.min((product.availableStockSqft / 3000) * 100, 100);
            const isLow = product.availableStockSqft < 500;
            return (
              <div key={product._id} className="glass-card product-card">
                {/* Product Photo */}
                {product.photo ? (
                  <img src={product.photo} alt={product.name} className="product-card-image" />
                ) : (
                  <div className="product-card-image">
                    <Layers size={36} />
                  </div>
                )}

                {/* Card details */}
                <div className="product-card-details">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className={`badge ${product.type.toLowerCase()}`}>{product.type}</span>
                    {isLow && <span className="low-stock-pill">Low Stock Warning</span>}
                  </div>
                  
                  <h3 style={{ fontSize: '1.15rem', marginTop: '0.5rem', fontWeight: '700' }}>{product.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Supplier: {product.supplierName}</span>

                  <div className="list-summary-group" style={{ margin: '0.75rem 0' }}>
                    <div className="list-summary-item">
                      <span>Weighted Avg Cost:</span>
                      <span>₹{(product.averagePurchasePricePerSqft || 0).toFixed(2)} / {product.type === 'Chemical Bag' ? 'bag' : 'sqft'}</span>
                    </div>
                    <div className="list-summary-item">
                      <span>Default Selling:</span>
                      <span>₹{(product.sellingPricePerSqft || 0).toFixed(2)} / {product.type === 'Chemical Bag' ? 'bag' : 'sqft'}</span>
                    </div>
                    <div className="list-summary-item">
                      <span>Stock Available:</span>
                      <span style={{ color: isLow ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                        {(product.availableStockSqft || 0).toLocaleString()} {product.type === 'Chemical Bag' ? 'bags' : 'sqft'}
                      </span>
                    </div>
                    <div className="list-summary-item">
                      <span>Stock Sold:</span>
                      <span>{(product.soldStockSqft || 0).toLocaleString()} {product.type === 'Chemical Bag' ? 'bags' : 'sqft'}</span>
                    </div>
                  </div>

                  {/* Stock progress bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Status: {getStockStatusLabel(product.availableStockSqft)}</span>
                      <span>{Math.round(product.availableStockSqft).toLocaleString()} {product.type === 'Chemical Bag' ? 'bags' : 'sqft'}</span>
                    </div>
                    <div className="stock-progress-container">
                      <div 
                        className={`stock-progress-bar ${getStockStatusClass(product.availableStockSqft)}`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-card)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '0.35rem' }} onClick={() => openEditModal(product)}>
                    <Edit2 size={14} /> Edit
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, padding: '0.35rem' }} onClick={() => handleDeleteProduct(product)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div className="modal-header">
              <h2>{isEditModalOpen ? 'Edit Stone Details' : 'Add New Stone to Inventory'}</h2>
              <button className="modal-close" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>Close</button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Stone / Granite Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Desert Gold Granite" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group row-split">
                <div>
                  <label className="form-label">Type *</label>
                  <select 
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="Granite">Granite</option>
                    <option value="Marble">Marble</option>
                    <option value="Chemical Bag">Chemical Bag</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Default Supplier *</label>
                  {suppliers.length > 0 ? (
                    <select 
                      className="form-control"
                      value={formData.supplierName}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                    >
                      {suppliers.map(s => (
                        <option key={s._id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="Enter supplier name" 
                      className="form-control"
                      required
                      value={formData.supplierName}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              <div className="form-group row-split">
                <div>
                  <label className="form-label">Initial Stock (sqft/bags)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-control" 
                    placeholder="e.g. 1000" 
                    value={formData.initialSqft}
                    onChange={(e) => setFormData(prev => ({ ...prev, initialSqft: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Initial Cost Price (₹/unit)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-control" 
                    placeholder="e.g. 45" 
                    value={formData.initialPricePerSqft}
                    onChange={(e) => setFormData(prev => ({ ...prev, initialPricePerSqft: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price (₹/unit) *</label>
                <input 
                  type="number" 
                  step="any"
                  className="form-control" 
                  placeholder="e.g. 75" 
                  required
                  value={formData.sellingPricePerSqft}
                  onChange={(e) => setFormData(prev => ({ ...prev, sellingPricePerSqft: e.target.value }))}
                />
              </div>

              {/* Photo Upload */}
              <div className="form-group">
                <label className="form-label">Product Photo</label>
                <div className="image-upload-area" onClick={() => document.getElementById('photo-upload-input').click()}>
                  {formData.photo ? (
                    <>
                      <img src={formData.photo} alt="Preview" className="image-preview-thumbnail" />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click to replace photo</span>
                    </>
                  ) : (
                    <>
                      <Camera size={24} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click to upload product image</span>
                    </>
                  )}
                  <input 
                    id="photo-upload-input" 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={handlePhotoUpload} 
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
