const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { parsePagination } = require('../middleware/pagination');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { sessions, users, orders, payments } = require('../db/schema');
const { eq, and, desc, sql } = require('drizzle-orm');

const router = Router();
router.use(authenticate);

router.get('/latest', async (req, res, next) => {
  try {
    const [session] = await db.select().from(sessions).orderBy(desc(sessions.openedAt)).limit(1);
    if (!session) {
      return sendSuccess(res, null);
    }

    let openedByUser = null;
    if (session.openedBy) {
      const [u] = await db.select().from(users).where(eq(users.id, session.openedBy)).limit(1);
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
    const [active] = await db.select().from(sessions).where(eq(sessions.status, 'open')).limit(1);
    if (active) {
      return next(new ConflictError('SESSION_ALREADY_OPEN', 'A session is already open. Close it before opening a new one.'));
    }

    const [session] = await db.insert(sessions).values({
      openedBy: req.user.id,
      status: 'open',
    }).returning();

    sendSuccess(res, {
      id: session.id, status: 'open',
      opened_at: session.openedAt,
      opened_by: { id: req.user.id, name: req.user.name || 'Unknown' },
    }, null, 201);
  } catch (err) { next(err); }
});

router.get('/active', async (req, res, next) => {
  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.status, 'open')).limit(1);
    if (!session) return next(new NotFoundError('No active session.'));

    const [{ count }] = await db.select({ count: sql`count(*)` }).from(orders).where(eq(orders.sessionId, session.id));
    const [{ total }] = await db.select({ total: sql`COALESCE(SUM(CAST(total AS numeric)), 0)` }).from(orders).where(and(eq(orders.sessionId, session.id), eq(orders.status, 'paid')));

    sendSuccess(res, {
      id: session.id, status: 'open', opened_at: session.openedAt,
      opened_by: { id: req.user.id, name: req.user.name || 'Unknown' },
      order_count: parseInt(count, 10), running_total: parseFloat(total).toFixed(2),
    });
  } catch (err) { next(err); }
});

router.post('/:session_id/close', async (req, res, next) => {
  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, req.params.session_id)).limit(1);
    if (!session) return next(new NotFoundError('Session not found.'));

    const sessionOrders = await db.select().from(orders).where(and(eq(orders.sessionId, session.id), eq(orders.status, 'paid')));

    let totalRevenue = 0;
    const paymentBreakdown = {};

    for (const order of sessionOrders) {
      totalRevenue += parseFloat(order.total);
      const orderPayments = await db.select().from(payments).where(eq(payments.orderId, order.id));
      for (const pmt of orderPayments) {
        paymentBreakdown[pmt.method] = (paymentBreakdown[pmt.method] || 0) + parseFloat(pmt.amount);
      }
    }

    const [updated] = await db.update(sessions).set({
      status: 'closed',
      closedAt: new Date().toISOString(),
      closingAmount: totalRevenue.toFixed(2),
    }).where(eq(sessions.id, req.params.session_id)).returning();

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

    const conditions = [];
    if (from) conditions.push(sql`${sessions.openedAt} >= ${from}::timestamp`);
    if (to) conditions.push(sql`${sessions.openedAt} <= ${to}::timestamp`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(sessions).where(where).limit(pageSize).offset(offset).orderBy(desc(sessions.openedAt)),
      db.select({ count: sql`count(*)` }).from(sessions).where(where),
    ]);

    const result = await Promise.all(data.map(async (s) => {
      let openedByUser = null;
      if (s.openedBy) {
        const [u] = await db.select().from(users).where(eq(users.id, s.openedBy)).limit(1);
        if (u) openedByUser = { id: u.id, name: u.name };
      }
      return {
        id: s.id, status: s.status, opened_at: s.openedAt, closed_at: s.closedAt,
        opened_by: openedByUser, closing_amount: s.closingAmount,
      };
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: parseInt(count, 10) });
  } catch (err) { next(err); }
});

module.exports = router;
