const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboard');
const productController = require('../controllers/product');
const supplierController = require('../controllers/supplier');
const purchaseController = require('../controllers/purchase');
const saleController = require('../controllers/sale');
const paymentController = require('../controllers/payment');

// Dashboard route
router.get('/dashboard', dashboardController.getDashboardStats);

// Products (Inventory) routes
router.get('/products', productController.getProducts);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// Suppliers routes
router.get('/suppliers', supplierController.getSuppliers);
router.post('/suppliers', supplierController.createSupplier);
router.put('/suppliers/:id', supplierController.updateSupplier);
router.delete('/suppliers/:id', supplierController.deleteSupplier);
router.get('/suppliers/:name/details', supplierController.getSupplierDetails);

// Purchases (Gadi Entries) routes
router.get('/purchases', purchaseController.getPurchases);
router.post('/purchases', purchaseController.createPurchase);
router.put('/purchases/:id', purchaseController.updatePurchase);
router.delete('/purchases/:id', purchaseController.deletePurchase);

// Supplier Payments & Ledger routes
router.get('/payments', paymentController.getPayments);
router.post('/payments', paymentController.createPayment);
router.put('/payments/:id', paymentController.updatePayment);
router.delete('/payments/:id', paymentController.deletePayment);
router.post('/payments/clear', paymentController.clearPayment);
router.post('/payments/undo/:id', paymentController.undoClearPayment);

// Sales (Client Billing) routes
router.get('/sales', saleController.getSales);
router.post('/sales', saleController.createSale);
router.put('/sales/:id', saleController.updateSale);
router.delete('/sales/:id', saleController.deleteSale);
router.post('/sales/:id/clear', saleController.clearSale);

module.exports = router;
