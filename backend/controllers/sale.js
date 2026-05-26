const { Sale, Product } = require('../config/db');
const { recalculateProductStockAndAverage } = require('../services/recalculator');

// Get all sales
exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.find({});
    // Sort by date descending
    sales.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a sale (Client Billing)
exports.createSale = async (req, res) => {
  try {
    const {
      clientName,
      date,
      productName,
      sqftSold,
      sellingPricePerSqft,
      paymentType,
      cashAmount,
      upiAmount,
      notes
    } = req.body;

    if (!clientName || !date || !productName || !sqftSold || !sellingPricePerSqft) {
      return res.status(400).json({ success: false, message: 'Client name, date, product name, sqft sold, and selling price are required.' });
    }

    const soldQty = Number(sqftSold) || 0;
    const sellPrice = Number(sellingPricePerSqft) || 0;
    let paidCash = Number(cashAmount) || 0;
    let paidUpi = Number(upiAmount) || 0;

    if (soldQty <= 0 || sellPrice <= 0 || paidCash < 0 || paidUpi < 0) {
      return res.status(400).json({ success: false, message: 'Quantities and prices must be positive numbers.' });
    }

    // 1. Fetch product to verify stock availability
    const product = await Product.findOne({ name: productName });
    if (!product) {
      return res.status(404).json({ success: false, message: `Product "${productName}" not found in inventory. Please add it first.` });
    }

    if (soldQty > product.availableStockSqft) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock! Attempting to sell ${soldQty} sqft, but only ${product.availableStockSqft} sqft of "${productName}" is available.`
      });
    }

    // 2. Calculations
    const sellingAmount = Math.round((soldQty * sellPrice) * 100) / 100;
    const costAmount = Math.round((soldQty * product.averagePurchasePricePerSqft) * 100) / 100;
    const profitLoss = Math.round((sellingAmount - costAmount) * 100) / 100;

    if (paymentType === 'Cash') {
      paidUpi = 0;
    } else if (paymentType === 'UPI') {
      paidCash = 0;
    }
    const pendingAmount = Math.max(0, Math.round((sellingAmount - (paidCash + paidUpi)) * 100) / 100);

    // 3. Create Sale Record
    const newSale = await Sale.create({
      clientName,
      date: new Date(date),
      productName,
      sqftSold: soldQty,
      sellingPricePerSqft: sellPrice,
      sellingAmount,
      costAmount,
      profitLoss,
      paymentType,
      cashAmount: paidCash,
      upiAmount: paidUpi,
      pendingAmount,
      notes: notes || ''
    });

    // 4. Update Product Stock stats
    await recalculateProductStockAndAverage(productName);

    res.status(201).json({ success: true, data: newSale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update an existing sale
exports.updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clientName,
      date,
      productName,
      sqftSold,
      sellingPricePerSqft,
      paymentType,
      cashAmount,
      upiAmount,
      notes
    } = req.body;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found.' });
    }

    const oldProductName = sale.productName;
    const oldSqftSold = sale.sqftSold;

    const soldQty = Number(sqftSold) || 0;
    const sellPrice = Number(sellingPricePerSqft) || 0;
    let paidCash = Number(cashAmount) || 0;
    let paidUpi = Number(upiAmount) || 0;

    if (soldQty <= 0 || sellPrice <= 0 || paidCash < 0 || paidUpi < 0) {
      return res.status(400).json({ success: false, message: 'Quantities and prices must be positive numbers.' });
    }

    // Verify stock availability
    const product = await Product.findOne({ name: productName || oldProductName });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found in inventory.' });
    }

    // When checking stock, add back the old sale quantity if editing the same product
    let adjustedAvailableStock = product.availableStockSqft;
    if (product.name === oldProductName) {
      adjustedAvailableStock += oldSqftSold;
    }

    if (soldQty > adjustedAvailableStock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock! Attempting to sell ${soldQty} sqft, but only ${adjustedAvailableStock} sqft is available.`
      });
    }

    // Calculations
    const sellingAmount = Math.round((soldQty * sellPrice) * 100) / 100;
    const costAmount = Math.round((soldQty * product.averagePurchasePricePerSqft) * 100) / 100;
    const profitLoss = Math.round((sellingAmount - costAmount) * 100) / 100;

    if (paymentType === 'Cash') {
      paidUpi = 0;
    } else if (paymentType === 'UPI') {
      paidCash = 0;
    }
    const pendingAmount = Math.max(0, Math.round((sellingAmount - (paidCash + paidUpi)) * 100) / 100);

    // Update Sale Record
    const updatedSale = await Sale.findByIdAndUpdate(id, {
      clientName: clientName || sale.clientName,
      date: date ? new Date(date) : sale.date,
      productName: productName || oldProductName,
      sqftSold: soldQty,
      sellingPricePerSqft: sellPrice,
      sellingAmount,
      costAmount,
      profitLoss,
      paymentType,
      cashAmount: paidCash,
      upiAmount: paidUpi,
      pendingAmount,
      notes: notes !== undefined ? notes : sale.notes
    });

    // Recalculate stock for both old and new products (if name changed)
    await recalculateProductStockAndAverage(productName || oldProductName);
    if (productName && productName !== oldProductName) {
      await recalculateProductStockAndAverage(oldProductName);
    }

    res.json({ success: true, data: updatedSale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a sale
exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found.' });
    }

    const productName = sale.productName;

    // Delete sale
    await Sale.findByIdAndDelete(id);

    // Recalculate stock (restores the sold quantity to available stock)
    await recalculateProductStockAndAverage(productName);

    res.json({ success: true, message: 'Sale record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clear a sale (Mark bill clear, archiving it from active bill lists)
exports.clearSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found.' });
    }

    // Set isCleared to true
    const updatedSale = await Sale.findByIdAndUpdate(id, { isCleared: true });
    
    res.json({ success: true, message: 'Bill cleared/archived successfully.', data: updatedSale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

