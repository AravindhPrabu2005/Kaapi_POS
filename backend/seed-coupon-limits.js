const { db, pool } = require('./db');
const { coupons } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

const limits = {
  WELCOME10: 100,
  FLAT50: 50,
  COFFEE25: 100,
  HAPPYHOUR: 200,
  FREESHIP: 25,
};

(async () => {
  try {
    const all = await db.select().from(coupons);
    let updated = 0;
    for (const c of all) {
      const maxUses = limits[c.code] || null;
      await db.update(coupons).set({ maxUses }).where(eq(coupons.id, c.id));
      console.log(`✓ ${c.code} → max_uses: ${maxUses ?? 'unlimited'}`);
      updated++;
    }
    console.log(`\nDone. Updated ${updated} coupons.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
