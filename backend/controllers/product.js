const { Product, Purchase, Sale } = require('../config/db');
const { recalculateProductStockAndAverage } = require('../services/recalculator');

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    // Add a low stock warning flag dynamically
    const productsWithWarning = products.map(p => {
      const isLowStock = p.availableStockSqft < 500; // Low stock warning threshold: 500 sqft
      return {
        ...p,
        isLowStock
      };
    });
    res.json({ success: true, data: productsWithWarning });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { name, photo, type, supplierName, initialSqft, initialPricePerSqft, sellingPricePerSqft } = req.body;

    if (!name || !type || !supplierName) {
      return res.status(400).json({ success: false, message: 'Product name, type, and supplier are required.' });
    }

    // Check if product name already exists
    const existingProduct = await Product.findOne({ name });
    if (existingProduct) {
      return res.status(400).json({ success: false, message: 'A product with this name already exists.' });
    }

    const initSqft = Number(initialSqft) || 0;
    const initPrice = Number(initialPricePerSqft) || 0;
    const sellPrice = Number(sellingPricePerSqft) || 0;

    if (initSqft < 0 || initPrice < 0 || sellPrice < 0) {
      return res.status(400).json({ success: false, message: 'Stock and price values cannot be negative.' });
    }

    const newProduct = await Product.create({
      name,
      photo: photo || '',
      type,
      supplierName,
      initialSqft: initSqft,
      initialPricePerSqft: initPrice,
      sellingPricePerSqft: sellPrice,
      totalSqftPurchased: initSqft,
      averagePurchasePricePerSqft: initPrice,
      availableStockSqft: initSqft,
      soldStockSqft: 0
    });

    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update an existing product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, photo, type, supplierName, initialSqft, initialPricePerSqft, sellingPricePerSqft } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const initSqft = Number(initialSqft) || 0;
    const initPrice = Number(initialPricePerSqft) || 0;
    const sellPrice = Number(sellingPricePerSqft) || 0;

    if (initSqft < 0 || initPrice < 0 || sellPrice < 0) {
      return res.status(400).json({ success: false, message: 'Stock and price values cannot be negative.' });
    }

    const oldName = product.name;
    const isNameChanged = name && name !== oldName;

    // Check if new name already exists
    if (isNameChanged) {
      const existingProduct = await Product.findOne({ name });
      if (existingProduct) {
        return res.status(400).json({ success: false, message: 'A product with this name already exists.' });
      }
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(id, {
      name: name || oldName,
      photo: photo !== undefined ? photo : product.photo,
      type: type || product.type,
      supplierName: supplierName || product.supplierName,
      initialSqft: initSqft,
      initialPricePerSqft: initPrice,
      sellingPricePerSqft: sellPrice
    });

    // If name changed, update all related purchases items and sales
    if (isNameChanged) {
      // Update in Purchases
      const purchases = await Purchase.find({});
      for (const p of purchases) {
        let itemsChanged = false;
        const updatedItems = p.items.map(item => {
          if (item.productName === oldName) {
            item.productName = name;
            itemsChanged = true;
          }
          return item;
        });
        if (itemsChanged) {
          await Purchase.findByIdAndUpdate(p._id, { items: updatedItems });
        }
      }

      // Update in Sales
      const sales = await Sale.find({ productName: oldName });
      for (const s of sales) {
        await Sale.findByIdAndUpdate(s._id, { productName: name });
      }
    }

    // Trigger recalculation for both old and new names
    await recalculateProductStockAndAverage(name || oldName);
    if (isNameChanged) {
      await recalculateProductStockAndAverage(oldName);
    }

    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Business rule: Prevent deletion if there are sales or purchases referencing it
    const allSales = await Sale.find({ productName: product.name });
    if (allSales.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product "${product.name}" because it has ${allSales.length} associated sales transaction(s).`
      });
    }

    const allPurchases = await Purchase.find({});
    const hasPurchase = allPurchases.some(p => p.items.some(item => item.productName === product.name));
    if (hasPurchase) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product "${product.name}" because it is referenced in supplier purchase records.`
      });
    }

    await Product.findByIdAndDelete(id);
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
