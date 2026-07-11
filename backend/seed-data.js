const { db, pool } = require('./db');
const { categories, products } = require('./src/db/schema');

async function seedData() {
  console.log('Seeding categories and products...\n');

  // ─── Categories ────────────────────────────────────────────
  const categoryData = [
    { name: 'Coffee',       color: '#6F4E37' },
    { name: 'Tea',          color: '#8FBC8F' },
    { name: 'Cold Drinks',  color: '#4FC3F7' },
    { name: 'Pastries',     color: '#D4A574' },
    { name: 'Sandwiches',   color: '#E8998D' },
    { name: 'Desserts',     color: '#E91E63' },
    { name: 'Snacks',       color: '#FF9800' },
  ];

  const insertedCats = {};
  for (const c of categoryData) {
    const [existing] = await db.select().from(categories).where(require('drizzle-orm').eq(categories.name, c.name)).limit(1);
    if (existing) {
      console.log(`  ✓ Category "${c.name}" already exists`);
      insertedCats[c.name] = existing;
      continue;
    }
    const [cat] = await db.insert(categories).values(c).returning();
    insertedCats[c.name] = cat;
    console.log(`  ✓ Category "${c.name}" created`);
  }

  // ─── Products ──────────────────────────────────────────────
  const productData = [
    { name: 'Espresso',       category: 'Coffee',     price: '120.00', kds: true },
    { name: 'Americano',      category: 'Coffee',     price: '150.00', kds: true },
    { name: 'Latte',          category: 'Coffee',     price: '180.00', kds: true },
    { name: 'Cappuccino',     category: 'Coffee',     price: '180.00', kds: true },
    { name: 'Mocha',          category: 'Coffee',     price: '200.00', kds: true },
    { name: 'Cold Brew',      category: 'Coffee',     price: '200.00', kds: true },
    { name: 'Flat White',     category: 'Coffee',     price: '190.00', kds: true },
    { name: 'Macchiato',      category: 'Coffee',     price: '170.00', kds: true },

    { name: 'Masala Chai',    category: 'Tea',        price: '100.00', kds: true },
    { name: 'Green Tea',      category: 'Tea',        price: '120.00', kds: true },
    { name: 'Earl Grey',      category: 'Tea',        price: '130.00', kds: true },
    { name: 'Lemon Tea',      category: 'Tea',        price: '110.00', kds: true },
    { name: 'Iced Tea',       category: 'Tea',        price: '150.00', kds: false },

    { name: 'Fresh Lime Soda',   category: 'Cold Drinks', price: '120.00', kds: false },
    { name: 'Orange Juice',      category: 'Cold Drinks', price: '150.00', kds: false },
    { name: 'Watermelon Juice',  category: 'Cold Drinks', price: '160.00', kds: false },
    { name: 'Smoothie',          category: 'Cold Drinks', price: '200.00', kds: false },
    { name: 'Milkshake',         category: 'Cold Drinks', price: '220.00', kds: false },

    { name: 'Croissant',        category: 'Pastries',   price: '150.00', kds: false },
    { name: 'Blueberry Muffin', category: 'Pastries',   price: '160.00', kds: false },
    { name: 'Chocolate Danish', category: 'Pastries',   price: '170.00', kds: false },
    { name: 'Cinnamon Roll',    category: 'Pastries',   price: '180.00', kds: false },

    { name: 'Club Sandwich', category: 'Sandwiches', price: '250.00', kds: true },
    { name: 'Grilled Cheese', category: 'Sandwiches', price: '220.00', kds: true },
    { name: 'Chicken Wrap',  category: 'Sandwiches', price: '280.00', kds: true },
    { name: 'Veggie Panini', category: 'Sandwiches', price: '240.00', kds: true },

    { name: 'Tiramisu',       category: 'Desserts', price: '280.00', kds: false },
    { name: 'Cheesecake',     category: 'Desserts', price: '300.00', kds: false },
    { name: 'Brownie',         category: 'Desserts', price: '200.00', kds: false },
    { name: 'Ice Cream Sundae', category: 'Desserts', price: '250.00', kds: false },

    { name: 'French Fries',  category: 'Snacks', price: '150.00', kds: true },
    { name: 'Nachos',        category: 'Snacks', price: '180.00', kds: false },
    { name: 'Onion Rings',   category: 'Snacks', price: '160.00', kds: true },
    { name: 'Garlic Bread',  category: 'Snacks', price: '140.00', kds: true },
  ];

  let created = 0;
  for (const p of productData) {
    const [existing] = await db.select().from(products)
      .where(require('drizzle-orm').eq(products.name, p.name))
      .limit(1);
    if (existing) {
      console.log(`  ~ Product "${p.name}" already exists, skipping`);
      continue;
    }

    const cat = insertedCats[p.category];
    await db.insert(products).values({
      name: p.name,
      categoryId: cat.id,
      price: p.price,
      unitOfMeasure: 'per_piece',
      taxPercent: '0.00',
      kdsEnabled: p.kds,
    });
    created++;
  }

  console.log(`\nDone! Created ${created} new product(s).`);
  await pool.end();
}

seedData().catch((err) => {
  console.error('Seed failed:', err);
  pool.end().then(() => process.exit(1));
});
