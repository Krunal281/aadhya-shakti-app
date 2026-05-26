import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Calendar, FileText, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export default function SalesView({ sales, products, fetchSales, fetchProducts, addToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [productName, setProductName] = useState('');
  const [sqftSold, setSqftSold] = useState('');
  const [sellingPricePerSqft, setSellingPricePerSqft] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [cashAmount, setCashAmount] = useState('0');
  const [upiAmount, setUpiAmount] = useState('0');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);

  // When product is selected, prefill details
  useEffect(() => {
    if (productName) {
      const prod = products.find(p => p.name === productName);
      if (prod) {
        setSelectedProductDetails(prod);
        if (!isEditMode) {
          setSellingPricePerSqft(prod.sellingPricePerSqft.toString());
        }
      }
    } else {
      setSelectedProductDetails(null);
    }
  }, [productName, products]);

  // Calculate bill total on the fly
  const sqftVal = Number(sqftSold) || 0;
  const priceVal = Number(sellingPricePerSqft) || 0;
  const totalBillingAmount = sqftVal * priceVal;

  // Calculate pending amount
  const cashVal = Number(cashAmount) || 0;
  const upiVal = Number(upiAmount) || 0;
  const pendingAmount = Math.max(0, totalBillingAmount - (cashVal + upiVal));

  const openAddModal = () => {
    setIsEditMode(false);
    setClientName('');
    setDate(new Date().toISOString().split('T')[0]);
    setProductName(products[0]?.name || '');
    setSqftSold('');
    setSellingPricePerSqft('');
    setPaymentType('Cash');
    setCashAmount('0');
    setUpiAmount('0');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (sale) => {
    setIsEditMode(true);
    setEditingId(sale._id);
    setClientName(sale.clientName);
    setDate(new Date(sale.date).toISOString().split('T')[0]);
    setProductName(sale.productName);
    setSqftSold(sale.sqftSold.toString());
    setSellingPricePerSqft(sale.sellingPricePerSqft.toString());
    setPaymentType(sale.paymentType);
    setCashAmount(sale.cashAmount.toString());
    setUpiAmount(sale.upiAmount.toString());
    setNotes(sale.notes || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!productName) {
      addToast('Please select a stone/product.', 'error');
      return;
    }

    if (sqftVal <= 0 || priceVal <= 0) {
      addToast('Sqft and Selling Price must be greater than zero.', 'error');
      return;
    }

    // Check stock ceiling
    if (selectedProductDetails) {
      let maxAllowedStock = selectedProductDetails.availableStockSqft;
      if (isEditMode) {
        // Add back old sale qty for ceiling checks during edit
        const originalSale = sales.find(s => s._id === editingId);
        if (originalSale && originalSale.productName === productName) {
          maxAllowedStock += originalSale.sqftSold;
        }
      }

      if (sqftVal > maxAllowedStock) {
        addToast(`Insufficient stock! Only ${maxAllowedStock} sqft available for "${productName}".`, 'error');
        return;
      }
    }

    const payload = {
      clientName,
      date,
      productName,
      sqftSold: sqftVal,
      sellingPricePerSqft: priceVal,
      paymentType,
      cashAmount: paymentType !== 'UPI' ? cashVal : 0,
      upiAmount: paymentType !== 'Cash' ? upiVal : 0,
      notes
    };

    setLoading(true);
    try {
      if (isEditMode) {
        await api.updateSale(editingId, payload);
        addToast('Sale record updated successfully.', 'success');
      } else {
        await api.createSale(payload);
        addToast('Invoice billed successfully.', 'success');
      }
      setIsModalOpen(false);
      fetchSales();
      fetchProducts();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sale) => {
    if (window.confirm(`Are you sure you want to delete client sale for "${sale.clientName}"? This restores ${sale.sqftSold} sqft of "${sale.productName}" back to stock.`)) {
      try {
        await api.removeSale(sale._id);
        addToast('Invoice deleted, inventory restored successfully.', 'success');
        fetchSales();
        fetchProducts();
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  const filteredSales = sales.filter(s => {
    return s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           s.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const activeSales = filteredSales.filter(s => !s.isCleared);

  const handleClearBill = async (sale) => {
    if (window.confirm(`First Verification: Are you sure you want to clear/settle the bill for "${sale.clientName}"?`)) {
      if (window.confirm(`Second Verification (Safety Check): This will archive the bill and remove it from this active ledger. Stock and profit calculations will NOT be lost. Proceed?`)) {
        try {
          await api.clearSale(sale._id);
          addToast(`Invoice for "${sale.clientName}" archived successfully.`, 'success');
          fetchSales();
        } catch (err) {
          addToast(err.message, 'error');
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Sales / Client Invoicing</h1>
          <p>Generate customer invoices, check inventory limits, log cash/UPI incoming, and audit profits.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} /> New Client Sale
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by client name, product, notes..." 
            className="form-control search-input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Sales List Table */}
      {filteredSales.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No sales logs found. Click "New Client Sale" to record an invoice.
        </div>
      ) : (
        <div className="glass-card">
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Stone / Granite</th>
                  <th>Qty Sold</th>
                  <th>Sell Rate</th>
                  <th>Revenue</th>
                  <th>Cost of Goods</th>
                  <th>Profit / Loss</th>
                  <th>Received / Pending</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeSales.map(sale => {
                  const pL = sale.profitLoss || 0;
                  const isProfit = pL >= 0;
                  const isChemical = products.find(p => p.name === sale.productName)?.type === 'Chemical Bag';
                  const unitLabel = isChemical ? 'bags' : 'sqft';
                  return (
                    <tr key={sale._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                          {new Date(sale.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td><strong>{sale.clientName}</strong></td>
                      <td>{sale.productName}</td>
                      <td>{sale.sqftSold.toLocaleString()} {unitLabel}</td>
                      <td>₹{sale.sellingPricePerSqft} / {isChemical ? 'bag' : 'sqft'}</td>
                      <td><strong>₹{sale.sellingAmount.toLocaleString()}</strong></td>
                      <td>₹{(sale.costAmount || 0).toLocaleString()}</td>
                      <td>
                        <span style={{ color: isProfit ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: '700' }}>
                          {isProfit ? '+' : '-' } ₹{Math.abs(pL).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem' }}>
                            Recd ({sale.paymentType}): ₹{((sale.cashAmount || 0) + (sale.upiAmount || 0)).toLocaleString()}
                          </span>
                          {sale.pendingAmount > 0 && (
                            <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem', fontWeight: '500' }}>
                              Pend: ₹{sale.pendingAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            className="btn-icon edit" 
                            style={{ color: 'var(--color-success)' }} 
                            title="Clear & Archive Bill" 
                            onClick={() => handleClearBill(sale)}
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button className="btn-icon edit" title="Edit Sale" onClick={() => openEditModal(sale)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon delete" title="Delete Sale" onClick={() => handleDelete(sale)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Sale Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div className="modal-header">
              <h2>{isEditMode ? 'Edit Client Invoice' : 'New Client Sale (Client Billing)'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="form-group row-split">
                <div style={{ flex: 2 }}>
                  <label className="form-label">Client Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Aarav Builders" 
                    className="form-control" 
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Date *</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Select Stone / Product *</label>
                {products.length > 0 ? (
                  <select 
                    className="form-control"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  >
                    <option value="">Choose a product...</option>
                    {products.map(p => {
                      const unit = p.type === 'Chemical Bag' ? 'bags' : 'sqft';
                      return (
                        <option key={p._id} value={p.name}>
                          {p.name} (Stock: {p.availableStockSqft.toLocaleString()} {unit})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                    No products registered in inventory! Add products first.
                  </div>
                )}
              </div>

              {selectedProductDetails && (
                <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Available Stock: </span>
                    <strong style={{ color: selectedProductDetails.availableStockSqft < 500 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {selectedProductDetails.availableStockSqft.toLocaleString()} {selectedProductDetails.type === 'Chemical Bag' ? 'bags' : 'sqft'}
                    </strong>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Weighted Cost Price: </span>
                    <strong>₹{selectedProductDetails.averagePurchasePricePerSqft.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div className="form-group row-split">
                <div>
                  <label className="form-label">Quantity Sold (sqft/bags) *</label>
                  <input 
                    type="number" 
                    step="any"
                    placeholder="e.g. 500" 
                    className="form-control" 
                    required
                    value={sqftSold}
                    onChange={(e) => setSqftSold(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Selling Rate (₹/unit) *</label>
                  <input 
                    type="number" 
                    step="any"
                    placeholder="e.g. 75" 
                    className="form-control" 
                    required
                    value={sellingPricePerSqft}
                    onChange={(e) => setSellingPricePerSqft(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '1.15rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                Total Billing: ₹{totalBillingAmount.toLocaleString()}
              </div>

              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.2rem' }}>
                Payment Status
              </h3>

              <div className="form-group row-split">
                <div>
                  <label className="form-label">Payment Mode *</label>
                  <select 
                    className="form-control"
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                  >
                    <option value="Cash">Cash Only</option>
                    <option value="UPI">UPI Only</option>
                    <option value="Both">Both (Cash & UPI)</option>
                  </select>
                </div>

                {paymentType !== 'UPI' && (
                  <div>
                    <label className="form-label">Cash Received (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                    />
                  </div>
                )}

                {paymentType !== 'Cash' && (
                  <div>
                    <label className="form-label">UPI Received (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={upiAmount}
                      onChange={(e) => setUpiAmount(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: pendingAmount > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: '600' }}>
                <span>{pendingAmount > 0 ? 'Pending Client Payment:' : 'Paid Fully'}</span>
                <span>₹{pendingAmount.toLocaleString()}</span>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Notes</label>
                <input 
                  type="text" 
                  placeholder="Billing terms, delivery references..."
                  className="form-control"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
