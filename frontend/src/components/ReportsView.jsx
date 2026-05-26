import React, { useState } from 'react';
import { Calendar, Search, Printer, DollarSign, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';

export default function ReportsView({ sales, products, purchases, addToast }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productFilter, setProductFilter] = useState('All');
  const [clientSearch, setClientSearch] = useState('');

  // Handle print report
  const handlePrint = () => {
    window.print();
  };

  // Filter logic
  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    // Date checks
    if (start && saleDate < start) return false;
    if (end && saleDate > end) return false;

    // Product check
    if (productFilter !== 'All' && sale.productName !== productFilter) return false;

    // Search query
    if (clientSearch && !sale.clientName.toLowerCase().includes(clientSearch.toLowerCase())) return false;

    return true;
  });

  // Aggregated calculations based on filtered sales
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let totalSqftSold = 0;
  let cashRevenue = 0;
  let upiRevenue = 0;
  let clientPending = 0;

  for (const sale of filteredSales) {
    totalRevenue += sale.sellingAmount || 0;
    totalCost += sale.costAmount || 0;
    totalSqftSold += sale.sqftSold || 0;
    cashRevenue += sale.cashAmount || 0;
    upiRevenue += sale.upiAmount || 0;
    clientPending += sale.pendingAmount || 0;

    const pL = sale.profitLoss || 0;
    if (pL > 0) {
      totalProfit += pL;
    } else if (pL < 0) {
      totalLoss += Math.abs(pL);
    }
  }

  const netEarnings = totalProfit - totalLoss;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Profit & Loss / Reports</h1>
          <p>Analyze business revenue, cost of goods sold, profit margins, and export print-ready PDF reports.</p>
        </div>
        <button className="btn btn-secondary" onClick={handlePrint}>
          <Printer size={16} /> Print / Export PDF
        </button>
      </div>

      {/* Filter Options */}
      <div className="glass-card filter-bar">
        <div style={{ display: 'flex', flex: 1, gap: '0.75rem', minWidth: '200px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by client name..." 
              className="form-control"
              style={{ paddingLeft: '2.5rem', width: '100%' }}
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="form-label" style={{ whiteSpace: 'nowrap' }}>From:</span>
            <input 
              type="date" 
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="form-label" style={{ whiteSpace: 'nowrap' }}>To:</span>
            <input 
              type="date" 
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <select 
            className="form-control"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="All">All Products</option>
            {products.map(p => (
              <option key={p._id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="glass-card stat-card success">
          <div className="stat-info">
            <span className="stat-label">Sales Revenue</span>
            <span className="stat-value">₹{totalRevenue.toLocaleString()}</span>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Cash: ₹{cashRevenue.toLocaleString()}</span>
              <span>UPI: ₹{upiRevenue.toLocaleString()}</span>
            </div>
          </div>
          <div className="stat-icon-wrapper"><ArrowUpRight size={20} /></div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-info">
            <span className="stat-label">Cost of Goods</span>
            <span className="stat-value">₹{totalCost.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Quantity * Weighted cost</span>
          </div>
          <div className="stat-icon-wrapper"><Layers size={20} /></div>
        </div>

        <div className="glass-card stat-card success">
          <div className="stat-info">
            <span className="stat-label">Net Profit/Loss</span>
            <span className={`stat-value ${netEarnings >= 0 ? 'green-alert' : 'red-alert'}`}>
              ₹{netEarnings.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Revenue - Material Cost</span>
          </div>
          <div className="stat-icon-wrapper"><DollarSign size={20} /></div>
        </div>

        <div className="glass-card stat-card danger">
          <div className="stat-info">
            <span className="stat-label font-bold">Unpaid Client Balances</span>
            <span className="stat-value red-alert">₹{clientPending.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Client debt from invoices</span>
          </div>
          <div className="stat-icon-wrapper"><ArrowDownRight size={20} /></div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Invoiced Sales Breakdown</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Showing {filteredSales.length} invoice(s)</span>
        </div>

        {filteredSales.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No sales records found matching the filter options.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Stone / Product</th>
                  <th>Sqft Sold</th>
                  <th>Sell Rate</th>
                  <th>Billing Total</th>
                  <th>Average Cost</th>
                  <th>Total Cost</th>
                  <th>Net Yield</th>
                  <th>Client Debt</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(sale => {
                  const pL = sale.profitLoss || 0;
                  const isProfit = pL >= 0;
                  const avgCost = sale.sqftSold > 0 ? (sale.costAmount / sale.sqftSold) : 0;
                  const isChemical = products.find(p => p.name === sale.productName)?.type === 'Chemical Bag';
                  const unitLabel = isChemical ? 'bags' : 'sqft';
                  const rateLabel = isChemical ? 'bag' : 'sqft';
                  return (
                    <tr key={sale._id}>
                      <td>{new Date(sale.date).toLocaleDateString()}</td>
                      <td><strong>{sale.clientName}</strong></td>
                      <td>{sale.productName}</td>
                      <td>{sale.sqftSold.toLocaleString()} {unitLabel}</td>
                      <td>₹{sale.sellingPricePerSqft} / {rateLabel}</td>
                      <td><strong>₹{sale.sellingAmount.toLocaleString()}</strong></td>
                      <td>₹{avgCost.toFixed(2)} / {rateLabel}</td>
                      <td>₹{sale.costAmount.toLocaleString()}</td>
                      <td>
                        <span style={{ color: isProfit ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: '700' }}>
                          ₹{pL.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: sale.pendingAmount > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: '500' }}>
                          ₹{(sale.pendingAmount || 0).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
