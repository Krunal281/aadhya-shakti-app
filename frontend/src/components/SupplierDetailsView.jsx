import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, DollarSign, Calendar, Truck, AlertTriangle, RotateCcw, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export default function SupplierDetailsView({ supplierName, onViewChange, addToast, fetchSuppliers }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashAmountPaid, setCashAmountPaid] = useState('0');
  const [upiAmountPaid, setUpiAmountPaid] = useState('0');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Edit Payment Modal State
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Edit Purchase Modal State - wait, we can edit purchases by triggering a callback or using a local modal
  // To keep it simple and clean, let's allow editing payments and deleting purchases/payments from details.
  // Editing purchases is already fully handled on the Purchases page.

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await api.getSupplierDetails(supplierName);
      setDetails(res.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierName) {
      fetchDetails();
    }
  }, [supplierName]);

  const handleClear = async (purchaseId, clearType) => {
    if (window.confirm(`Are you sure you want to mark ${clearType} clear for this bill?`)) {
      try {
        await api.clearPayment({ purchaseId, clearType, notes: `Cleared pending ${clearType}` });
        addToast(`Pending ${clearType} cleared successfully.`, 'success');
        fetchDetails();
        fetchSuppliers();
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  const handleUndo = async (purchaseId) => {
    try {
      await api.undoClearPayment(purchaseId);
      addToast('Prior payment clear rolled back successfully.', 'success');
      fetchDetails();
      fetchSuppliers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openPayModal = (purchase) => {
    setSelectedPurchase(purchase);
    setPayDate(new Date().toISOString().split('T')[0]);
    setCashAmountPaid(purchase.cashPendingAmount.toString());
    setUpiAmountPaid(purchase.upiPendingAmount.toString());
    setPayNotes(`Payment for ${purchase.gadiNumber ? 'Gadi ' + purchase.gadiNumber : 'Invoice'}`);
    setIsPayModalOpen(true);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const cash = Number(cashAmountPaid) || 0;
    const upi = Number(upiAmountPaid) || 0;

    if (cash < 0 || upi < 0) {
      addToast('Payment amounts cannot be negative.', 'error');
      return;
    }

    if (cash > selectedPurchase.cashPendingAmount) {
      addToast(`Cash payment exceeds pending cash limit (₹${selectedPurchase.cashPendingAmount}).`, 'error');
      return;
    }

    if (upi > selectedPurchase.upiPendingAmount) {
      addToast(`UPI payment exceeds pending UPI limit (₹${selectedPurchase.upiPendingAmount}).`, 'error');
      return;
    }

    setPayLoading(true);
    try {
      await api.createPayment({
        date: payDate,
        supplierName,
        purchaseId: selectedPurchase._id,
        cashAmountPaid: cash,
        upiAmountPaid: upi,
        notes: payNotes
      });
      addToast('Payment recorded successfully.', 'success');
      setIsPayModalOpen(false);
      fetchDetails();
      fetchSuppliers();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPayLoading(false);
    }
  };

  const handleDeleteLedgerItem = async (entry) => {
    if (entry.entryType === 'Purchase') {
      if (window.confirm('Delete this purchase bill? This will reduce stock values.')) {
        try {
          await api.deletePurchase(entry.refId);
          addToast('Purchase bill deleted.', 'success');
          fetchDetails();
          fetchSuppliers();
        } catch (err) {
          addToast(err.message, 'error');
        }
      }
    } else {
      if (window.confirm('Delete this payment transaction? This will restore pending bill debts.')) {
        try {
          await api.deletePayment(entry.refId);
          addToast('Payment entry deleted, pending amounts restored.', 'success');
          fetchDetails();
          fetchSuppliers();
        } catch (err) {
          addToast(err.message, 'error');
        }
      }
    }
  };

  const openEditPayment = (entry) => {
    const payment = details.payments.find(p => p._id === entry.refId);
    if (!payment) return;

    // Find the purchase related to this payment to know available boundaries
    const purchase = details.purchases.find(p => p._id === payment.purchaseId);

    setSelectedPayment({
      ...payment,
      revertedCashPending: (purchase?.cashPendingAmount || 0) + payment.cashAmountPaid,
      revertedUpiPending: (purchase?.upiPendingAmount || 0) + payment.upiAmountPaid
    });

    setPayDate(new Date(payment.date).toISOString().split('T')[0]);
    setCashAmountPaid(payment.cashAmountPaid.toString());
    setUpiAmountPaid(payment.upiAmountPaid.toString());
    setPayNotes(payment.notes || '');
    setIsEditPaymentModalOpen(true);
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    const cash = Number(cashAmountPaid) || 0;
    const upi = Number(upiAmountPaid) || 0;

    if (cash < 0 || upi < 0) {
      addToast('Payment amounts cannot be negative.', 'error');
      return;
    }

    if (cash > selectedPayment.revertedCashPending) {
      addToast(`Cash payment exceeds maximum reverted pending amount (₹${selectedPayment.revertedCashPending}).`, 'error');
      return;
    }

    if (upi > selectedPayment.revertedUpiPending) {
      addToast(`UPI payment exceeds maximum reverted pending amount (₹${selectedPayment.revertedUpiPending}).`, 'error');
      return;
    }

    setPayLoading(true);
    try {
      await api.updatePayment(selectedPayment._id, {
        date: payDate,
        cashAmountPaid: cash,
        upiAmountPaid: upi,
        notes: payNotes
      });
      addToast('Payment entry updated successfully.', 'success');
      setIsEditPaymentModalOpen(false);
      fetchDetails();
      fetchSuppliers();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading ledger data...</div>;
  if (error) return <div style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '2rem' }}>Error loading supplier: {error}</div>;

  const { supplier, purchases, payments, ledger } = details;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header and Back Link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => onViewChange('suppliers')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Supplier Ledger: {supplier.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Phone: {supplier.phone || 'N/A'} | Address: {supplier.address || 'N/A'}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-info">
            <span className="stat-label">Total Purchased</span>
            <span className="stat-value">₹{supplier.totalPurchaseAmount.toLocaleString()}</span>
          </div>
          <div className="stat-icon-wrapper"><Truck size={20} /></div>
        </div>

        <div className="glass-card stat-card success">
          <div className="stat-info">
            <span className="stat-label">Total Settled</span>
            <span className="stat-value">₹{supplier.totalPaidAmount.toLocaleString()}</span>
          </div>
          <div className="stat-icon-wrapper"><CheckCircle size={20} /></div>
        </div>

        <div className="glass-card stat-card danger">
          <div className="stat-info">
            <span className="stat-label">Outstanding Cash</span>
            <span className="stat-value red-alert">₹{supplier.remainingCashAmount.toLocaleString()}</span>
          </div>
          <div className="stat-icon-wrapper"><DollarSign size={20} /></div>
        </div>

        <div className="glass-card stat-card danger">
          <div className="stat-info">
            <span className="stat-label">Outstanding UPI</span>
            <span className="stat-value red-alert">₹{supplier.remainingUpiAmount.toLocaleString()}</span>
          </div>
          <div className="stat-icon-wrapper"><CreditCard size={20} /></div>
        </div>
      </div>

      {/* Purchases and Quick Clear options */}
      <div>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.25rem' }}>
          Open Invoices & Clear Actions
        </h2>

        {purchases.filter(p => p.paymentStatus !== 'Clear').length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-success)', fontWeight: '600' }}>
            🎉 All purchases are fully cleared for this supplier!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {purchases.filter(p => p.paymentStatus !== 'Clear').map(p => {
              return (
                <div key={p._id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1rem 1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>
                      {p.gadiNumber ? `Gadi Entry: ${p.gadiNumber}` : `Purchase Bill #${p._id.substring(0, 8)}`}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Date: {new Date(p.date).toLocaleDateString()} | Bill Total: ₹{p.totalBillAmount.toLocaleString()}
                    </span>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                      <span style={{ color: p.cashPendingAmount > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                        Pending Cash: ₹{p.cashPendingAmount.toLocaleString()}
                      </span>
                      <span style={{ color: p.upiPendingAmount > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                        Pending UPI: ₹{p.upiPendingAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Quick clear / pay buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => openPayModal(p)}>
                      Custom Pay
                    </button>
                    {p.cashPendingAmount > 0 && (
                      <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleClear(p._id, 'Cash')}>
                        Clear Cash
                      </button>
                    )}
                    {p.upiPendingAmount > 0 && (
                      <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleClear(p._id, 'UPI')}>
                        Clear UPI
                      </button>
                    )}
                    <button className="btn btn-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleClear(p._id, 'Full')}>
                      Clear Full Bill
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Ledger / history */}
      <div>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Supplier Ledger & Activity History</h2>
        
        {ledger.length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No transaction ledger entries recorded.
          </div>
        ) : (
          <div className="glass-card">
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference / Description</th>
                    <th>Cash Paid</th>
                    <th>UPI Paid</th>
                    <th>Cash Pending</th>
                    <th>UPI Pending</th>
                    <th>Total Remaining</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry, idx) => {
                    const isPurchase = entry.entryType === 'Purchase';
                    const hasUndoLog = !isPurchase; // payments can be deleted, cleared payments can be undone
                    return (
                      <tr key={idx}>
                        <td>{new Date(entry.date).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${isPurchase ? 'marble' : 'clear'}`}>
                            {entry.entryType}
                          </span>
                        </td>
                        <td><strong>{entry.description}</strong></td>
                        <td>₹{(entry.cashPaid || 0).toLocaleString()}</td>
                        <td>₹{(entry.upiPaid || 0).toLocaleString()}</td>
                        <td>
                          <span style={{ color: entry.cashPending > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                            ₹{(entry.cashPending || 0).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: entry.upiPending > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                            ₹{(entry.upiPending || 0).toLocaleString()}
                          </span>
                        </td>
                        <td><strong>₹{entry.totalRemaining.toLocaleString()}</strong></td>
                        <td>
                          {isPurchase ? (
                            <span className={`badge ${entry.status.toLowerCase()}`}>{entry.status}</span>
                          ) : (
                            <span className="badge clear">Clear</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {/* Undo Clear button: only show for Payment entries that are clear closures */}
                            {entry.entryType === 'Payment' && entry.description.includes('Cleared') && (
                              <button 
                                className="btn-icon edit" 
                                style={{ color: 'var(--color-warning)' }} 
                                title="Undo Clear Action"
                                onClick={() => handleUndo(entry.refId)} // wait, our undoClearPayment uses purchaseId or refId!
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                            
                            {/* Edit Payment transaction */}
                            {entry.entryType === 'Payment' && (
                              <button className="btn-icon edit" title="Edit Transaction" onClick={() => openEditPayment(entry)}>
                                <Edit2 size={15} />
                              </button>
                            )}

                            {/* Delete Purchase or Payment */}
                            <button className="btn-icon delete" title="Delete Entry" onClick={() => handleDeleteLedgerItem(entry)}>
                              <Trash2 size={15} />
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
      </div>

      {/* Pay / Edit Payment Modal */}
      {(isPayModalOpen || isEditPaymentModalOpen) && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div className="modal-header">
              <h2>
                {isEditPaymentModalOpen ? 'Edit Payment Record' : `Record Payment: ${selectedPurchase?.gadiNumber ? 'Gadi ' + selectedPurchase.gadiNumber : 'Bill Ref'}`}
              </h2>
              <button className="modal-close" onClick={() => { setIsPayModalOpen(false); setIsEditPaymentModalOpen(false); }}>Close</button>
            </div>
            
            <form onSubmit={isEditPaymentModalOpen ? handleEditPaymentSubmit : handlePaySubmit}>
              <div className="form-group row-split">
                <div>
                  <label className="form-label">Payment Date *</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>

              {selectedPurchase && (
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-card)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Outstanding Pending Balances:</div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.15rem' }}>
                    <span>Pending Cash: <strong>₹{selectedPurchase.cashPendingAmount.toLocaleString()}</strong></span>
                    <span>Pending UPI: <strong>₹{selectedPurchase.upiPendingAmount.toLocaleString()}</strong></span>
                  </div>
                </div>
              )}

              {selectedPayment && (
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-card)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Max Reverted Pending limits:</div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.15rem' }}>
                    <span>Pending Cash limit: <strong>₹{selectedPayment.revertedCashPending.toLocaleString()}</strong></span>
                    <span>Pending UPI limit: <strong>₹{selectedPayment.revertedUpiPending.toLocaleString()}</strong></span>
                  </div>
                </div>
              )}

              <div className="form-group row-split">
                <div>
                  <label className="form-label">Cash Amount Settled (₹)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-control"
                    value={cashAmountPaid}
                    onChange={(e) => setCashAmountPaid(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">UPI Amount Settled (₹)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-control"
                    value={upiAmountPaid}
                    onChange={(e) => setUpiAmountPaid(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Description / Notes</label>
                <input 
                  type="text" 
                  placeholder="Reference number, cheque details..." 
                  className="form-control"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setIsPayModalOpen(false); setIsEditPaymentModalOpen(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={payLoading}>
                  {payLoading ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
