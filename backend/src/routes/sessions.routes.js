const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { parsePagination } = require('../middleware/pagination');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { sessions, users, orders, payments } = require('../db/schema');

const router = Router();
router.use(authenticate);

router.get('/latest', async (req, res, next) => {
  try {
    const cursor = await db.collection(sessions.tableName).find({});
    const sessionArr = await cursor.sort({ openedAt: -1 }).limit(1).toArray();
    const session = sessionArr[0] || null;
    if (!session) {
      return sendSuccess(res, null);
    }

    let openedByUser = null;
    if (session.openedBy) {
      const u = await db.collection(users.tableName).findOne({ id: session.openedBy });
      if (u) openedByUser = { id: u.id, name: u.name };
    }

    sendSuccess(res, {
      id: session.id, status: session.status,
      opened_at: session.openedAt, closed_at: session.closedAt,
      opened_by: openedByUser, closing_amount: session.closingAmount,
    });
  } catch (err) { next(err); }
});

router.post('/open', async (req, res, next) => {
  try {
    const active = await db.collection(sessions.tableName).findOne({ status: 'open' });
    if (active) {
      return next(new ConflictError('SESSION_ALREADY_OPEN', 'A session is already open. Close it before opening a new one.'));
    }

    const session = {
      id: require('crypto').randomUUID(),
      openedBy: req.user.id,
      status: 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
      closingAmount: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(sessions.tableName).insertOne(session);

    sendSuccess(res, {
      id: session.id, status: 'open',
      opened_at: session.openedAt,
      opened_by: { id: req.user.id, name: req.user.name || 'Unknown' },
    }, null, 201);
  } catch (err) { next(err); }
});

router.get('/active', async (req, res, next) => {
  try {
    const session = await db.collection(sessions.tableName).findOne({ status: 'open' });
    if (!session) return next(new NotFoundError('No active session.'));

    const count = await db.collection(orders.tableName).countDocuments({ sessionId: session.id });
    const activeOrdersCursor = await db.collection(orders.tableName).find({ sessionId: session.id, status: 'paid' });
    const activeOrders = await activeOrdersCursor.toArray();
    const total = activeOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

    sendSuccess(res, {
      id: session.id, status: 'open', opened_at: session.openedAt,
      opened_by: { id: req.user.id, name: req.user.name || 'Unknown' },
      order_count: count, running_total: total.toFixed(2),
    });
  } catch (err) { next(err); }
});

router.post('/:session_id/close', async (req, res, next) => {
  try {
    const session = await db.collection(sessions.tableName).findOne({ id: req.params.session_id });
    if (!session) return next(new NotFoundError('Session not found.'));

    const ordersCursor = await db.collection(orders.tableName).find({ sessionId: session.id, status: 'paid' });
    const sessionOrders = await ordersCursor.toArray();

    let totalRevenue = 0;
    const paymentBreakdown = {};

    for (const order of sessionOrders) {
      totalRevenue += parseFloat(order.total);
      const paymentsCursor = await db.collection(payments.tableName).find({ orderId: order.id });
      const orderPayments = await paymentsCursor.toArray();
      for (const pmt of orderPayments) {
        paymentBreakdown[pmt.method] = (paymentBreakdown[pmt.method] || 0) + parseFloat(pmt.amount);
      }
    }

    const updates = {
      status: 'closed',
      closedAt: new Date().toISOString(),
      closingAmount: totalRevenue.toFixed(2),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(sessions.tableName).updateOne(
      { id: req.params.session_id },
      { $set: updates }
    );
    const updated = await db.collection(sessions.tableName).findOne({ id: req.params.session_id });

    sendSuccess(res, {
      id: updated.id, status: 'closed',
      opened_at: updated.openedAt, closed_at: updated.closedAt,
      closing_summary: {
        total_orders: sessionOrders.length,
        total_revenue: totalRevenue.toFixed(2),
        payment_breakdown: Object.entries(paymentBreakdown).map(([method, amount]) => ({ method, amount: amount.toFixed(2) })),
      },
    });
  } catch (err) { next(err); }
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const filter = {};
    if (from || to) {
      filter.openedAt = {};
      if (from) filter.openedAt.$gte = from;
      if (to) filter.openedAt.$lte = to;
    }

    const count = await db.collection(sessions.tableName).countDocuments(filter);
    const cursor = await db.collection(sessions.tableName).find(filter);
    const data = await cursor.sort({ openedAt: -1 }).skip(offset).limit(pageSize).toArray();

    const result = await Promise.all(data.map(async (s) => {
      let openedByUser = null;
      if (s.openedBy) {
        const u = await db.collection(users.tableName).findOne({ id: s.openedBy });
        if (u) openedByUser = { id: u.id, name: u.name };
      }
      return {
        id: s.id, status: s.status, opened_at: s.openedAt, closed_at: s.closedAt,
        opened_by: openedByUser, closing_amount: s.closingAmount,
      };
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: count });
  } catch (err) { next(err); }
});

module.exports = router;
