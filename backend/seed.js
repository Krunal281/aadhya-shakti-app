const { connectDB, Supplier, Product, Purchase, Sale, SupplierPayment, PaymentLedger, UndoHistory } = require('./config/db');
const { recalculateProductStockAndAverage, recalculateSupplierTotals } = require('./services/recalculator');

const seedData = async () => {
  try {
    console.log('🔄 Seeding database...');

    // Connect to database
    await connectDB();

    // Clear existing data
    await Supplier.deleteMany({});
    await Product.deleteMany({});
    await Purchase.deleteMany({});
    await Sale.deleteMany({});
    await SupplierPayment.deleteMany({});
    await PaymentLedger.deleteMany({});
    await UndoHistory.deleteMany({});

    console.log('🗑️  Cleared existing collections.');

    // 1. Create Suppliers
    const suppliers = [
      { name: 'Ambaji Stone Corp', phone: '9876543210', address: 'Ambaji Industrial Area, Gujarat', notes: 'Main supplier for white marble blocks.' },
      { name: 'Rajasthan Granite Hub', phone: '8765432109', address: 'Kishangarh Bypass, Rajasthan', notes: 'Best rates for Desert Gold and Black Granite.' },
      { name: 'Makrana Heritage Marbles', phone: '7654321098', address: 'Makrana Marble Market, Rajasthan', notes: 'Premium albeta and kumari marble.' }
    ];

    for (const s of suppliers) {
      await Supplier.create(s);
    }
    console.log('✅ Suppliers seeded.');

    // 2. Create Products
    const products = [
      {
        name: 'Ambaji Premium White Marble',
        type: 'Marble',
        supplierName: 'Ambaji Stone Corp',
        initialSqft: 1000,
        initialPricePerSqft: 45,
        sellingPricePerSqft: 75,
        photo: ''
      },
      {
        name: 'Desert Gold Granite',
        type: 'Granite',
        supplierName: 'Rajasthan Granite Hub',
        initialSqft: 1500,
        initialPricePerSqft: 60,
        sellingPricePerSqft: 95,
        photo: ''
      },
      {
        name: 'Makrana Albeta Marble',
        type: 'Marble',
        supplierName: 'Makrana Heritage Marbles',
        initialSqft: 500,
        initialPricePerSqft: 160,
        sellingPricePerSqft: 250,
        photo: ''
      }
    ];

    for (const p of products) {
      await Product.create({
        ...p,
        totalSqftPurchased: p.initialSqft,
        averagePurchasePricePerSqft: p.initialPricePerSqft,
        availableStockSqft: p.initialSqft,
        soldStockSqft: 0
      });
    }
    console.log('✅ Products seeded.');

    // 3. Create Purchases (Gadi entries)
    // Purchase 1: RJ-27-GB-1122 with Ambaji Premium White
    const p1 = await Purchase.create({
      supplierName: 'Ambaji Stone Corp',
      date: new Date('2026-05-10'),
      gadiNumber: 'RJ-27-GB-1122',
      items: [
        { productName: 'Ambaji Premium White Marble', sqft: 1200, pricePerSqft: 40, totalAmount: 48000 }
      ],
      totalBillAmount: 48000,
      paymentMode: 'Both',
      cashPaidAmount: 15000,
      upiPaidAmount: 15000,
      cashPendingAmount: 10000,
      upiPendingAmount: 8000,
      dueDate: new Date('2026-06-15'),
      paymentStatus: 'Partial',
      notes: 'Delivered in good condition.'
    });

    // Purchase 2: RJ-14-GG-5566 with Desert Gold Granite & Makrana Albeta
    const p2 = await Purchase.create({
      supplierName: 'Rajasthan Granite Hub',
      date: new Date('2026-05-14'),
      gadiNumber: 'RJ-14-GG-5566',
      items: [
        { productName: 'Desert Gold Granite', sqft: 1000, pricePerSqft: 55, totalAmount: 55000 }
      ],
      totalBillAmount: 55000,
      paymentMode: 'UPI',
      cashPaidAmount: 0,
      upiPaidAmount: 55000,
      cashPendingAmount: 0,
      upiPendingAmount: 0,
      paymentStatus: 'Clear',
      notes: 'Instant clearing via UPI.'
    });

    console.log('✅ Purchases seeded.');

    // 4. Create Sales
    const s1 = await Sale.create({
      clientName: 'Aarav Homes & Builders',
      date: new Date('2026-05-18'),
      productName: 'Ambaji Premium White Marble',
      sqftSold: 800,
      sellingPricePerSqft: 75,
      sellingAmount: 60000,
      costAmount: 800 * 45, // will recalculate
      profitLoss: 60000 - (800 * 45), // will recalculate
      paymentType: 'Cash',
      cashAmount: 45000,
      upiAmount: 0,
      pendingAmount: 15000,
      notes: 'Pending cash payment on delivery completion.'
    });

    const s2 = await Sale.create({
      clientName: 'Dinesh Sharma Villa',
      date: new Date('2026-05-20'),
      productName: 'Desert Gold Granite',
      sqftSold: 600,
      sellingPricePerSqft: 95,
      sellingAmount: 57000,
      costAmount: 600 * 60, // will recalculate
      profitLoss: 57000 - (600 * 60), // will recalculate
      paymentType: 'Both',
      cashAmount: 20000,
      upiAmount: 37000,
      pendingAmount: 0,
      notes: 'Paid fully in front.'
    });

    console.log('✅ Sales seeded.');

    // Run recalculators for all entities to ensure proper math
    const productNames = ['Ambaji Premium White Marble', 'Desert Gold Granite', 'Makrana Albeta Marble'];
    for (const name of productNames) {
      await recalculateProductStockAndAverage(name);
    }
    console.log('🔄 Product stock recalculations completed.');

    const supplierNames = ['Ambaji Stone Corp', 'Rajasthan Granite Hub', 'Makrana Heritage Marbles'];
    for (const name of supplierNames) {
      await recalculateSupplierTotals(name);
    }
    console.log('🔄 Supplier total recalculations completed.');

    console.log('🎉 Seeding successfully completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    process.exit(1);
  }
};

seedData();
