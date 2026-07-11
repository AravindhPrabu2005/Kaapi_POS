const { db, pool } = require('./db');
const bcrypt = require('bcryptjs');
const config = require('./src/config/env');

async function seed() {
  console.log('Seeding database...');

  // 1. Self-Ordering Settings
  const [existingSettings] = await db.select().from(require('./src/db/schema').selfOrderingSettings).limit(1);
  if (!existingSettings) {
    await db.insert(require('./src/db/schema').selfOrderingSettings).values({
      enabled: true, mode: 'online_ordering', backgroundColor: '#FBF3E7',
    });
    console.log('  ✓ Self-ordering settings created');
  }

  // 2. Payment Methods
  const existingMethods = await db.select().from(require('./src/db/schema').paymentMethods);
  if (existingMethods.length === 0) {
    await db.insert(require('./src/db/schema').paymentMethods).values([
      { type: 'cash', label: 'Cash', enabled: true },
      { type: 'card', label: 'Digital / Card', enabled: true },
      { type: 'upi', label: 'UPI QR', enabled: true, upiId: 'cafe@ybl' },
    ]);
    console.log('  ✓ Payment methods created (cash, card, upi)');
  }

  // 3. Default admin user (if none exists)
  const [existingAdmin] = await db.select().from(require('./src/db/schema').users).where(require('drizzle-orm').eq(require('./src/db/schema').users.role, 'admin')).limit(1);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', config.bcryptRounds);
    await db.insert(require('./src/db/schema').users).values({
      name: 'Admin', email: 'admin@odoocafe.com', passwordHash, role: 'admin',
    });
    console.log('  ✓ Default admin created (admin@odoocafe.com / admin123)');
  }

  // 4. Default cashier user (if none exists)
  const [existingCashier] = await db.select().from(require('./src/db/schema').users).where(require('drizzle-orm').eq(require('./src/db/schema').users.role, 'cashier')).limit(1);
  if (!existingCashier) {
    const passwordHash = await bcrypt.hash('cashier123', config.bcryptRounds);
    await db.insert(require('./src/db/schema').users).values({
      name: 'Cashier User', email: 'cashier@odoocafe.com', passwordHash, role: 'cashier',
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
