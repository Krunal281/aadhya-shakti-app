const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Path for local JSON database storage
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let isMongo = false;

// Attempt to connect to MongoDB if URI is provided
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('⚠️  No MONGODB_URI found in environment. Falling back to local JSON database.');
    return false;
  }
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000 // 3 seconds timeout
    });
    console.log('🔌 Connected to MongoDB successfully.');
    isMongo = true;
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Falling back to local JSON database.');
    isMongo = false;
    return false;
  }
};

// ----------------------------------------------------
// Custom Local JSON Database Layer
// ----------------------------------------------------
class JsonCollection {
  constructor(collectionName) {
    this.filePath = path.join(DATA_DIR, `${collectionName}.json`);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  _read() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  _write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  async find(filter = {}) {
    let items = this._read();
    return items.filter(item => {
      for (let key in filter) {
        if (filter[key] !== undefined && item[key] !== filter[key]) {
          return false;
        }
      }
      return true;
    });
  }

  async findOne(filter = {}) {
    const items = await this.find(filter);
    return items.length > 0 ? items[0] : null;
  }

  async findById(id) {
    const items = this._read();
    return items.find(item => item._id === id || item.id === id) || null;
  }

  async create(data) {
    const items = this._read();
    const newDoc = {
      _id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    items.push(newDoc);
    this._write(items);
    return newDoc;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const items = this._read();
    const index = items.findIndex(item => item._id === id || item.id === id);
    if (index === -1) return null;

    const existing = items[index];
    // Handle mongoose-style update (flat merge or custom fields)
    const updatedDoc = {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString()
    };
    items[index] = updatedDoc;
    this._write(items);
    return updatedDoc;
  }

  async findByIdAndDelete(id) {
    const items = this._read();
    const index = items.findIndex(item => item._id === id || item.id === id);
    if (index === -1) return null;

    const deleted = items.splice(index, 1)[0];
    this._write(items);
    return deleted;
  }

  async deleteMany(filter = {}) {
    let items = this._read();
    const initialCount = items.length;
    items = items.filter(item => {
      for (let key in filter) {
        if (item[key] === filter[key]) {
          return false; // Remove if matched
        }
      }
      return true;
    });
    this._write(items);
    return { deletedCount: initialCount - items.length };
  }
}

// ----------------------------------------------------
// Unified DB Models Wrapper
// ----------------------------------------------------
const models = {};

// We define Mongoose models
const SupplierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  phone: String,
  address: String,
  notes: String,
  totalPurchaseAmount: { type: Number, default: 0 },
  totalPaidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  remainingCashAmount: { type: Number, default: 0 },
  remainingUpiAmount: { type: Number, default: 0 }
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  photo: String, // base64 string
  type: { type: String, required: true }, // 'Marble' | 'Granite'
  supplierName: { type: String, required: true },
  initialSqft: { type: Number, default: 0 },
  initialPricePerSqft: { type: Number, default: 0 },
  sellingPricePerSqft: { type: Number, default: 0 },
  totalSqftPurchased: { type: Number, default: 0 },
  averagePurchasePricePerSqft: { type: Number, default: 0 },
  availableStockSqft: { type: Number, default: 0 },
  soldStockSqft: { type: Number, default: 0 }
}, { timestamps: true });

const PurchaseSchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  date: { type: Date, required: true },
  gadiNumber: String,
  items: [{
    productName: { type: String, required: true },
    sqft: { type: Number, required: true },
    pricePerSqft: { type: Number, required: true },
    totalAmount: { type: Number, required: true }
  }],
  totalBillAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['Pending', 'Partial', 'Clear'], default: 'Pending' },
  paymentMode: { type: String, enum: ['Cash', 'UPI', 'Both'], default: 'Cash' },
  cashPaidAmount: { type: Number, default: 0 },
  upiPaidAmount: { type: Number, default: 0 },
  cashPendingAmount: { type: Number, default: 0 },
  upiPendingAmount: { type: Number, default: 0 },
  dueDate: Date,
  notes: String
}, { timestamps: true });

const SupplierPaymentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  supplierName: { type: String, required: true },
  purchaseId: { type: String, required: true },
  cashAmountPaid: { type: Number, default: 0 },
  upiAmountPaid: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  remainingCash: { type: Number, default: 0 },
  remainingUpi: { type: Number, default: 0 },
  notes: String
}, { timestamps: true });

const SaleSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  date: { type: Date, required: true },
  productName: { type: String, required: true },
  sqftSold: { type: Number, required: true },
  sellingPricePerSqft: { type: Number, required: true },
  sellingAmount: { type: Number, required: true },
  costAmount: { type: Number, required: true },
  profitLoss: { type: Number, required: true },
  paymentType: { type: String, enum: ['Cash', 'UPI', 'Both'], default: 'Cash' },
  cashAmount: { type: Number, default: 0 },
  upiAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  notes: String
}, { timestamps: true });

const PaymentLedgerSchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  date: { type: Date, required: true },
  entryType: { type: String, enum: ['Purchase', 'Payment'], required: true },
  refId: { type: String, required: true },
  description: String,
  cashPaid: { type: Number, default: 0 },
  upiPaid: { type: Number, default: 0 },
  cashPending: { type: Number, default: 0 },
  upiPending: { type: Number, default: 0 },
  totalRemaining: { type: Number, default: 0 },
  status: String
}, { timestamps: true });

const UndoHistorySchema = new mongoose.Schema({
  actionType: { type: String, required: true }, // 'PAYMENT_CLEAR' | 'PURCHASE_ADD' | etc.
  targetCollection: { type: String, required: true },
  targetId: { type: String, required: true },
  previousState: mongoose.Schema.Types.Mixed,
  description: String
}, { timestamps: true });

// Declare Mongoose Models
let MongoSupplier, MongoProduct, MongoPurchase, MongoSupplierPayment, MongoSale, MongoPaymentLedger, MongoUndoHistory;

try {
  MongoSupplier = mongoose.model('Supplier', SupplierSchema);
  MongoProduct = mongoose.model('Product', ProductSchema);
  MongoPurchase = mongoose.model('Purchase', PurchaseSchema);
  MongoSupplierPayment = mongoose.model('SupplierPayment', SupplierPaymentSchema);
  MongoSale = mongoose.model('Sale', SaleSchema);
  MongoPaymentLedger = mongoose.model('PaymentLedger', PaymentLedgerSchema);
  MongoUndoHistory = mongoose.model('UndoHistory', UndoHistorySchema);
} catch (e) {
  // Model compiling error safety
}

// JSON Collection Instances
const jsonSupplier = new JsonCollection('suppliers');
const jsonProduct = new JsonCollection('products');
const jsonPurchase = new JsonCollection('purchases');
const jsonSupplierPayment = new JsonCollection('supplier_payments');
const jsonSale = new JsonCollection('sales');
const jsonPaymentLedger = new JsonCollection('payment_ledgers');
const jsonUndoHistory = new JsonCollection('undo_history');

// Model Proxy Helper
const getModel = (mongoModel, jsonInstance) => {
  return {
    find: async (filter) => {
      if (isMongo) return mongoModel.find(filter);
      return jsonInstance.find(filter);
    },
    findOne: async (filter) => {
      if (isMongo) return mongoModel.findOne(filter);
      return jsonInstance.findOne(filter);
    },
    findById: async (id) => {
      if (isMongo) return mongoModel.findById(id);
      return jsonInstance.findById(id);
    },
    create: async (data) => {
      if (isMongo) {
        const doc = new mongoModel(data);
        return doc.save();
      }
      return jsonInstance.create(data);
    },
    findByIdAndUpdate: async (id, update, options = {}) => {
      if (isMongo) return mongoModel.findByIdAndUpdate(id, update, { new: true, ...options });
      return jsonInstance.findByIdAndUpdate(id, update, options);
    },
    findByIdAndDelete: async (id) => {
      if (isMongo) return mongoModel.findByIdAndDelete(id);
      return jsonInstance.findByIdAndDelete(id);
    },
    deleteMany: async (filter) => {
      if (isMongo) return mongoModel.deleteMany(filter);
      return jsonInstance.deleteMany(filter);
    }
  };
};

module.exports = {
  connectDB,
  getIsMongo: () => isMongo,
  Supplier: getModel(MongoSupplier, jsonSupplier),
  Product: getModel(MongoProduct, jsonProduct),
  Purchase: getModel(MongoPurchase, jsonPurchase),
  SupplierPayment: getModel(MongoSupplierPayment, jsonSupplierPayment),
  Sale: getModel(MongoSale, jsonSale),
  PaymentLedger: getModel(MongoPaymentLedger, jsonPaymentLedger),
  UndoHistory: getModel(MongoUndoHistory, jsonUndoHistory)
};
