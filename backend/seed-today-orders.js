const { db, pool } = require('./db');
const { users, products, paymentMethods, sessions, orders, orderLines, payments, kdsTickets, kdsTicketItems, tables, customers } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min, max, rand) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function toISO(d) {
  return d.toISOString();
}

async function seedToday() {
  console.log('Seeding 5 orders for today...\n');

  const allUsers = await db.select().from(users);
  const allProducts = await db.select().from(products);
  const allPaymentMethods = await db.select().from(paymentMethods);
  const allTables = await db.select().from(tables);
  const allCustomers = await db.select().from(customers);

  if (!allUsers.length || !allProducts.length) {
    console.log('Run seed-all.js first');
    await pool.end();
    return;
  }

  const cashier = allUsers.find(u => u.role === 'cashier') || allUsers[0];
  const admin = allUsers.find(u => u.role === 'admin') || allUsers[0];

  let [session] = await db.select().from(sessions).where(eq(sessions.status, 'open')).limit(1);
  if (!session) {
    [session] = await db.select().from(sessions).limit(1);
  }

  const rand = () => Math.random();

  const today = new Date();
  const schedule = [
    { label: 'Morning Coffee', hour: 9, min: 15, table: allTables[0], customer: allCustomers[0], method: 'upi' },
    { label: 'Brunch', hour: 11, min: 30, table: allTables[2], customer: allCustomers[1], method: 'card' },
    { label: 'Lunch', hour: 13, min: 0, table: null, customer: allCustomers[2], method: 'cash', isTakeaway: true },
    { label: 'Evening Snack', hour: 16, min: 45, table: allTables[4], customer: null, method: 'upi' },
    { label: 'Dinner', hour: 19, min: 30, table: allTables[6], customer: allCustomers[3], method: 'cash' },
  ];

  let count = 0;
  for (const item of schedule) {
    const orderDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), item.hour, item.min, 0, 0);
    const lineCount = randInt(2, 4, rand);
    const chosen = [];
    for (let i = 0; i < lineCount; i++) {
      chosen.push(pick(allProducts, rand));
    }

    let subtotal = 0;
    const lines = chosen.map(p => {
      const qty = randInt(1, 3, rand);
      const unitPrice = parseFloat(p.price);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      return { product: p, qty, unitPrice, lineTotal };
    });

    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const orderNumber = `ORD-${String(3000 + count).padStart(4, '0')}`;

    const [order] = await db.insert(orders).values({
      orderNumber,
      status: 'paid',
      tableId: item.table?.id || null,
      customerId: item.customer?.id || null,
      employeeId: pick([cashier, admin], rand).id,
      sessionId: session.id,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discount: '0.00',
      total: total.toFixed(2),
      createdAt: toISO(orderDate),
      updatedAt: toISO(orderDate),
    }).returning();

    for (const l of lines) {
      await db.insert(orderLines).values({
        orderId: order.id, productId: l.product.id,
        quantity: l.qty, unitPrice: l.unitPrice.toFixed(2),
        lineTotal: l.lineTotal.toFixed(2), createdAt: toISO(orderDate),
      });
    }

    const methodType = item.method;
    const amountReceived = methodType === 'cash' ? Math.ceil(total / 100) * 100 : total;
    await db.insert(payments).values({
      orderId: order.id, method: methodType,
      amount: total.toFixed(2),
      amountReceived: amountReceived.toFixed(2),
      changeDue: (amountReceived - total).toFixed(2),
      status: 'confirmed', confirmedAt: toISO(orderDate), createdAt: toISO(orderDate),
    });

    const kdsLines = lines.filter(l => l.product.kdsEnabled);
    if (kdsLines.length > 0) {
      const [ticket] = await db.insert(kdsTickets).values({
        orderId: order.id,
        ticketNumber: `KDS-${String(200 + count).padStart(3, '0')}`,
        stage: pick(['to_cook', 'cooking', 'completed'], rand),
        sentAt: toISO(orderDate), createdAt: toISO(orderDate), updatedAt: toISO(orderDate),
      }).returning();

      for (const kl of kdsLines) {
        await db.insert(kdsTicketItems).values({
          ticketId: ticket.id, productId: kl.product.id,
          productName: kl.product.name, quantity: kl.qty,
          completed: ticket.stage === 'completed',
          completedAt: ticket.stage === 'completed' ? toISO(orderDate) : null,
        });
      }
    }

    const tableInfo = item.table ? `T${item.table.tableNumber}` : 'TA';
    const custInfo = item.customer ? item.customer.name.slice(0, 8) : 'Walk-in';
    console.log(`  ✓ ${item.label.padEnd(18)} #${orderNumber}  ${tableInfo} | ${custInfo} | ₹${total.toFixed(2)}`);
    count++;
  }

  console.log(`\nDone! Created ${count} orders for today.`);
  await pool.end();
}

seedToday().catch(err => {
  console.error('Failed:', err);
  pool.end().then(() => process.exit(1));
});
