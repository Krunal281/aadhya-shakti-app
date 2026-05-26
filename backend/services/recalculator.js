const { Supplier, Product, Purchase, SupplierPayment, Sale, PaymentLedger } = require('../config/db');

/**
 * Recalculates stock and weighted average purchase price for a specific product
 * Formula: averagePrice = (initialSqft * initialPrice + Sum(purchaseItemSqft * purchaseItemPrice)) / (initialSqft + Sum(purchaseItemSqft))
 * availableStock = initialSqft + Sum(purchaseItemSqft) - Sum(saleSqft)
 */
async function recalculateProductStockAndAverage(productName) {
  if (!productName) return;

  const product = await Product.findOne({ name: productName });
  if (!product) return;

  // 1. Fetch all purchases containing this product
  const allPurchases = await Purchase.find({});
  let totalSqftFromPurchases = 0;
  let totalAmountFromPurchases = 0;

  for (const purchase of allPurchases) {
    const matchedItems = purchase.items.filter(item => item.productName === productName);
    for (const item of matchedItems) {
      totalSqftFromPurchases += item.sqft;
      totalAmountFromPurchases += (item.sqft * item.pricePerSqft);
    }
  }

  // Calculate totals including initial product creation values
  const initialSqft = product.initialSqft || 0;
  const initialPrice = product.initialPricePerSqft || 0;
  const initialAmount = initialSqft * initialPrice;

  const totalSqftPurchased = initialSqft + totalSqftFromPurchases;
  const totalPurchaseAmount = initialAmount + totalAmountFromPurchases;

  let averagePurchasePricePerSqft = 0;
  if (totalSqftPurchased > 0) {
    // Weighted Average formula: totalAmount / totalSqft
    averagePurchasePricePerSqft = Math.round((totalPurchaseAmount / totalSqftPurchased) * 100) / 100;
  } else {
    averagePurchasePricePerSqft = initialPrice;
  }

  // 2. Fetch all sales for this product
  const allSales = await Sale.find({ productName });
  let soldStockSqft = 0;
  for (const sale of allSales) {
    soldStockSqft += sale.sqftSold;
  }

  // Available stock: total purchased - sold stock
  const availableStockSqft = totalSqftPurchased - soldStockSqft;

  // Update the product record
  await Product.findByIdAndUpdate(product._id, {
    totalSqftPurchased,
    averagePurchasePricePerSqft,
    availableStockSqft,
    soldStockSqft
  });

  // Now, update cost and profit for all sales of this product using the new average price
  // The prompt says: "profit = sellingAmount - costAmount; costAmount = soldSqft * averagePurchasePricePerSqft"
  // Since average price changed, we should recalculate the costAmount and profitLoss of the sales to keep history correct.
  for (const sale of allSales) {
    const costAmount = Math.round((sale.sqftSold * averagePurchasePricePerSqft) * 100) / 100;
    const profitLoss = Math.round((sale.sellingAmount - costAmount) * 100) / 100;
    await Sale.findByIdAndUpdate(sale._id, {
      costAmount,
      profitLoss
    });
  }
}

/**
 * Recalculates supplier financial metrics
 */
async function recalculateSupplierTotals(supplierName) {
  if (!supplierName) return;

  const supplier = await Supplier.findOne({ name: supplierName });
  if (!supplier) return;

  // Fetch all purchases
  const purchases = await Purchase.find({ supplierName });
  let totalPurchaseAmount = 0;
  let remainingCashAmount = 0;
  let remainingUpiAmount = 0;

  for (const purchase of purchases) {
    totalPurchaseAmount += purchase.totalBillAmount;
    remainingCashAmount += purchase.cashPendingAmount;
    remainingUpiAmount += purchase.upiPendingAmount;
  }

  const remainingAmount = remainingCashAmount + remainingUpiAmount;
  const totalPaidAmount = totalPurchaseAmount - remainingAmount;

  await Supplier.findByIdAndUpdate(supplier._id, {
    totalPurchaseAmount: Math.round(totalPurchaseAmount * 100) / 100,
    totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
    remainingCashAmount: Math.round(remainingCashAmount * 100) / 100,
    remainingUpiAmount: Math.round(remainingUpiAmount * 100) / 100
  });

  // Sync Ledger History
  await syncPaymentLedger(supplierName);
}

/**
 * Rebuilds the payment ledger for a supplier
 */
async function syncPaymentLedger(supplierName) {
  if (!supplierName) return;

  // Delete all existing ledger items for this supplier
  await PaymentLedger.deleteMany({ supplierName });

  const purchases = await Purchase.find({ supplierName });
  const payments = await SupplierPayment.find({ supplierName });

  const ledgerEntries = [];

  // Add purchase entries to ledger list
  for (const p of purchases) {
    const totalRemaining = p.cashPendingAmount + p.upiPendingAmount;
    ledgerEntries.push({
      supplierName,
      date: p.date,
      entryType: 'Purchase',
      refId: p._id,
      description: p.gadiNumber ? `Purchase (Gadi No: ${p.gadiNumber})` : `Purchase Bill`,
      cashPaid: p.cashPaidAmount,
      upiPaid: p.upiPaidAmount,
      cashPending: p.cashPendingAmount,
      upiPending: p.upiPendingAmount,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      status: p.paymentStatus
    });
  }

  // Add payment entries to ledger list
  for (const pm of payments) {
    const totalRemaining = pm.remainingCash + pm.remainingUpi;
    ledgerEntries.push({
      supplierName,
      date: pm.date,
      entryType: 'Payment',
      refId: pm._id,
      description: pm.notes || `Payment made`,
      cashPaid: pm.cashAmountPaid,
      upiPaid: pm.upiAmountPaid,
      cashPending: 0,
      upiPending: 0,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      status: 'Clear'
    });
  }

  // Write all back to database
  // Note: We can create entries one by one or in bulk. Since our interface has a create method:
  for (const entry of ledgerEntries) {
    await PaymentLedger.create(entry);
  }
}

module.exports = {
  recalculateProductStockAndAverage,
  recalculateSupplierTotals,
  syncPaymentLedger
};
