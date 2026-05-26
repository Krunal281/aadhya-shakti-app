const { Supplier, Product, Purchase, SupplierPayment, Sale } = require('../config/db');

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Total Stock Sqft Available
    const products = await Product.find({});
    const totalStockSqftAvailable = products.reduce((sum, p) => sum + (p.availableStockSqft || 0), 0);

    // 2. Sales Revenue and Profit/Loss
    const sales = await Sale.find({});
    let totalSalesRevenue = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let totalSalesCash = 0;
    let totalSalesUpi = 0;
    let totalClientPending = 0;

    for (const sale of sales) {
      totalSalesRevenue += sale.sellingAmount || 0;
      totalSalesCash += sale.cashAmount || 0;
      totalSalesUpi += sale.upiAmount || 0;
      totalClientPending += sale.pendingAmount || 0;

      const pL = sale.profitLoss || 0;
      if (pL > 0) {
        totalProfit += pL;
      } else if (pL < 0) {
        totalLoss += Math.abs(pL);
      }
    }

    // 3. Purchase amounts & Supplier debts
    const suppliers = await Supplier.find({});
    const totalPurchaseAmount = suppliers.reduce((sum, s) => sum + (s.totalPurchaseAmount || 0), 0);
    const totalPendingSupplierPayment = suppliers.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);
    const pendingCashAmount = suppliers.reduce((sum, s) => sum + (s.remainingCashAmount || 0), 0);
    const pendingUpiAmount = suppliers.reduce((sum, s) => sum + (s.remainingUpiAmount || 0), 0);

    // 4. Cashflow (Sales Inflow - Supplier Outflow)
    // Supplier Payments = initial payments on purchases + separate payments entries
    const purchases = await Purchase.find({});

    let supplierCashOutflow = 0;
    let supplierUpiOutflow = 0;

    for (const p of purchases) {
      supplierCashOutflow += p.cashPaidAmount || 0;
      supplierUpiOutflow += p.upiPaidAmount || 0;
    }

    const totalCashAvailable = totalSalesCash - supplierCashOutflow;
    const totalUpiAmount = totalSalesUpi - supplierUpiOutflow;

    // 5. Product-wise profit/loss chart data
    const productPLMap = {};
    for (const sale of sales) {
      if (!productPLMap[sale.productName]) {
        productPLMap[sale.productName] = 0;
      }
      productPLMap[sale.productName] += sale.profitLoss || 0;
    }
    const productWiseProfitLoss = Object.keys(productPLMap).map(name => ({
      name,
      profitLoss: Math.round(productPLMap[name] * 100) / 100
    }));

    // 6. Supplier-wise pending amount
    const supplierWisePending = suppliers
      .filter(s => s.remainingAmount > 0)
      .map(s => ({
        name: s.name,
        pendingAmount: s.remainingAmount
      }));

    res.json({
      success: true,
      data: {
        totalStockSqftAvailable: Math.round(totalStockSqftAvailable * 100) / 100,
        totalPurchaseAmount: Math.round(totalPurchaseAmount * 100) / 100,
        totalSalesRevenue: Math.round(totalSalesRevenue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalLoss: Math.round(totalLoss * 100) / 100,
        totalCashAvailable: Math.round(totalCashAvailable * 100) / 100,
        totalUpiAmount: Math.round(totalUpiAmount * 100) / 100,
        totalPendingSupplierPayment: Math.round(totalPendingSupplierPayment * 100) / 100,
        pendingCashAmount: Math.round(pendingCashAmount * 100) / 100,
        pendingUpiAmount: Math.round(pendingUpiAmount * 100) / 100,
        totalClientPending: Math.round(totalClientPending * 100) / 100,
        productWiseProfitLoss,
        supplierWisePending
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
