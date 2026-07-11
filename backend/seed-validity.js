const { db, pool } = require('./db');
const { coupons, promotions } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

(async () => {
  try {
    const farPast = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    let updated = 0;

    const allCoupons = await db.select().from(coupons);
    for (const c of allCoupons) {
      if (!c.validFrom || !c.validUntil) {
        await db.update(coupons).set({ validFrom: farPast, validUntil: farFuture }).where(eq(coupons.id, c.id));
        console.log(`✓ coupon: ${c.code}`);
        updated++;
      }
    }

    const allPromos = await db.select().from(promotions);
    for (const p of allPromos) {
      if (!p.validFrom || !p.validUntil) {
        await db.update(promotions).set({ validFrom: farPast, validUntil: farFuture }).where(eq(promotions.id, p.id));
        console.log(`✓ promotion: ${p.name}`);
        updated++;
      }
    }

    console.log(`\nDone. Backfilled ${updated} records.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
