import React, { useState } from 'react';
import { Plus, Search, Trash2, Edit2, Calendar, ShoppingBag, Truck } from 'lucide-react';
import { api } from '../services/api';

export default function PurchasesView({ purchases, products, suppliers, fetchPurchases, fetchProducts, fetchSuppliers, addToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [gadiNumber, setGadiNumber] = useState('');
  const [items, setItems] = useState([{ productName: '', sqft: '', pricePerSqft: '' }]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashPaidAmount, setCashPaidAmount] = useState('0');
  const [upiPaidAmount, setUpiPaidAmount] = useState('0');
  const [cashPendingAmount, setCashPendingAmount] = useState('0');
  const [upiPendingAmount, setUpiPendingAmount] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);

  // Calculate bill total on the fly
  const calculateTotalBill = () => {
    return items.reduce((sum, item) => {
      const q = Number(item.sqft) || 0;
      const p = Number(item.pricePerSqft) || 0;
      return sum + (q * p);
    }, 0);
  };

  const totalBillAmount = calculateTotalBill();

  const handleAddItemRow = () => {
    setItems([...items, { productName: '', sqft: '', pricePerSqft: '' }]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length === 1) return;
    const newItems = items.filter((_, idx) => idx !== index);
    setItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setSupplierName(suppliers[0]?.name || '');
    setDate(new Date().toISOString().split('T')[0]);
    setGadiNumber('');
    setItems([{ productName: products[0]?.name || '', sqft: '', pricePerSqft: '' }]);
    setPaymentMode('Cash');
    setCashPaidAmount('0');
    setUpiPaidAmount('0');
    setCashPendingAmount('0');
    setUpiPendingAmount('0');
    setDueDate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (purchase) => {
    setIsEditMode(true);
    setEditingId(purchase._id);
    setSupplierName(purchase.supplierName);
    setDate(new Date(purchase.date).toISOString().split('T')[0]);
    setGadiNumber(purchase.gadiNumber || '');
    setItems(purchase.items.map(item => ({
      productName: item.productName,
      sqft: item.sqft.toString(),
      pricePerSqft: item.pricePerSqft.toString()
    })));
    setPaymentMode(purchase.paymentMode);
    setCashPaidAmount(purchase.cashPaidAmount.toString());
    setUpiPaidAmount(purchase.upiPaidAmount.toString());
    setCashPendingAmount(purchase.cashPendingAmount.toString());
    setUpiPendingAmount(purchase.upiPendingAmount.toString());
    setDueDate(purchase.dueDate ? new Date(purchase.dueDate).toISOString().split('T')[0] : '');
    setNotes(purchase.notes || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(false);

    // Validate quantities
    for (const item of items) {
      if (!item.productName) {
        addToast('Please select/specify a product name for all items.', 'error');
        return;
      }
      if (Number(item.sqft) <= 0 || Number(item.pricePerSqft) <= 0) {
        addToast('Sqft and Price per sqft must be greater than zero.', 'error');
        return;
      }
    }

    let cPaid = Number(cashPaidAmount) || 0;
    let uPaid = Number(upiPaidAmount) || 0;
    let cPend = Number(cashPendingAmount) || 0;
    let uPend = Number(upiPendingAmount) || 0;

    if (paymentMode === 'Cash') {
      cPend = totalBillAmount - cPaid;
      uPaid = 0;
      uPend = 0;
    } else if (paymentMode === 'UPI') {
      uPend = totalBillAmount - uPaid;
      cPaid = 0;
      cPend = 0;
    } else if (paymentMode === 'Both') {
      const sum = cPaid + uPaid + cPend + uPend;
      if (Math.abs(sum - totalBillAmount) > 1.0) {
        addToast(`Sum of paid & pending values (₹${sum}) must match the total bill (₹${totalBillAmount}).`, 'error');
        return;
      }
    }

    const payload = {
      supplierName,
      date,
      gadiNumber,
      items: items.map(item => ({
        productName: item.productName,
        sqft: Number(item.sqft),
        pricePerSqft: Number(item.pricePerSqft)
      })),
      paymentMode,
      cashPaidAmount: cPaid,
      upiPaidAmount: uPaid,
      cashPendingAmount: cPend,
      upiPendingAmount: uPend,
      dueDate: dueDate || null,
      notes
    };

    setLoading(true);
    try {
      if (isEditMode) {
        await api.updatePurchase(editingId, payload);
        addToast('Purchase entry updated successfully.', 'success');
      } else {
        await api.createPurchase(payload);
        addToast('Gadi purchase entry saved successfully.', 'success');
      }
      setIsModalOpen(false);
      fetchPurchases();
      fetchProducts();
      fetchSuppliers();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (purchase) => {
    if (window.confirm(`Are you sure you want to delete purchase entry from ${purchase.supplierName} (${purchase.gadiNumber || 'No Gadi'})?`)) {
      try {
        await api.deletePurchase(purchase._id);
        addToast('Purchase entry deleted, stocks reverted successfully.', 'success');
        fetchPurchases();
        fetchProducts();
        fetchSuppliers();
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'Clear') return <span className="badge clear">Clear</span>;
    if (status === 'Partial') return <span className="badge partial">Partial</span>;
    return <span className="badge pending">Pending</span>;
  };

  const filteredPurchases = purchases.filter(p => {
    return p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (p.gadiNumber && p.gadiNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
           p.items.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Supplier Purchases (Gadi Entries)</h1>
          <p>Record inbound truckloads of marble & granite, track invoices, and configure split balances.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} /> Add Gadi Entry
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by supplier, gadi number, stone name..." 
            className="form-control search-input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Purchase Table */}
      {filteredPurchases.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No purchase entries found. Click "Add Gadi Entry" to register stock arrival.
        </div>
      ) : (
        <div className="glass-card">
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Gadi/Truck Ref</th>
                  <th>Supplier</th>
                  <th>Products Purchased</th>
                  <th>Bill Total</th>
                  <th>Cash Paid / Pending</th>
                  <th>UPI Paid / Pending</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(purchase => {
                  const totalPending = purchase.cashPendingAmount + purchase.upiPendingAmount;
                  return (
                    <tr key={purchase._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                          {new Date(purchase.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Truck size={14} style={{ color: 'var(--text-secondary)' }} />
                          {purchase.gadiNumber || <span style={{ color: 'var(--text-muted)' }}>None</span>}
                        </div>
                      </td>
                      <td><strong>{purchase.supplierName}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {purchase.items.map((item, idx) => (
                            <span key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {item.productName} ({item.sqft} {products.find(p => p.name === item.productName)?.type === 'Chemical Bag' ? 'bags' : 'sqft'} @ ₹{item.pricePerSqft})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><strong>₹{purchase.totalBillAmount.toLocaleString()}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>Paid: ₹{purchase.cashPaidAmount.toLocaleString()}</span>
                          {purchase.cashPendingAmount > 0 && (
                            <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem', fontWeight: '500' }}>
                              Pend: ₹{purchase.cashPendingAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>Paid: ₹{purchase.upiPaidAmount.toLocaleString()}</span>
                          {purchase.upiPendingAmount > 0 && (
                            <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem', fontWeight: '500' }}>
                              Pend: ₹{purchase.upiPendingAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{getStatusBadge(purchase.paymentStatus)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn-icon edit" title="Edit Entry" onClick={() => openEditModal(purchase)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon delete" title="Delete Entry" onClick={() => handleDelete(purchase)}>
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

      {/* Add / Edit Purchase Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content wide">
            <div className="modal-header">
              <h2>{isEditMode ? 'Edit Gadi Entry' : 'Add Supplier Purchase (Gadi Entry)'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="form-group row-split">
                <div>
                  <label className="form-label">Supplier *</label>
                  {suppliers.length > 0 ? (
                    <select 
                      className="form-control"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
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
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label className="form-label">Date Stock Arrived *</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Gadi / Truck Number (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. RJ-14-GA-1122" 
                    className="form-control"
                    value={gadiNumber}
                    onChange={(e) => setGadiNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Items Grid Editor */}
              <div className="purchase-items-editor">
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                  Purchased Items List
                </h3>
                
                {items.map((item, index) => (
                  <div key={index} className="purchase-item-row">
                    <div>
                      {index === 0 && <label className="form-label">Stone / Granite Name *</label>}
                      {products.length > 0 ? (
                        <select 
                          className="form-control"
                          value={item.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        >
                          <option value="">Select Stone...</option>
                          {products.map(p => (
                            <option key={p._id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          placeholder="Granite Name" 
                          className="form-control" 
                          required
                          value={item.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        />
                      )}
                    </div>
                    <div>
                      {index === 0 && <label className="form-label">Total Sqft/Bags *</label>}
                      <input 
                        type="number" 
                        step="any"
                        placeholder="e.g. 1200" 
                        className="form-control" 
                        required
                        value={item.sqft}
                        onChange={(e) => handleItemChange(index, 'sqft', e.target.value)}
                      />
                    </div>
                    <div>
                      {index === 0 && <label className="form-label">Cost (₹/Unit) *</label>}
                      <input 
                        type="number" 
                        step="any"
                        placeholder="e.g. 30" 
                        className="form-control" 
                        required
                        value={item.pricePerSqft}
                        onChange={(e) => handleItemChange(index, 'pricePerSqft', e.target.value)}
                      />
                    </div>
                    <div>
                      {index === 0 && <label className="form-label">Total Amount (₹)</label>}
                      <input 
                        type="text" 
                        readOnly 
                        className="form-control" 
                        style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
                        value={((Number(item.sqft) || 0) * (Number(item.pricePerSqft) || 0)).toLocaleString()}
                      />
                    </div>
                    <div>
                      {index === 0 && <label className="form-label" style={{ visibility: 'hidden' }}>Action</label>}
                      <button 
                        type="button" 
                        className="btn-icon delete" 
                        disabled={items.length === 1}
                        onClick={() => handleRemoveItemRow(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={handleAddItemRow}>
                  + Add Stone Item
                </button>
              </div>

              {/* Total Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                Total Bill Amount: ₹{totalBillAmount.toLocaleString()}
              </div>

              {/* Payment Details */}
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                Payment Summary
              </h3>

              <div className="form-group row-split">
                <div>
                  <label className="form-label">Payment Mode *</label>
                  <select 
                    className="form-control"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="Cash">Cash Only</option>
                    <option value="UPI">UPI Only</option>
                    <option value="Both">Both (Split Pay)</option>
                  </select>
                </div>
                {paymentMode !== 'UPI' && (
                  <div>
                    <label className="form-label">Cash Paid (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={cashPaidAmount}
                      onChange={(e) => setCashPaidAmount(e.target.value)}
                    />
                  </div>
                )}
                {paymentMode !== 'Cash' && (
                  <div>
                    <label className="form-label">UPI Paid (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={upiPaidAmount}
                      onChange={(e) => setUpiPaidAmount(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {paymentMode === 'Both' && (
                <div className="form-group row-split" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
                  <div>
                    <label className="form-label">Cash Pending Balance (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={cashPendingAmount}
                      onChange={(e) => setCashPendingAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">UPI Pending Balance (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={upiPendingAmount}
                      onChange={(e) => setUpiPendingAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="form-group row-split">
                <div>
                  <label className="form-label">Next Payment Due Date</label>
                  <input 
                    type="date" 
                    className="form-control"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label className="form-label">Notes</label>
                  <input 
                    type="text" 
                    placeholder="Reference, loading charges, etc."
                    className="form-control"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
