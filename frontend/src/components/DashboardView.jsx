import React from 'react';
import { 
  Database, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Users, 
  AlertTriangle, 
  ArrowUpRight 
} from 'lucide-react';

export default function DashboardView({ stats, loading, error, onViewChange, onSelectSupplier }) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading Dashboard Analytics...</div>;
  }

  if (error) {
    return <div style={{ color: 'var(--color-danger)', padding: '2rem', textAlign: 'center' }}>Error loading dashboard: {error}</div>;
  }

  const {
    totalStockSqftAvailable,
    totalPurchaseAmount,
    totalSalesRevenue,
    totalProfit,
    totalLoss,
    totalCashAvailable,
    totalUpiAmount,
    totalPendingSupplierPayment,
    pendingCashAmount,
    pendingUpiAmount,
    totalClientPending,
    productWiseProfitLoss,
    supplierWisePending
  } = stats;

  const netProfitLoss = totalProfit - totalLoss;

  // Setup simple scales for SVG charts
  const maxPL = Math.max(...productWiseProfitLoss.map(p => Math.abs(p.profitLoss)), 1000);
  const maxPending = Math.max(...supplierWisePending.map(s => s.pendingAmount), 1000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Dashboard Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Performance Dashboard</h1>
          <p>Real-time inventory volumes, ledger aggregates, net cash flows, and profit metrics.</p>
        </div>
      </div>

      {/* Metrics Row 1 */}
      <div className="stats-grid">
        
        {/* Total Stock Available */}
        <div className="glass-card stat-card primary">
          <div className="stat-info">
            <span className="stat-label">Stock Available</span>
            <span className="stat-value">{totalStockSqftAvailable.toLocaleString()} sqft/units</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current raw inventory</span>
          </div>
          <div className="stat-icon-wrapper">
            <Database size={24} />
          </div>
        </div>

        {/* Total Purchase Amount */}
        <div className="glass-card stat-card">
          <div className="stat-info">
            <span className="stat-label">Total Purchases</span>
            <span className="stat-value">₹{totalPurchaseAmount.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All supplier bills</span>
          </div>
          <div className="stat-icon-wrapper">
            <TrendingDown size={24} />
          </div>
        </div>

        {/* Total Sales Revenue */}
        <div className="glass-card stat-card success">
          <div className="stat-info">
            <span className="stat-label">Sales Revenue</span>
            <span className="stat-value">₹{totalSalesRevenue.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All client sales</span>
          </div>
          <div className="stat-icon-wrapper">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Net Profit / Loss */}
        <div className="glass-card stat-card success">
          <div className="stat-info">
            <span className="stat-label">Net Profit / Loss</span>
            <span className={`stat-value ${netProfitLoss >= 0 ? 'green-alert' : 'red-alert'}`}>
              ₹{netProfitLoss.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {netProfitLoss >= 0 ? 'Net profit generated' : 'Net loss incurred'}
            </span>
          </div>
          <div className="stat-icon-wrapper">
            <DollarSign size={24} />
          </div>
        </div>

      </div>

      {/* Metrics Row 2 - Cashflow & Supplier Debts */}
      <div className="stats-grid">
        
        {/* Cash Available */}
        <div className="glass-card stat-card warning">
          <div className="stat-info">
            <span className="stat-label">Cash Available</span>
            <span className="stat-value" style={{ color: 'var(--accent-cash)' }}>₹{totalCashAvailable.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sales - Purchases (Cash)</span>
          </div>
          <div className="stat-icon-wrapper">
            <DollarSign size={24} style={{ color: 'var(--accent-cash)' }} />
          </div>
        </div>

        {/* UPI Available */}
        <div className="glass-card stat-card primary">
          <div className="stat-info">
            <span className="stat-label">UPI Balance</span>
            <span className="stat-value" style={{ color: 'var(--accent-primary)' }}>₹{totalUpiAmount.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sales - Purchases (UPI)</span>
          </div>
          <div className="stat-icon-wrapper">
            <CreditCard size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
        </div>

        {/* Total Pending Supplier Payment */}
        <div className="glass-card stat-card danger">
          <div className="stat-info">
            <span className="stat-label">Supplier Pending</span>
            <span className="stat-value red-alert">₹{totalPendingSupplierPayment.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total unpaid supplier debts</span>
          </div>
          <div className="stat-icon-wrapper">
            <Users size={24} />
          </div>
        </div>

        {/* Unpaid Client Amount */}
        <div className="glass-card stat-card warning">
          <div className="stat-info">
            <span className="stat-label">Unpaid Client Amount</span>
            <span className="stat-value" style={{ color: 'var(--color-warning)' }}>₹{totalClientPending.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total outstanding client debt</span>
          </div>
          <div className="stat-icon-wrapper">
            <Users size={24} style={{ color: 'var(--color-warning)' }} />
          </div>
        </div>

        {/* Cash & UPI Debt Breakdown */}
        <div className="glass-card stat-card danger">
          <div className="stat-info">
            <span className="stat-label">Debt Breakdown</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-danger)', fontWeight: '600' }}>
                Cash: ₹{pendingCashAmount.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-danger)', fontWeight: '600' }}>
                UPI: ₹{pendingUpiAmount.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="stat-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
        </div>

      </div>

      {/* SVG Charts Row */}
      <div className="charts-grid">
        
        {/* Product Profit/Loss Chart */}
        <div className="glass-card chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Product-wise Profit / Loss</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Weighted cost-based profit</span>
          </div>
          
          {productWiseProfitLoss.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No sales data available to render chart.
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '240px' }}>
              <svg className="svg-chart" viewBox="0 0 600 240" preserveAspectRatio="none">
                {/* Horizontal Baseline (0 profit/loss) */}
                <line x1="40" y1="120" x2="580" y2="120" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" strokeDasharray="4" />
                
                {productWiseProfitLoss.map((prod, index) => {
                  const width = 40;
                  const gap = 30;
                  const x = 60 + index * (width + gap);
                  
                  // Calculate height relative to maxPL
                  const val = prod.profitLoss;
                  const pct = Math.min(Math.abs(val) / maxPL, 1);
                  const h = pct * 90; // scale to 90px max height
                  
                  const y = val >= 0 ? 120 - h : 120;
                  const color = val >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
                  
                  return (
                    <g key={prod.name}>
                      {/* Bar */}
                      <rect 
                        x={x} 
                        y={y} 
                        width={width} 
                        height={Math.max(h, 2)} 
                        fill={color} 
                        rx="4"
                        className="chart-bar"
                      />
                      {/* Label */}
                      <text 
                        x={x + width / 2} 
                        y={val >= 0 ? y - 6 : y + h + 14} 
                        fill="var(--text-primary)" 
                        fontSize="10" 
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        ₹{val.toLocaleString()}
                      </text>
                      {/* Product Name */}
                      <text 
                        x={x + width / 2} 
                        y={val >= 0 ? 230 : 18} 
                        fill="var(--text-secondary)" 
                        fontSize="9" 
                        textAnchor="middle"
                      >
                        {prod.name.length > 10 ? prod.name.substring(0, 10) + '..' : prod.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Supplier Pending Debts Chart */}
        <div className="glass-card chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Supplier Pending Balance</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Outstanding bills</span>
          </div>

          {supplierWisePending.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              All suppliers are fully cleared!
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '240px' }}>
              <svg className="svg-chart" viewBox="0 0 300 240" preserveAspectRatio="none">
                {supplierWisePending.map((sup, index) => {
                  const width = 30;
                  const gap = 20;
                  const x = 40 + index * (width + gap);
                  
                  // Calculate height relative to maxPending
                  const pct = Math.min(sup.pendingAmount / maxPending, 1);
                  const h = pct * 160; // scale to 160px max height
                  const y = 200 - h;
                  
                  return (
                    <g key={sup.name} style={{ cursor: 'pointer' }} onClick={() => onSelectSupplier(sup.name)}>
                      {/* Bar */}
                      <rect 
                        x={x} 
                        y={y} 
                        width={width} 
                        height={Math.max(h, 2)} 
                        fill="var(--color-danger)" 
                        rx="4"
                        className="chart-bar"
                      />
                      {/* Label */}
                      <text 
                        x={x + width / 2} 
                        y={y - 6} 
                        fill="var(--color-danger)" 
                        fontSize="9" 
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        ₹{sup.pendingAmount.toLocaleString()}
                      </text>
                      {/* Supplier Name */}
                      <text 
                        x={x + width / 2} 
                        y="220" 
                        fill="var(--text-secondary)" 
                        fontSize="9" 
                        textAnchor="middle"
                      >
                        {sup.name.length > 8 ? sup.name.substring(0, 8) + '..' : sup.name}
                      </text>
                    </g>
                  );
                })}
                {/* Floor Line */}
                <line x1="20" y1="200" x2="280" y2="200" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
