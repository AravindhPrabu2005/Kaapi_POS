const { Router } = require('express');
const { sendSuccess } = require('../utils/response');
const { db } = require('../db');
const { orders, orderLines, products, payments } = require('../db/schema');

const router = Router();

router.get('/state', async (req, res, next) => {
  try {
    const { table_id } = req.query;
    if (!table_id) {
      return sendSuccess(res, { view: 'idle', message: 'No table selected.' });
    }

    const orderCursor = await db.collection(orders.tableName).find({ tableId: table_id });
    const ordersList = await orderCursor.sort({ createdAt: -1 }).limit(1).toArray();
    const order = ordersList[0];
    if (!order) {
      return sendSuccess(res, { view: 'idle', message: 'No active order.' });
    }

    if (order.status === 'paid') {
      return sendSuccess(res, { view: 'completed', message: 'Thank you for shopping with us. See you again!' });
    }

    if (order.status === 'draft') {
      const linesCursor = await db.collection(orderLines.tableName).find({ orderId: order.id });
      const lines = await linesCursor.toArray();
      const lineData = await Promise.all(lines.map(async (l) => {
        let name = 'Unknown';
        const p = await db.collection(products.tableName).findOne({ id: l.productId });
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
