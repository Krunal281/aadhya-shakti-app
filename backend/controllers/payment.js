const { SupplierPayment, Purchase, Supplier, UndoHistory } = require('../config/db');
const { recalculateSupplierTotals } = require('../services/recalculator');

// Get all payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await SupplierPayment.find({});
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new supplier payment
exports.createPayment = async (req, res) => {
  try {
    const { date, supplierName, purchaseId, cashAmountPaid, upiAmountPaid, notes } = req.body;

    if (!supplierName || !purchaseId || !date) {
      return res.status(400).json({ success: false, message: 'Supplier name, date, and purchase bill ID are required.' });
    }

    const cashPaid = Number(cashAmountPaid) || 0;
    const upiPaid = Number(upiAmountPaid) || 0;

    if (cashPaid < 0 || upiPaid < 0) {
      return res.status(400).json({ success: false, message: 'Payment amounts cannot be negative.' });
    }

    if (cashPaid === 0 && upiPaid === 0) {
      return res.status(400).json({ success: false, message: 'At least one payment amount (Cash or UPI) must be greater than zero.' });
    }

    // Find the related purchase
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase bill not found.' });
    }

    // Validate that payment is not greater than pending
    if (cashPaid > purchase.cashPendingAmount) {
      return res.status(400).json({
        success: false,
        message: `Paid cash (₹${cashPaid}) cannot exceed pending cash (₹${purchase.cashPendingAmount}) for this bill.`
      });
    }

    if (upiPaid > purchase.upiPendingAmount) {
      return res.status(400).json({
        success: false,
        message: `Paid UPI (₹${upiPaid}) cannot exceed pending UPI (₹${purchase.upiPendingAmount}) for this bill.`
      });
    }

    // Calculate new pending amounts
    const remainingCash = Math.round((purchase.cashPendingAmount - cashPaid) * 100) / 100;
    const remainingUpi = Math.round((purchase.upiPendingAmount - upiPaid) * 100) / 100;
    const totalRemaining = remainingCash + remainingUpi;

    let paymentStatus = 'Pending';
    if (totalRemaining === 0) {
      paymentStatus = 'Clear';
    } else {
      paymentStatus = 'Partial';
    }

    // Create Payment Entry
    const totalPaid = cashPaid + upiPaid;
    const newPayment = await SupplierPayment.create({
      date: new Date(date),
      supplierName,
      purchaseId,
      cashAmountPaid: cashPaid,
      upiAmountPaid: upiPaid,
      totalPaid,
      remainingCash,
      remainingUpi,
      notes: notes || `Payment for bill`
    });

    // Update Purchase Record
    await Purchase.findByIdAndUpdate(purchaseId, {
      cashPaidAmount: Math.round((purchase.cashPaidAmount + cashPaid) * 100) / 100,
      upiPaidAmount: Math.round((purchase.upiPaidAmount + upiPaid) * 100) / 100,
      cashPendingAmount: remainingCash,
      upiPendingAmount: remainingUpi,
      paymentStatus
    });

    // Recalculate Supplier Totals & Ledger
    await recalculateSupplierTotals(supplierName);

    res.status(201).json({ success: true, data: newPayment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update an existing payment transaction
exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, cashAmountPaid, upiAmountPaid, notes } = req.body;

    const payment = await SupplierPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const purchaseId = payment.purchaseId;
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Associated purchase bill not found.' });
    }

    const newCashPaid = Number(cashAmountPaid) || 0;
    const newUpiPaid = Number(upiAmountPaid) || 0;

    if (newCashPaid < 0 || newUpiPaid < 0) {
      return res.status(400).json({ success: false, message: 'Payment amounts cannot be negative.' });
    }

    // Adjust purchase bill's pending amounts back (as if the old payment never happened)
    // to check if the new payments are valid
    const revertedCashPending = purchase.cashPendingAmount + payment.cashAmountPaid;
    const revertedUpiPending = purchase.upiPendingAmount + payment.upiAmountPaid;

    if (newCashPaid > revertedCashPending) {
      return res.status(400).json({
        success: false,
        message: `New cash payment (₹${newCashPaid}) exceeds the total pending cash (₹${revertedCashPending}) on the bill.`
      });
    }

    if (newUpiPaid > revertedUpiPending) {
      return res.status(400).json({
        success: false,
        message: `New UPI payment (₹${newUpiPaid}) exceeds the total pending UPI (₹${revertedUpiPending}) on the bill.`
      });
    }

    // Calculate new values
    const newCashPending = Math.round((revertedCashPending - newCashPaid) * 100) / 100;
    const newUpiPending = Math.round((revertedUpiPending - newUpiPaid) * 100) / 100;
    const totalRemaining = newCashPending + newUpiPending;

    let paymentStatus = 'Pending';
    if (totalRemaining === 0) {
      paymentStatus = 'Clear';
    } else {
      paymentStatus = 'Partial';
    }

    // Update purchase bill
    await Purchase.findByIdAndUpdate(purchaseId, {
      cashPaidAmount: Math.round((purchase.cashPaidAmount - payment.cashAmountPaid + newCashPaid) * 100) / 100,
      upiPaidAmount: Math.round((purchase.upiPaidAmount - payment.upiAmountPaid + newUpiPaid) * 100) / 100,
      cashPendingAmount: newCashPending,
      upiPendingAmount: newUpiPending,
      paymentStatus
    });

    // Update payment record
    const totalPaid = newCashPaid + newUpiPaid;
    const updatedPayment = await SupplierPayment.findByIdAndUpdate(id, {
      date: date ? new Date(date) : payment.date,
      cashAmountPaid: newCashPaid,
      upiAmountPaid: newUpiPaid,
      totalPaid,
      remainingCash: newCashPending,
      remainingUpi: newUpiPending,
      notes: notes !== undefined ? notes : payment.notes
    });

    // Recalculate supplier
    await recalculateSupplierTotals(payment.supplierName);

    res.json({ success: true, data: updatedPayment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a payment transaction
exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await SupplierPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const purchaseId = payment.purchaseId;
    const purchase = await Purchase.findById(purchaseId);

    if (purchase) {
      // Revert the pending and paid amounts on the purchase bill
      const restoredCashPending = Math.round((purchase.cashPendingAmount + payment.cashAmountPaid) * 100) / 100;
      const restoredUpiPending = Math.round((purchase.upiPendingAmount + payment.upiAmountPaid) * 100) / 100;
      const restoredTotalPaid = purchase.cashPaidAmount + purchase.upiPaidAmount - payment.totalPaid;

      let paymentStatus = 'Pending';
      if (restoredTotalPaid > 0) {
        paymentStatus = 'Partial';
      }

      await Purchase.findByIdAndUpdate(purchaseId, {
        cashPaidAmount: Math.max(0, Math.round((purchase.cashPaidAmount - payment.cashAmountPaid) * 100) / 100),
        upiPaidAmount: Math.max(0, Math.round((purchase.upiPaidAmount - payment.upiAmountPaid) * 100) / 100),
        cashPendingAmount: restoredCashPending,
        upiPendingAmount: restoredUpiPending,
        paymentStatus
      });
    }

    // Delete payment
    await SupplierPayment.findByIdAndDelete(id);

    // Recalculate supplier
    await recalculateSupplierTotals(payment.supplierName);

    res.json({ success: true, message: 'Payment record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clear pending Cash, UPI or Full bill
exports.clearPayment = async (req, res) => {
  try {
    const { purchaseId, clearType, notes } = req.body; // clearType: 'Cash' | 'UPI' | 'Full'

    if (!purchaseId || !clearType) {
      return res.status(400).json({ success: false, message: 'Purchase bill ID and clear type are required.' });
    }

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase bill not found.' });
    }

    let cashAmountPaid = 0;
    let upiAmountPaid = 0;

    if (clearType === 'Cash') {
      cashAmountPaid = purchase.cashPendingAmount;
    } else if (clearType === 'UPI') {
      upiAmountPaid = purchase.upiPendingAmount;
    } else if (clearType === 'Full') {
      cashAmountPaid = purchase.cashPendingAmount;
      upiAmountPaid = purchase.upiPendingAmount;
    }

    if (cashAmountPaid === 0 && upiAmountPaid === 0) {
      return res.status(400).json({ success: false, message: `The pending amount for ${clearType} is already zero.` });
    }

    // Create payment transaction
    const totalPaid = cashAmountPaid + upiAmountPaid;
    const remainingCash = clearType === 'Cash' || clearType === 'Full' ? 0 : purchase.cashPendingAmount;
    const remainingUpi = clearType === 'UPI' || clearType === 'Full' ? 0 : purchase.upiPendingAmount;

    const newPayment = await SupplierPayment.create({
      date: new Date(),
      supplierName: purchase.supplierName,
      purchaseId: purchase._id,
      cashAmountPaid,
      upiAmountPaid,
      totalPaid,
      remainingCash,
      remainingUpi,
      notes: notes || `Cleared pending ${clearType}`
    });

    // Save previous state to Undo History BEFORE updating
    const undoRecord = await UndoHistory.create({
      actionType: 'PAYMENT_CLEAR',
      targetCollection: 'Purchase',
      targetId: purchase._id,
      previousState: {
        cashPendingAmount: purchase.cashPendingAmount,
        upiPendingAmount: purchase.upiPendingAmount,
        cashPaidAmount: purchase.cashPaidAmount,
        upiPaidAmount: purchase.upiPaidAmount,
        paymentStatus: purchase.paymentStatus,
        paymentId: newPayment._id // Store payment ID so we can delete it on undo!
      },
      description: `Cleared pending ${clearType} for Bill Reference: ${purchase.gadiNumber || purchase._id.substring(0, 8)}`
    });

    // Update Purchase
    const newCashPending = remainingCash;
    const newUpiPending = remainingUpi;
    const totalRemaining = newCashPending + newUpiPending;

    let paymentStatus = 'Pending';
    if (totalRemaining === 0) {
      paymentStatus = 'Clear';
    } else {
      paymentStatus = 'Partial';
    }

    await Purchase.findByIdAndUpdate(purchaseId, {
      cashPaidAmount: Math.round((purchase.cashPaidAmount + cashAmountPaid) * 100) / 100,
      upiPaidAmount: Math.round((purchase.upiPaidAmount + upiAmountPaid) * 100) / 100,
      cashPendingAmount: newCashPending,
      upiPendingAmount: newUpiPending,
      paymentStatus
    });

    // Recalculate supplier
    await recalculateSupplierTotals(purchase.supplierName);

    res.json({
      success: true,
      message: `Pending ${clearType} cleared successfully.`,
      data: newPayment,
      undoId: undoRecord._id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Undo payment clear
exports.undoClearPayment = async (req, res) => {
  try {
    const { id } = req.params; // Can be purchaseId

    // Find the latest PAYMENT_CLEAR history entry for this purchase bill
    const undoEntries = await UndoHistory.find({ targetId: id, actionType: 'PAYMENT_CLEAR' });
    if (!undoEntries.length) {
      return res.status(404).json({ success: false, message: 'No clear actions found to undo for this bill.' });
    }

    // Sort descending by date to get the latest
    undoEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestUndo = undoEntries[0];
    const prev = latestUndo.previousState;

    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Associated purchase bill not found.' });
    }

    // 1. Restore purchase bill values
    await Purchase.findByIdAndUpdate(id, {
      cashPendingAmount: prev.cashPendingAmount,
      upiPendingAmount: prev.upiPendingAmount,
      cashPaidAmount: prev.cashPaidAmount,
      upiPaidAmount: prev.upiPaidAmount,
      paymentStatus: prev.paymentStatus
    });

    // 2. Delete the payment transaction generated during the clear
    if (prev.paymentId) {
      await SupplierPayment.findByIdAndDelete(prev.paymentId);
    }

    // 3. Remove the undo history item to prevent duplicate undos
    await UndoHistory.findByIdAndDelete(latestUndo._id);

    // 4. Recalculate Supplier Totals
    await recalculateSupplierTotals(purchase.supplierName);

    res.json({ success: true, message: 'Payment clear action successfully undone.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
