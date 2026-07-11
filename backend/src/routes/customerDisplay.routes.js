const { Router } = require('express');
const { sendSuccess } = require('../utils/response');
const { db } = require('../db');
const { orders, orderLines, products, payments } = require('../db/schema');
const { eq, desc } = require('drizzle-orm');

const router = Router();

router.get('/state', async (req, res, next) => {
  try {
    const { table_id } = req.query;
    if (!table_id) {
      return sendSuccess(res, { view: 'idle', message: 'No table selected.' });
    }

    const [order] = await db.select().from(orders).where(eq(orders.tableId, table_id)).orderBy(desc(orders.createdAt)).limit(1);
    if (!order) {
      return sendSuccess(res, { view: 'idle', message: 'No active order.' });
    }

    if (order.status === 'paid') {
      return sendSuccess(res, { view: 'completed', message: 'Thank you for shopping with us. See you again!' });
    }

    if (order.status === 'draft') {
      const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
      const lineData = await Promise.all(lines.map(async (l) => {
        let name = 'Unknown';
        const [p] = await db.select().from(products).where(eq(products.id, l.productId)).limit(1);
        if (p) name = p.name;
        return { product_name: name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal };
      }));

      return sendSuccess(res, {
        view: 'order',
        order: {
          order_number: order.orderNumber,
          lines: lineData,
          subtotal: order.subtotal, tax: order.tax, discount: order.discount, total: order.total,
        },
      });
    }

    sendSuccess(res, { view: 'idle', message: 'No active order.' });
  } catch (err) { next(err); }
});

module.exports = router;
