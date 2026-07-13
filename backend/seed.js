const { db, pool } = require('./db');
const bcrypt = require('bcryptjs');
const config = require('./src/config/env');
const { v4: uuidv4 } = require('uuid');
const { selfOrderingSettings, paymentMethods, users } = require('./src/db/schema');

async function seed() {
  console.log('Seeding database...');

  // 1. Self-Ordering Settings
  const existingSettings = await db.collection(selfOrderingSettings.tableName).findOne({});
  if (!existingSettings) {
    await db.collection(selfOrderingSettings.tableName).insertOne({
      id: 1,
      enabled: true,
      mode: 'online_ordering',
      backgroundColor: '#FBF3E7',
      updatedAt: new Date().toISOString(),
    });
    console.log('  ✓ Self-ordering settings created');
  }

  // 2. Payment Methods
  const existingMethods = await db.collection(paymentMethods.tableName).find({}).toArray();
  if (existingMethods.length === 0) {
    await db.collection(paymentMethods.tableName).insertMany([
      { id: uuidv4(), type: 'cash', label: 'Cash', enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), type: 'card', label: 'Digital / Card', enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), type: 'upi', label: 'UPI QR', enabled: true, upiId: 'cafe@ybl', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
    console.log('  ✓ Payment methods created (cash, card, upi)');
  }

  // 3. Default admin user (if none exists)
  const existingAdmin = await db.collection(users.tableName).findOne({ role: 'admin' });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', config.bcryptRounds);
    await db.collection(users.tableName).insertOne({
      id: uuidv4(),
      name: 'Admin',
      email: 'admin@odoocafe.com',
      passwordHash,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('  ✓ Default admin created (admin@odoocafe.com / admin123)');
  }

  // 4. Default cashier user (if none exists)
  const existingCashier = await db.collection(users.tableName).findOne({ role: 'cashier' });
  if (!existingCashier) {
    const passwordHash = await bcrypt.hash('cashier123', config.bcryptRounds);
    await db.collection(users.tableName).insertOne({
      id: uuidv4(),
      name: 'Cashier User',
      email: 'cashier@odoocafe.com',
      passwordHash,
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('  ✓ Default cashier created (cashier@odoocafe.com / cashier123)');
  }

  console.log('Seeding complete!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  pool.end().then(() => process.exit(1));
});
