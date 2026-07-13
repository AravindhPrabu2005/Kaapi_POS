const { db, pool } = require('./db');
const bcrypt = require('bcryptjs');
const config = require('./src/config/env');
const { v4: uuidv4 } = require('uuid');
const {
  users, categories, products, paymentMethods, floors, tables,
  coupons, promotions, customers, sessions, orders, orderLines,
  payments, kdsTickets, kdsTicketItems, selfOrderingSettings, receipts,
} = require('./src/db/schema');

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min, max, rand) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randDecimal(min, max, rand) {
  return (rand() * (max - min) + min).toFixed(2);
}

function toISO(d) {
  return d.toISOString();
}

function shiftDate(base, daysBack, hours, minutes) {
  const d = new Date(base);
  d.setDate(d.getDate() - daysBack);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function seedAll() {
  console.log('=== Seeding ALL tables ===\n');

  const rand = rng(42);
  const now = new Date();

  // ─── 1. Users ──────────────────────────────────────────────────
  console.log('[1/17] Users');
  let adminUser, cashierUser;
  const existingAdmin = await db.collection(users.tableName).findOne({ role: 'admin' });
  if (existingAdmin) {
    adminUser = existingAdmin;
    console.log('  ~ Admin exists, reusing');
  } else {
    const hash = await bcrypt.hash('admin123', config.bcryptRounds);
    const nowStr = new Date().toISOString();
    adminUser = {
      id: uuidv4(),
      name: 'Admin', email: 'admin@odoocafe.com', passwordHash: hash, role: 'admin',
      createdAt: nowStr, updatedAt: nowStr,
    };
    await db.collection(users.tableName).insertOne(adminUser);
    console.log('  ✓ Admin created (admin@odoocafe.com / admin123)');
  }
  const existingCashier = await db.collection(users.tableName).findOne({ role: 'cashier' });
  if (existingCashier) {
    cashierUser = existingCashier;
    console.log('  ~ Cashier exists, reusing');
  } else {
    const hash = await bcrypt.hash('cashier123', config.bcryptRounds);
    const nowStr = new Date().toISOString();
    cashierUser = {
      id: uuidv4(),
      name: 'Cashier User', email: 'cashier@odoocafe.com', passwordHash: hash, role: 'cashier',
      createdAt: nowStr, updatedAt: nowStr,
    };
    await db.collection(users.tableName).insertOne(cashierUser);
    console.log('  ✓ Cashier created (cashier@odoocafe.com / cashier123)');
  }

  // ─── 2. Categories ─────────────────────────────────────────────
  console.log('\n[2/17] Categories');
  const catData = [
    { name: 'Coffee', color: '#6F4E37' },
    { name: 'Tea', color: '#8FBC8F' },
    { name: 'Cold Drinks', color: '#4FC3F7' },
    { name: 'Pastries', color: '#D4A574' },
    { name: 'Sandwiches', color: '#E8998D' },
    { name: 'Desserts', color: '#E91E63' },
    { name: 'Snacks', color: '#FF9800' },
  ];
  const catMap = {};
  for (const c of catData) {
    const existing = await db.collection(categories.tableName).findOne({ name: c.name });
    if (existing) {
      catMap[c.name] = existing;
    } else {
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        ...c,
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(categories.tableName).insertOne(ins);
      catMap[c.name] = ins;
    }
  }
  console.log(`  ✓ ${Object.keys(catMap).length} categories ready`);

  // ─── 3. Products ───────────────────────────────────────────────
  console.log('\n[3/17] Products');
  const img = (name) => ({
    "Espresso": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/3f6e1420f14fb4a63eeda8bba45754144497d820.jpg",
    "Americano": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/39722d60347f0385f32ab989553e2bcba44a78d4.jpg",
    "Latte": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/883acd5985411cbfaa369fb2214e0d372568fef7.jpg",
    "Cappuccino": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/fb6d797931c432ff56afd6e4b666d6db308a45fb.jpg",
    "Mocha": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/f80c377f49462c61de0f0ff3767be2b6678c9d48.jpg",
    "Cold Brew": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/d6162417d051b16b052ced6f27e8d469f00f404c.jpg",
    "Flat White": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/7e317ba2dddea795420e4fe01201ecdb7645a28f.jpg",
    "Macchiato": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Macchiato_%287199366530%29.jpg/500px-Macchiato_%287199366530%29.jpg",
    "Masala Chai": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/76614a4d3383d0880f6b5f980a6692a35ce2f815.jpg",
    "Green Tea": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/346f9d393ec184a1759321f7d95b5438dc2f3eec.jpg",
    "Earl Grey": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Frisch_aufgebr%C3%BChter_EarlGrey_Tee.jpg",
    "Lemon Tea": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/a948aef957b45785565ef40f6b1d39a7b377c1de.jpg",
    "Iced Tea": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/d1739ed366cf301ff380733dcc9dfb1b3559f88f.jpg",
    "Fresh Lime Soda": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/3a0439d4a68d1b5f79a1d835044fbfc90237b339.jpg",
    "Orange Juice": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/1f5364bb61fc96430370259ec4a0590af7abc79c.jpg",
    "Watermelon Juice": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/f37c3611229c584d4865200b5dfc8c5a45ab87bd.jpg",
    "Smoothie": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/2c1f23d5aa22540737559f7d026e2ba956b818e3.jpg",
    "Milkshake": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/707f8d743f9aca96b81a2da359a28947bd7d159e.jpg",
    "Croissant": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/4de48b5174daff25c14a8fc1050247f4cc80c149.jpg",
    "Blueberry Muffin": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/6f0613eed0b73d7b828363b64c849d6e59c55de8.jpg",
    "Chocolate Danish": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/1ea7e76b9c81e2125e9909afdb3a231681995abf.jpg",
    "Cinnamon Roll": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/402ae8724d122e9e95c29a179ffbb70a6b508141.jpg",
    "Club Sandwich": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/cb062ed6740804af101da4839bdbdd2f97728ae6.jpg",
    "Grilled Cheese": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/5a006a6b127dd3ec6f8b248f83447d7aaafc4644.jpg",
    "Chicken Wrap": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/a404d7a7eb005fbe80c57998f89419448edac1c2.jpg",
    "Veggie Panini": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/3635d71d2c697caa1b4baddb5d911e106bc0d636.jpg",
    "Tiramisu": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/d12e85cd78af8374d374c1576ad9a6e6b0fbbbd5.jpg",
    "Cheesecake": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/f41519cfbbc02bcea3b3fcabdbb1bd4ddfadda24.jpg",
    "Brownie": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/ab1b7bca278dccaed59606c41fbc30b3b9c9d1a9.jpg",
    "Ice Cream Sundae": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/8377548fe7c01bac700f258a9c61a091538dd463.jpg",
    "French Fries": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/fab338400e1dbc94aaefe585cd73b705e13e8b07.jpg",
    "Nachos": "https://upload.wikimedia.org/wikipedia/commons/8/87/Nachos-cheese.jpg",
    "Onion Rings": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/2a6d2aa8178cde5692ea67012dabd4ee8ba19230.jpg",
    "Garlic Bread": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/66cfdb657a3a6644247b15694a77eecd4607762b.jpg",
  }[name] || null);
  const prodData = [
    { name: 'Espresso', cat: 'Coffee', price: '120.00', kds: true },
    { name: 'Americano', cat: 'Coffee', price: '150.00', kds: true },
    { name: 'Latte', cat: 'Coffee', price: '180.00', kds: true },
    { name: 'Cappuccino', cat: 'Coffee', price: '180.00', kds: true },
    { name: 'Mocha', cat: 'Coffee', price: '200.00', kds: true },
    { name: 'Cold Brew', cat: 'Coffee', price: '200.00', kds: true },
    { name: 'Flat White', cat: 'Coffee', price: '190.00', kds: true },
    { name: 'Macchiato', cat: 'Coffee', price: '170.00', kds: true },
    { name: 'Masala Chai', cat: 'Tea', price: '100.00', kds: true },
    { name: 'Green Tea', cat: 'Tea', price: '120.00', kds: true },
    { name: 'Earl Grey', cat: 'Tea', price: '130.00', kds: true },
    { name: 'Lemon Tea', cat: 'Tea', price: '110.00', kds: true },
    { name: 'Iced Tea', cat: 'Tea', price: '150.00', kds: false },
    { name: 'Fresh Lime Soda', cat: 'Cold Drinks', price: '120.00', kds: false },
    { name: 'Orange Juice', cat: 'Cold Drinks', price: '150.00', kds: false },
    { name: 'Watermelon Juice', cat: 'Cold Drinks', price: '160.00', kds: false },
    { name: 'Smoothie', cat: 'Cold Drinks', price: '200.00', kds: false },
    { name: 'Milkshake', cat: 'Cold Drinks', price: '220.00', kds: false },
    { name: 'Croissant', cat: 'Pastries', price: '150.00', kds: false },
    { name: 'Blueberry Muffin', cat: 'Pastries', price: '160.00', kds: false },
    { name: 'Chocolate Danish', cat: 'Pastries', price: '170.00', kds: false },
    { name: 'Cinnamon Roll', cat: 'Pastries', price: '180.00', kds: false },
    { name: 'Club Sandwich', cat: 'Sandwiches', price: '250.00', kds: true },
    { name: 'Grilled Cheese', cat: 'Sandwiches', price: '220.00', kds: true },
    { name: 'Chicken Wrap', cat: 'Sandwiches', price: '280.00', kds: true },
    { name: 'Veggie Panini', cat: 'Sandwiches', price: '240.00', kds: true },
    { name: 'Tiramisu', cat: 'Desserts', price: '280.00', kds: false },
    { name: 'Cheesecake', cat: 'Desserts', price: '300.00', kds: false },
    { name: 'Brownie', cat: 'Desserts', price: '200.00', kds: false },
    { name: 'Ice Cream Sundae', cat: 'Desserts', price: '250.00', kds: false },
    { name: 'French Fries', cat: 'Snacks', price: '150.00', kds: true },
    { name: 'Nachos', cat: 'Snacks', price: '180.00', kds: false },
    { name: 'Onion Rings', cat: 'Snacks', price: '160.00', kds: true },
    { name: 'Garlic Bread', cat: 'Snacks', price: '140.00', kds: true },
  ].map((p) => ({ ...p, image_url: img(p.name) }));
  const allProducts = [];
  for (const p of prodData) {
    const existing = await db.collection(products.tableName).findOne({ name: p.name });
    if (existing) {
      allProducts.push(existing);
    } else {
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        name: p.name, categoryId: catMap[p.cat].id, price: p.price,
        unitOfMeasure: 'per_piece', taxPercent: '0.00', kdsEnabled: p.kds,
        imageUrl: p.image_url || null,
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(products.tableName).insertOne(ins);
      allProducts.push(ins);
    }
  }
  console.log(`  ✓ ${allProducts.length} products ready`);

  // ─── 4. Payment Methods ────────────────────────────────────────
  console.log('\n[4/17] Payment Methods');
  const pmData = [
    { type: 'cash', label: 'Cash', enabled: true },
    { type: 'card', label: 'Digital / Card', enabled: true },
    { type: 'upi', label: 'UPI QR', enabled: true, upiId: 'cafe@ybl' },
  ];
  const pmMap = {};
  for (const pm of pmData) {
    const existing = await db.collection(paymentMethods.tableName).findOne({ type: pm.type });
    if (existing) {
      pmMap[pm.type] = existing;
    } else {
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        ...pm,
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(paymentMethods.tableName).insertOne(ins);
      pmMap[pm.type] = ins;
    }
  }
  console.log('  ✓ 3 payment methods ready');

  // ─── 5. Floors ─────────────────────────────────────────────────
  console.log('\n[5/17] Floors');
  const floorData = [
    { name: 'Ground Floor' },
    { name: 'First Floor' },
    { name: 'Outdoor Patio' },
  ];
  const floorMap = {};
  for (const f of floorData) {
    const existing = await db.collection(floors.tableName).findOne({ name: f.name });
    if (existing) {
      floorMap[f.name] = existing;
    } else {
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        ...f,
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(floors.tableName).insertOne(ins);
      floorMap[f.name] = ins;
    }
  }
  console.log(`  ✓ ${Object.keys(floorMap).length} floors ready`);

  // ─── 6. Tables ─────────────────────────────────────────────────
  console.log('\n[6/17] Tables');
  const tableDefs = [
    { floor: 'Ground Floor', number: 1, seats: 2 },
    { floor: 'Ground Floor', number: 2, seats: 2 },
    { floor: 'Ground Floor', number: 3, seats: 4 },
    { floor: 'Ground Floor', number: 4, seats: 4 },
    { floor: 'Ground Floor', number: 5, seats: 6 },
    { floor: 'First Floor', number: 6, seats: 2 },
    { floor: 'First Floor', number: 7, seats: 2 },
    { floor: 'First Floor', number: 8, seats: 4 },
    { floor: 'First Floor', number: 9, seats: 4 },
    { floor: 'First Floor', number: 10, seats: 6 },
    { floor: 'Outdoor Patio', number: 11, seats: 2 },
    { floor: 'Outdoor Patio', number: 12, seats: 4 },
  ];
  const allTables = [];
  for (const t of tableDefs) {
    const existing = await db.collection(tables.tableName).findOne({ tableNumber: t.number });
    if (existing) {
      allTables.push(existing);
    } else {
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        floorId: floorMap[t.floor].id, tableNumber: t.number, seats: t.seats,
        qrToken: `table-${t.number}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(tables.tableName).insertOne(ins);
      allTables.push(ins);
    }
  }
  console.log(`  ✓ ${allTables.length} tables ready`);

  // ─── 7. Coupons ────────────────────────────────────────────────
  console.log('\n[7/17] Coupons');
  const couponData = [
    { code: 'WELCOME10', discountType: 'percentage', discountValue: '10.00', maxUses: 100, validFrom: new Date(Date.now() - 365*24*60*60*1000).toISOString(), validUntil: new Date(Date.now() + 365*24*60*60*1000).toISOString() },
    { code: 'FLAT50', discountType: 'fixed_amount', discountValue: '50.00', maxUses: 50, validFrom: new Date(Date.now() - 30*24*60*60*1000).toISOString(), validUntil: new Date(Date.now() + 30*24*60*60*1000).toISOString() },
    { code: 'COFFEE25', discountType: 'percentage', discountValue: '25.00', maxUses: 100, validFrom: new Date(Date.now() - 90*24*60*60*1000).toISOString(), validUntil: new Date(Date.now() + 90*24*60*60*1000).toISOString() },
    { code: 'HAPPYHOUR', discountType: 'percentage', discountValue: '15.00', maxUses: 200, validFrom: new Date(Date.now() - 7*24*60*60*1000).toISOString(), validUntil: new Date(Date.now() + 7*24*60*60*1000).toISOString() },
    { code: 'FREESHIP', discountType: 'fixed_amount', discountValue: '100.00', maxUses: 25, validFrom: new Date(Date.now() - 60*24*60*60*1000).toISOString(), validUntil: new Date(Date.now() + 60*24*60*60*1000).toISOString() },
  ];
  const allCoupons = [];
  for (const c of couponData) {
    const existing = await db.collection(coupons.tableName).findOne({ code: c.code });
    if (existing) {
      allCoupons.push(existing);
    } else {
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        ...c,
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(coupons.tableName).insertOne(ins);
      allCoupons.push(ins);
    }
  }
  console.log(`  ✓ ${allCoupons.length} coupons ready`);

  // ─── 8. Customers ──────────────────────────────────────────────
  console.log('\n[8/17] Customers');
  const custData = [
    { name: 'Ravi Kumar', email: 'ravi@example.com', phone: '9876543210' },
    { name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543211' },
    { name: 'Amit Patel', email: 'amit@example.com', phone: '9876543212' },
    { name: 'Sneha Reddy', email: 'sneha@example.com', phone: '9876543213' },
    { name: 'Vikram Singh', email: 'vikram@example.com', phone: '9876543214' },
    { name: 'Ananya Gupta', email: 'ananya@example.com', phone: '9876543215' },
  ];
  const allCustomers = [];
  for (const c of custData) {
    const existing = await db.collection(customers.tableName).findOne({ email: c.email });
    if (existing) {
      allCustomers.push(existing);
    } else {
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        ...c,
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(customers.tableName).insertOne(ins);
      allCustomers.push(ins);
    }
  }
  console.log(`  ✓ ${allCustomers.length} customers ready`);

  // ─── 9. Self-Ordering Settings ────────────────────────────────
  console.log('\n[9/17] Self-Ordering Settings');
  const existingSettings = await db.collection(selfOrderingSettings.tableName).findOne({});
  if (!existingSettings) {
    const nowStr = new Date().toISOString();
    await db.collection(selfOrderingSettings.tableName).insertOne({
      id: uuidv4(),
      enabled: true, mode: 'online_ordering', backgroundColor: '#FBF3E7',
      createdAt: nowStr, updatedAt: nowStr,
    });
    console.log('  ✓ Created');
  } else {
    console.log('  ~ Already exists');
  }

  // ─── 10. Promotions ───────────────────────────────────────────
  console.log('\n[10/17] Promotions');
  const promoData = [
    { name: 'Buy 2 Coffees, Get 10% Off', scope: 'product', productIdx: [0, 1, 2, 3, 4, 5, 6, 7], minQty: 2, discountType: 'percentage', discountValue: '10.00' },
    { name: 'Combo: Sandwich + Drink ₹50 Off', scope: 'product', productIdx: [22, 23, 24, 25], minQty: 1, discountType: 'fixed_amount', discountValue: '50.00' },
    { name: 'Family Pack: 4+ Items 15% Off', scope: 'order', productIdx: null, minQty: 4, discountType: 'percentage', discountValue: '15.00' },
    { name: 'Weekend Dessert Special ₹30 Off', scope: 'product', productIdx: [26, 27, 28, 29], minQty: 1, discountType: 'fixed_amount', discountValue: '30.00' },
    { name: 'Bulk Order Discount (₹500+)', scope: 'order', productIdx: null, minQty: null, minOrderAmount: '500.00', discountType: 'percentage', discountValue: '20.00' },
  ];
  const allPromotions = [];
  for (const p of promoData) {
    const existing = await db.collection(promotions.tableName).findOne({ name: p.name });
    if (existing) {
      allPromotions.push(existing);
    } else {
      const productId = p.productIdx !== null ? allProducts[pick(p.productIdx, rand)].id : null;
      const nowStr = new Date().toISOString();
      const ins = {
        id: uuidv4(),
        name: p.name, scope: p.scope, productId,
        minQuantity: p.minQty, minOrderAmount: p.minOrderAmount || null,
        discountType: p.discountType, discountValue: p.discountValue,
        validFrom: new Date(Date.now() - 365*24*60*60*1000).toISOString(),
        validUntil: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
        createdAt: nowStr, updatedAt: nowStr,
      };
      await db.collection(promotions.tableName).insertOne(ins);
      allPromotions.push(ins);
    }
  }
  console.log(`  ✓ ${allPromotions.length} promotions ready`);

  // ─── 11. Sessions ─────────────────────────────────────────────
  console.log('\n[11/17] Sessions');
  const sessionData = [
    { label: 'Last Week', daysBack: 7, openedHour: 8, closedHour: 22, status: 'closed' },
    { label: 'Today', daysBack: 0, openedHour: 8, closedHour: null, status: 'open' },
  ];
  const allSessions = [];
  for (const s of sessionData) {
    const openedAt = shiftDate(now, s.daysBack, s.openedHour, 0);
    const label = s.label;
    const dateStr = openedAt.toISOString().split('T')[0];
    const existing = await db.collection(sessions.tableName).findOne({
      openedAt: { $regex: `^${dateStr}` }
    });
    if (existing) {
      allSessions.push(existing);
    } else {
      const nowStr = new Date().toISOString();
      const vals = {
        id: uuidv4(),
        status: s.status, openedBy: adminUser.id, openedAt: toISO(openedAt),
        createdAt: nowStr, updatedAt: nowStr,
      };
      if (s.closedHour !== null) {
        const closedAt = shiftDate(now, s.daysBack, s.closedHour, 0);
        vals.closedAt = toISO(closedAt);
        vals.closingAmount = '0';
      }
      await db.collection(sessions.tableName).insertOne(vals);
      allSessions.push(vals);
    }
  }
  console.log(`  ✓ ${allSessions.length} sessions ready`);

  // ─── 12-17. Orders, Lines, Payments, KDS Tickets, Items, Receipts ─
  console.log('\n[12-17/17] Orders + Lines + Payments + KDS Tickets + Items + Receipts');

  const orderSchedule = [
    { label: 'today #1', date: shiftDate(now, 0, 9, 15), employee: cashierUser, table: allTables[0], customer: allCustomers[0], coupon: null },
    { label: 'today #2', date: shiftDate(now, 0, 12, 30), employee: cashierUser, table: allTables[2], customer: allCustomers[1], coupon: allCoupons[0] },
    { label: 'today #3', date: shiftDate(now, 0, 18, 45), employee: adminUser, table: allTables[5], customer: allCustomers[2], coupon: null },
    { label: 'yesterday #1', date: shiftDate(now, 1, 10, 30), employee: cashierUser, table: allTables[1], customer: null, coupon: allCoupons[1] },
    { label: 'yesterday #2', date: shiftDate(now, 1, 14, 0), employee: cashierUser, table: allTables[3], customer: allCustomers[3], coupon: null },
    { label: '3 days ago', date: shiftDate(now, 3, 11, 0), employee: adminUser, table: allTables[4], customer: allCustomers[4], coupon: allCoupons[2] },
    { label: '5 days ago', date: shiftDate(now, 5, 19, 0), employee: cashierUser, table: allTables[6], customer: null, coupon: null },
    { label: '7 days ago', date: shiftDate(now, 7, 8, 45), employee: adminUser, table: null, customer: allCustomers[5], coupon: allCoupons[3] },
    { label: 'today takeaway', date: shiftDate(now, 0, 13, 0), employee: cashierUser, table: null, customer: allCustomers[0], coupon: null },
    { label: 'yesterday takeaway', date: shiftDate(now, 1, 19, 30), employee: cashierUser, table: null, customer: null, coupon: null },
    { label: 'draft order', date: shiftDate(now, 0, 14, 0), employee: cashierUser, table: allTables[0], customer: null, coupon: null, isDraft: true },
    { label: 'cancelled order', date: shiftDate(now, 0, 11, 0), employee: cashierUser, table: allTables[7], customer: null, coupon: null, isCancelled: true },
  ];

  const sessionForOrders = allSessions.find(s => s.status === 'open') || allSessions[0];
  let orderCount = 0;

  for (const item of orderSchedule) {
    const isTakeaway = item.table === null && !item.isDraft && !item.isCancelled;
    const lineCount = randInt(2, 4, rand);
    const chosen = [];
    for (let i = 0; i < lineCount; i++) {
      chosen.push(pick(allProducts, rand));
    }

    let subtotal = 0;
    const lines = chosen.map((p) => {
      const qty = randInt(1, 3, rand);
      const unitPrice = parseFloat(p.price);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      return { product: p, qty, unitPrice, lineTotal };
    });

    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    let discount = 0;
    let couponId = null;

    if (item.coupon) {
      const c = item.coupon;
      if (c.discountType === 'percentage') {
        discount = Math.round(subtotal * parseFloat(c.discountValue) / 100 * 100) / 100;
      } else {
        discount = Math.min(parseFloat(c.discountValue), subtotal);
      }
      couponId = c.id;
    }

    const total = Math.round((subtotal + tax - discount) * 100) / 100;
    const orderNumber = `ORD-${String(2000 + orderCount).padStart(4, '0')}`;
    const status = item.isDraft ? 'draft' : item.isCancelled ? 'cancelled' : 'paid';

    // Check if order already exists
    const existingOrder = await db.collection(orders.tableName).findOne({ orderNumber });
    if (existingOrder) {
      console.log(`  ~ ${item.label.padEnd(20)} #${orderNumber} already exists`);
      orderCount++;
      continue;
    }

    const orderDate = toISO(item.date);
    const orderVals = {
      id: uuidv4(),
      orderNumber, status,
      tableId: item.table?.id || null,
      customerId: item.customer?.id || null,
      employeeId: item.employee.id,
      sessionId: sessionForOrders.id,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discount: discount.toFixed(2),
      total: total.toFixed(2),
      couponId,
      createdAt: orderDate,
      updatedAt: orderDate,
    };
    if (item.isCancelled) {
      orderVals.cancelledAt = orderDate;
      orderVals.cancelReason = 'Customer requested cancellation';
    }
    await db.collection(orders.tableName).insertOne(orderVals);
    const order = orderVals;

    // Order Lines
    for (const l of lines) {
      await db.collection(orderLines.tableName).insertOne({
        id: uuidv4(),
        orderId: order.id, productId: l.product.id,
        quantity: l.qty, unitPrice: l.unitPrice.toFixed(2),
        lineTotal: l.lineTotal.toFixed(2), createdAt: orderDate,
        updatedAt: orderDate,
      });
    }

    // Payment (skip for draft & cancelled)
    let payment = null;
    if (!item.isDraft && !item.isCancelled) {
      const methodType = pick(['cash', 'card', 'upi'], rand);
      const amountReceived = methodType === 'cash' ? Math.ceil(total / 100) * 100 : total;
      const paymentVals = {
        id: uuidv4(),
        orderId: order.id, method: methodType,
        amount: total.toFixed(2),
        amountReceived: amountReceived.toFixed(2),
        changeDue: (amountReceived - total).toFixed(2),
        status: 'confirmed', confirmedAt: orderDate, createdAt: orderDate,
        updatedAt: orderDate,
      };
      await db.collection(payments.tableName).insertOne(paymentVals);
      payment = paymentVals;
    }

    // KDS Ticket (only for paid orders with kds-enabled products)
    if (!item.isDraft && !item.isCancelled) {
      const kdsLines = lines.filter(l => l.product.kdsEnabled);
      if (kdsLines.length > 0) {
        const ticketVals = {
          id: uuidv4(),
          orderId: order.id,
          ticketNumber: `KDS-${String(100 + orderCount).padStart(3, '0')}`,
          stage: pick(['to_cook', 'cooking', 'completed'], rand),
          sentAt: orderDate, createdAt: orderDate, updatedAt: orderDate,
        };
        await db.collection(kdsTickets.tableName).insertOne(ticketVals);
        const ticket = ticketVals;

        for (const kl of kdsLines) {
          const completed = ticket.stage === 'completed';
          await db.collection(kdsTicketItems.tableName).insertOne({
            id: uuidv4(),
            ticketId: ticket.id, productId: kl.product.id,
            productName: kl.product.name, quantity: kl.qty,
            completed, completedAt: completed ? orderDate : null,
            createdAt: orderDate, updatedAt: orderDate,
          });
        }
      }
    }

    // Receipt (for paid orders with a customer email)
    if (!item.isDraft && !item.isCancelled && item.customer?.email) {
      await db.collection(receipts.tableName).insertOne({
        id: uuidv4(),
        orderId: order.id, email: item.customer.email, sentAt: orderDate,
        createdAt: orderDate, updatedAt: orderDate,
      });
    }

    const detail = [
      item.table ? `T${item.table.tableNumber}` : 'TA',
      item.customer ? item.customer.name.slice(0, 8) : 'Walk-in',
      `₹${total.toFixed(2)}`,
    ].join(' | ');
    console.log(`  ✓ ${item.label.padEnd(20)} #${orderNumber}  ${detail}`);
    orderCount++;
  }

  console.log(`\n✓ Created ${orderCount} orders with lines, payments, KDS tickets & receipts`);
  console.log('\n=== Seeding complete! ===');
  await pool.end();
}

seedAll().catch((err) => {
  console.error('\n✗ Seed failed:', err);
  pool.end().then(() => process.exit(1));
});
