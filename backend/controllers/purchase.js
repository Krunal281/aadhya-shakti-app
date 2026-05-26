const { Purchase, Product, Supplier } = require('../config/db');
const { recalculateProductStockAndAverage, recalculateSupplierTotals } = require('../services/recalculator');

// Get all purchases
exports.getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({});
    // Sort by date descending
    purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new purchase
exports.createPurchase = async (req, res) => {
  try {
    const {
      supplierName,
      date,
      gadiNumber,
      items,
      paymentMode,
      cashPaidAmount,
      upiPaidAmount,
      cashPendingAmount,
      upiPendingAmount,
      dueDate,
      notes
    } = req.body;

    if (!supplierName || !date || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'Supplier name, date, and items are required.' });
    }

    // 1. Process items, calculate total and check validation
    let totalBillAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productName) {
        return res.status(400).json({ success: false, message: 'All items must have a product/granite name.' });
      }
      const sqft = Number(item.sqft) || 0;
      const pricePerSqft = Number(item.pricePerSqft) || 0;

      if (sqft <= 0 || pricePerSqft <= 0) {
        return res.status(400).json({ success: false, message: 'Sqft and Price per Sqft must be greater than zero.' });
      }

      const totalAmount = Math.round((sqft * pricePerSqft) * 100) / 100;
      totalBillAmount += totalAmount;

      validatedItems.push({
        productName: item.productName,
        sqft,
        pricePerSqft,
        totalAmount
      });
    }

    totalBillAmount = Math.round(totalBillAmount * 100) / 100;

    // 2. Process payments split and pending calculation
    let cashPaid = Number(cashPaidAmount) || 0;
    let upiPaid = Number(upiPaidAmount) || 0;
    let cashPending = Number(cashPendingAmount) || 0;
    let upiPending = Number(upiPendingAmount) || 0;

    if (cashPaid < 0 || upiPaid < 0 || cashPending < 0 || upiPending < 0) {
      return res.status(400).json({ success: false, message: 'Payment amounts cannot be negative.' });
    }

    if (paymentMode === 'Cash') {
      cashPending = Math.max(0, totalBillAmount - cashPaid);
      upiPaid = 0;
      upiPending = 0;
    } else if (paymentMode === 'UPI') {
      upiPending = Math.max(0, totalBillAmount - upiPaid);
      cashPaid = 0;
      cashPending = 0;
    } else if (paymentMode === 'Both') {
      // Validate that total paid + pending equals bill amount
      const totalAllocated = cashPaid + upiPaid + cashPending + upiPending;
      if (Math.abs(totalAllocated - totalBillAmount) > 1.0) {
        return res.status(400).json({
          success: false,
          message: `Sum of Cash Paid, UPI Paid, Cash Pending, and UPI Pending (₹${totalAllocated}) must equal the total bill amount (₹${totalBillAmount}).`
        });
      }
    }

    const totalPaid = cashPaid + upiPaid;
    const totalPending = cashPending + upiPending;

    let paymentStatus = 'Pending';
    if (totalPending === 0) {
      paymentStatus = 'Clear';
    } else if (totalPaid > 0) {
      paymentStatus = 'Partial';
    }

    // 3. Save purchase record
    const newPurchase = await Purchase.create({
      supplierName,
      date: new Date(date),
      gadiNumber: gadiNumber || '',
      items: validatedItems,
      totalBillAmount,
      paymentStatus,
      paymentMode,
      cashPaidAmount: cashPaid,
      upiPaidAmount: upiPaid,
      cashPendingAmount: cashPending,
      upiPendingAmount: upiPending,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || ''
    });

    // 4. Auto-create product if it doesn't exist, and recalculate stocks
    for (const item of validatedItems) {
      let product = await Product.findOne({ name: item.productName });
      if (!product) {
        // Automatically register product in inventory
        await Product.create({
          name: item.productName,
          photo: '',
          type: item.productName.toLowerCase().includes('marble') ? 'Marble' : 'Granite',
          supplierName,
          initialSqft: 0,
          initialPricePerSqft: 0,
          sellingPricePerSqft: Math.round(item.pricePerSqft * 1.25 * 100) / 100, // 25% default markup
          totalSqftPurchased: 0,
          averagePurchasePricePerSqft: 0,
          availableStockSqft: 0,
          soldStockSqft: 0
        });
      }
      await recalculateProductStockAndAverage(item.productName);
    }

    // 5. Update supplier totals & payment ledger
    // Ensure supplier exists, if not, auto-create
    let supplier = await Supplier.findOne({ name: supplierName });
    if (!supplier) {
      await Supplier.create({ name: supplierName });
    }
    await recalculateSupplierTotals(supplierName);

    res.status(201).json({ success: true, data: newPurchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update an existing purchase (Gadi Entry)
exports.updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplierName,
      date,
      gadiNumber,
      items,
      paymentMode,
      cashPaidAmount,
      upiPaidAmount,
      cashPendingAmount,
      upiPendingAmount,
      dueDate,
      notes
    } = req.body;

    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found.' });
    }

    const oldSupplierName = purchase.supplierName;
    const oldProducts = purchase.items.map(i => i.productName);

    // Validate Items
    let totalBillAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productName) {
        return res.status(400).json({ success: false, message: 'All items must have a product/granite name.' });
      }
      const sqft = Number(item.sqft) || 0;
      const pricePerSqft = Number(item.pricePerSqft) || 0;

      if (sqft <= 0 || pricePerSqft <= 0) {
        return res.status(400).json({ success: false, message: 'Sqft and Price per Sqft must be greater than zero.' });
      }

      const totalAmount = Math.round((sqft * pricePerSqft) * 100) / 100;
      totalBillAmount += totalAmount;

      validatedItems.push({
        productName: item.productName,
        sqft,
        pricePerSqft,
        totalAmount
      });
    }

    totalBillAmount = Math.round(totalBillAmount * 100) / 100;

    // Payments validations
    let cashPaid = Number(cashPaidAmount) || 0;
    let upiPaid = Number(upiPaidAmount) || 0;
    let cashPending = Number(cashPendingAmount) || 0;
    let upiPending = Number(upiPendingAmount) || 0;

    if (cashPaid < 0 || upiPaid < 0 || cashPending < 0 || upiPending < 0) {
      return res.status(400).json({ success: false, message: 'Payment amounts cannot be negative.' });
    }

    if (paymentMode === 'Cash') {
      cashPending = Math.max(0, totalBillAmount - cashPaid);
      upiPaid = 0;
      upiPending = 0;
    } else if (paymentMode === 'UPI') {
      upiPending = Math.max(0, totalBillAmount - upiPaid);
      cashPaid = 0;
      cashPending = 0;
    } else if (paymentMode === 'Both') {
      const totalAllocated = cashPaid + upiPaid + cashPending + upiPending;
      if (Math.abs(totalAllocated - totalBillAmount) > 1.0) {
        return res.status(400).json({
          success: false,
          message: `Sum of cash/UPI paid and pending (₹${totalAllocated}) must match total bill amount (₹${totalBillAmount}).`
        });
      }
    }

    const totalPaid = cashPaid + upiPaid;
    const totalPending = cashPending + upiPending;

    let paymentStatus = 'Pending';
    if (totalPending === 0) {
      paymentStatus = 'Clear';
    } else if (totalPaid > 0) {
      paymentStatus = 'Partial';
    }

    // Update Purchase Record
    const updatedPurchase = await Purchase.findByIdAndUpdate(id, {
      supplierName: supplierName || oldSupplierName,
      date: date ? new Date(date) : purchase.date,
      gadiNumber: gadiNumber !== undefined ? gadiNumber : purchase.gadiNumber,
      items: validatedItems,
      totalBillAmount,
      paymentStatus,
      paymentMode,
      cashPaidAmount: cashPaid,
      upiPaidAmount: upiPaid,
      cashPendingAmount: cashPending,
      upiPendingAmount: upiPending,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes !== undefined ? notes : purchase.notes
    });

    // 1. Recalculate stock for all old products and new products
    const newProducts = validatedItems.map(i => i.productName);
    const uniqueProducts = Array.from(new Set([...oldProducts, ...newProducts]));

    for (const prodName of uniqueProducts) {
      // Auto-create product if it doesn't exist in new items
      const productExists = await Product.findOne({ name: prodName });
      if (!productExists && newProducts.includes(prodName)) {
        await Product.create({
          name: prodName,
          photo: '',
          type: prodName.toLowerCase().includes('marble') ? 'Marble' : 'Granite',
          supplierName: supplierName || oldSupplierName,
          sellingPricePerSqft: validatedItems.find(i => i.productName === prodName).pricePerSqft * 1.25,
          totalSqftPurchased: 0,
          averagePurchasePricePerSqft: 0,
          availableStockSqft: 0,
          soldStockSqft: 0
        });
      }
      await recalculateProductStockAndAverage(prodName);
    }

    // 2. Recalculate supplier totals for old and new suppliers
    await recalculateSupplierTotals(supplierName || oldSupplierName);
    if (supplierName && supplierName !== oldSupplierName) {
      let oldSup = await Supplier.findOne({ name: oldSupplierName });
      if (!oldSup) await Supplier.create({ name: oldSupplierName });
      await recalculateSupplierTotals(oldSupplierName);
    }

    res.json({ success: true, data: updatedPurchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a purchase (Gadi Entry)
exports.deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found.' });
    }

    const supplierName = purchase.supplierName;
    const productNames = purchase.items.map(item => item.productName);

    // Delete purchase
    await Purchase.findByIdAndDelete(id);

    // Recalculate stocks for products
    for (const prodName of productNames) {
      await recalculateProductStockAndAverage(prodName);
    }

    // Recalculate supplier totals
    await recalculateSupplierTotals(supplierName);

    res.json({ success: true, message: 'Purchase record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
