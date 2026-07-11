const { db, pool } = require('./db');
const { orderLines, orders, promotionUsages } = require('./src/db/schema');
const { eq, and, not, isNull } = require('drizzle-orm');

(async () => {
  try {
    const lines = await db.select({
      orderId: orderLines.orderId,
      appliedPromotionId: orderLines.appliedPromotionId,
    }).from(orderLines).where(and(not(isNull(orderLines.appliedPromotionId))));

    const processed = new Set();
    let inserted = 0;

    for (const line of lines) {
      const key = `${line.orderId}-${line.appliedPromotionId}`;
      if (processed.has(key)) continue;
      processed.add(key);

      const [order] = await db.select().from(orders).where(eq(orders.id, line.orderId)).limit(1);
      if (!order || !order.customerId) continue;

      const [existing] = await db.select().from(promotionUsages)
        .where(and(eq(promotionUsages.orderId, line.orderId), eq(promotionUsages.promotionId, line.appliedPromotionId)))
        .limit(1);
      if (existing) continue;

      await db.insert(promotionUsages).values({
        promotionId: line.appliedPromotionId,
        orderId: line.orderId,
        customerId: order.customerId,
      });
      console.log(`✓ order ${line.orderId.slice(0,8)} → promo ${line.appliedPromotionId.slice(0,8)}`);
      inserted++;
    }

    console.log(`\nDone. Inserted ${inserted} promotion usage records.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
