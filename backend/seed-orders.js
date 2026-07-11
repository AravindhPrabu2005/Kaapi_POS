const { db, pool } = require('./db');
const { users, products, paymentMethods, sessions, orders, orderLines, payments } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toISO(d) {
  return d.toISOString();
}

async function seedOrders() {
  console.log('Seeding orders for today and last 7 days...\n');

  const allUsers = await db.select().from(users);
  const allProducts = await db.select().from(products);
  const allPaymentMethods = await db.select().from(paymentMethods);

  if (allUsers.length === 0 || allProducts.length === 0) {
    console.log('  ✗ Run seed.js and seed-data.js first to create users/products');
    await pool.end();
    return;
  }

  const admin = allUsers.find((u) => u.role === 'admin') || allUsers[0];
  const cashier = allUsers.find((u) => u.role === 'cashier') || allUsers[0];

  // Create a session if none exists
  let [session] = await db.select().from(sessions).limit(1);
  if (!session) {
    const openedAt = new Date();
    openedAt.setDate(openedAt.getDate() - 7);
    [session] = await db.insert(sessions).values({
      status: 'closed',
      openedBy: admin.id,
      openedAt: toISO(openedAt),
      closedAt: toISO(new Date()),
      closingAmount: '0',
    }).returning();
    console.log('  ✓ Session created');
  }

  const methods = {
    cash: allPaymentMethods.find((m) => m.type === 'cash'),
    card: allPaymentMethods.find((m) => m.type === 'card'),
    upi: allPaymentMethods.find((m) => m.type === 'upi'),
  };

  // 7+ orders — 3 today, 2 yesterday, 2 last week
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const orderSchedule = [
    { label: 'today #1',  date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15),  employee: cashier },
    { label: 'today #2',  date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 30), employee: cashier },
    { label: 'today #3',  date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 45), employee: admin },
    { label: 'yesterday #1', date: new Date(now.getTime() - dayMs),                                employee: cashier },
    { label: 'yesterday #2', date: new Date(now.getTime() - dayMs),                                employee: cashier },
    { label: '3 days ago', date: new Date(now.getTime() - 3 * dayMs),                              employee: admin },
    { label: '5 days ago', date: new Date(now.getTime() - 5 * dayMs),                             employee: cashier },
    { label: 'last week',  date: new Date(now.getTime() - 7 * dayMs),                              employee: admin },
  ];

  // Set specific hours for non-today orders
  orderSchedule[3].date.setHours(10, 30, 0, 0);
  orderSchedule[4].date.setHours(14, 0, 0, 0);
  orderSchedule[5].date.setHours(11, 0, 0, 0);
  orderSchedule[6].date.setHours(19, 0, 0, 0);
  orderSchedule[7].date.setHours(8, 45, 0, 0);

  let count = 0;

  for (const item of orderSchedule) {
    // Pick 2-4 random products
    const lineCount = randomInt(2, 4);
    const chosen = [];
    for (let i = 0; i < lineCount; i++) {
      chosen.push(randomItem(allProducts));
    }

    // Calculate order values
    let subtotal = 0;
    const lines = chosen.map((p) => {
      const qty = randomInt(1, 3);
      const unitPrice = parseFloat(p.price);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      return { product: p, qty, unitPrice, lineTotal };
    });

    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const discount = 0;
    const total = Math.round((subtotal + tax - discount) * 100) / 100;

    const orderNumber = `ORD-${String(1000 + count).padStart(4, '0')}`;

    const [order] = await db.insert(orders).values({
      orderNumber,
      status: 'paid',
      employeeId: item.employee.id,
      sessionId: session.id,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discount: discount.toFixed(2),
      total: total.toFixed(2),
      createdAt: toISO(item.date),
      updatedAt: toISO(item.date),
    }).returning();

    // Create order lines
    for (const l of lines) {
      await db.insert(orderLines).values({
        orderId: order.id,
        productId: l.product.id,
        quantity: l.qty,
        unitPrice: l.unitPrice.toFixed(2),
        lineTotal: l.lineTotal.toFixed(2),
        createdAt: toISO(item.date),
      });
    }

    // Create payment
    const methodType = randomItem(['cash', 'card', 'upi']);
    const method = methods[methodType];
    const amountReceived = methodType === 'cash' ? Math.ceil(total / 100) * 100 : total;

    await db.insert(payments).values({
      orderId: order.id,
      method: methodType,
      amount: total.toFixed(2),
      amountReceived: amountReceived.toFixed(2),
      changeDue: (amountReceived - total).toFixed(2),
      status: 'confirmed',
      confirmedAt: toISO(item.date),
      createdAt: toISO(item.date),
    });

    const productNames = lines.map((l) => `${l.product.name} x${l.qty}`).join(', ');
    console.log(`  ✓ ${item.label.padEnd(15)} #${orderNumber}  ₹${total.toFixed(2)}  (${productNames})`);
    count++;
  }

  console.log(`\nDone! Created ${count} orders with line items and payments.`);
  await pool.end();
}

seedOrders().catch((err) => {
  console.error('Seed failed:', err);
  pool.end().then(() => process.exit(1));
});
