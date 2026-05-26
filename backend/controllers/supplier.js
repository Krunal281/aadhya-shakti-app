const { Supplier, Purchase, SupplierPayment, PaymentLedger } = require('../config/db');
const { recalculateSupplierTotals } = require('../services/recalculator');

// Get all suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({});
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new supplier
exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    }

    const existingSupplier = await Supplier.findOne({ name });
    if (existingSupplier) {
      return res.status(400).json({ success: false, message: 'A supplier with this name already exists.' });
    }

    const newSupplier = await Supplier.create({
      name,
      phone: phone || '',
      address: address || '',
      notes: notes || '',
      totalPurchaseAmount: 0,
      totalPaidAmount: 0,
      remainingAmount: 0,
      remainingCashAmount: 0,
      remainingUpiAmount: 0
    });

    res.status(201).json({ success: true, data: newSupplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update supplier details
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, notes } = req.body;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    const oldName = supplier.name;
    const isNameChanged = name && name !== oldName;

    if (isNameChanged) {
      const existingSupplier = await Supplier.findOne({ name });
      if (existingSupplier) {
        return res.status(400).json({ success: false, message: 'A supplier with this name already exists.' });
      }
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(id, {
      name: name || oldName,
      phone: phone !== undefined ? phone : supplier.phone,
      address: address !== undefined ? address : supplier.address,
      notes: notes !== undefined ? notes : supplier.notes
    });

    // If supplier name changed, propagate the changes to Purchases, Payments, and Ledger
    if (isNameChanged) {
      // 1. Update Purchases
      const purchases = await Purchase.find({ supplierName: oldName });
      for (const p of purchases) {
        await Purchase.findByIdAndUpdate(p._id, { supplierName: name });
      }

      // 2. Update Payments
      const payments = await SupplierPayment.find({ supplierName: oldName });
      for (const pm of payments) {
        await SupplierPayment.findByIdAndUpdate(pm._id, { supplierName: name });
      }

      // 3. Update Ledger
      const ledgers = await PaymentLedger.find({ supplierName: oldName });
      for (const l of ledgers) {
        await PaymentLedger.findByIdAndUpdate(l._id, { supplierName: name });
      }
    }

    // Trigger recalculation for supplier
    await recalculateSupplierTotals(name || oldName);
    if (isNameChanged) {
      await recalculateSupplierTotals(oldName);
    }

    res.json({ success: true, data: updatedSupplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    // Prevent deletion if supplier has transactions
    const purchases = await Purchase.find({ supplierName: supplier.name });
    if (purchases.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete supplier "${supplier.name}" because they have ${purchases.length} purchase transaction(s) recorded.`
      });
    }

    const payments = await SupplierPayment.find({ supplierName: supplier.name });
    if (payments.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete supplier "${supplier.name}" because they have ${payments.length} payment transaction(s) recorded.`
      });
    }

    await Supplier.findByIdAndDelete(id);
    // Cleanup any orphaned ledger entries
    await PaymentLedger.deleteMany({ supplierName: supplier.name });

    res.json({ success: true, message: 'Supplier deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get detailed supplier profile
exports.getSupplierDetails = async (req, res) => {
  try {
    const { name } = req.params;
    const supplier = await Supplier.findOne({ name });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    // Get all purchases for this supplier
    const purchases = await Purchase.find({ supplierName: name });
    
    // Get all payment transactions
    const payments = await SupplierPayment.find({ supplierName: name });

    // Get sorted ledger entries (newest first)
    const ledger = await PaymentLedger.find({ supplierName: name });
    ledger.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: {
        supplier,
        purchases: purchases.sort((a, b) => new Date(b.date) - new Date(a.date)),
        payments: payments.sort((a, b) => new Date(b.date) - new Date(a.date)),
        ledger
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
