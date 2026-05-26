import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, User, Eye, Phone, MapPin } from 'lucide-react';
import { api } from '../services/api';

export default function SuppliersView({ suppliers, fetchSuppliers, onViewChange, setSelectedSupplierName, addToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);

  const openAddModal = () => {
    setIsEditMode(false);
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (supplier) => {
    setIsEditMode(true);
    setEditingId(supplier._id);
    setName(supplier.name);
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setNotes(supplier.notes || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = { name, phone, address, notes };

    try {
      if (isEditMode) {
        await api.updateSupplier(editingId, payload);
        addToast(`Supplier "${name}" updated successfully.`, 'success');
      } else {
        await api.createSupplier(payload);
        addToast(`Supplier "${name}" registered successfully.`, 'success');
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (window.confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) {
      try {
        await api.deleteSupplier(supplier._id);
        addToast(`Supplier "${supplier.name}" deleted successfully.`, 'success');
        fetchSuppliers();
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  const handleViewDetails = (supplierName) => {
    setSelectedSupplierName(supplierName);
    onViewChange('supplier-details');
  };

  const filteredSuppliers = suppliers.filter(s => {
    return s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (s.phone && s.phone.includes(searchTerm)) ||
           (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Supplier Directory</h1>
          <p>Manage accounts, track purchase totals, paid ledger logs, and cash vs. UPI outstanding balances.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} /> Register Supplier
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by supplier name, phone, address..." 
            className="form-control search-input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Supplier Grid/Table */}
      {filteredSuppliers.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No suppliers registered. Click "Register Supplier" to add one.
        </div>
      ) : (
        <div className="glass-card">
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Contact Details</th>
                  <th>Total Purchases</th>
                  <th>Total Paid</th>
                  <th>Remaining Debts</th>
                  <th>Remaining Cash (Red)</th>
                  <th>Remaining UPI (Red)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(supplier => {
                  const rem = supplier.remainingAmount || 0;
                  const remCash = supplier.remainingCashAmount || 0;
                  const remUpi = supplier.remainingUpiAmount || 0;
                  return (
                    <tr key={supplier._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="stat-icon-wrapper" style={{ padding: '0.4rem', borderRadius: '50%' }}>
                            <User size={16} />
                          </div>
                          <strong>{supplier.name}</strong>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {supplier.phone && (
                            <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Phone size={10} style={{ color: 'var(--text-muted)' }} /> {supplier.phone}
                            </span>
                          )}
                          {supplier.address && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={10} /> {supplier.address.length > 25 ? supplier.address.substring(0, 25) + '..' : supplier.address}
                            </span>
                          )}
                        </div>
                      </td>
                      <td><strong>₹{(supplier.totalPurchaseAmount || 0).toLocaleString()}</strong></td>
                      <td>₹{(supplier.totalPaidAmount || 0).toLocaleString()}</td>
                      <td>
                        <strong style={{ color: rem > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          ₹{rem.toLocaleString()}
                        </strong>
                      </td>
                      <td>
                        <span style={{ color: remCash > 0 ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: remCash > 0 ? '600' : '400' }}>
                          ₹{remCash.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: remUpi > 0 ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: remUpi > 0 ? '600' : '400' }}>
                          ₹{remUpi.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleViewDetails(supplier.name)}>
                            <Eye size={12} /> View Ledger
                          </button>
                          <button className="btn-icon edit" title="Edit Profile" onClick={() => openEditModal(supplier)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon delete" title="Delete Profile" onClick={() => handleDelete(supplier)}>
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

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div className="modal-header">
              <h2>{isEditMode ? 'Edit Supplier Profile' : 'Register New Supplier'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Supplier Business Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Rajasthan Granite Hub" 
                  className="form-control" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. 9876543210" 
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Office Address</label>
                <input 
                  type="text" 
                  placeholder="Street, City, State" 
                  className="form-control"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea 
                  placeholder="Bank details, payment terms, contact persons..." 
                  className="form-control"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
