const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { kdsTickets, kdsTicketItems, orders, tables, products } = require('../db/schema');
const { eq, and, like, or, sql } = require('drizzle-orm');

const router = Router();
router.use(authenticate);

router.get('/tickets', async (req, res, next) => {
  try {
    const { stage, product_id, category_id, search } = req.query;

    let conditions = [];
    if (stage) conditions.push(eq(kdsTickets.stage, stage));
    if (search) conditions.push(like(kdsTickets.ticketNumber, `%${search}%`));

    let where = conditions.length > 0 ? and(...conditions) : undefined;
    let tickets = await db.select().from(kdsTickets).where(where).orderBy(kdsTickets.sentAt);

    if (product_id || category_id) {
      tickets = await Promise.all(tickets.map(async (t) => {
        const items = await db.select().from(kdsTicketItems).where(eq(kdsTicketItems.ticketId, t.id));
        const match = items.some((item) => {
          if (product_id && item.productId === product_id) return true;
          return false;
        });
        return match ? t : null;
      }));
      tickets = tickets.filter(Boolean);
    }

    const result = await Promise.all(tickets.map(async (t) => {
      const [order] = await db.select().from(orders).where(eq(orders.id, t.orderId)).limit(1);
      let tableNumber = null;
      if (order?.tableId) {
        const [tb] = await db.select().from(tables).where(eq(tables.id, order.tableId)).limit(1);
        if (tb) tableNumber = tb.tableNumber;
      }

      const items = await db.select().from(kdsTicketItems).where(eq(kdsTicketItems.ticketId, t.id));
      return {
        id: t.id, ticket_number: t.ticketNumber, order_id: t.orderId,
        table_number: tableNumber, stage: t.stage,
        items: items.map((item) => ({
          id: item.id, product_name: item.productName, quantity: item.quantity, completed: item.completed,
        })),
        sent_at: t.sentAt, updated_at: t.updatedAt,
      };
    }));

    sendSuccess(res, result, { page: 1, page_size: 50, total_count: result.length, total_pages: 1 });
  } catch (err) { next(err); }
});

router.get('/tickets/:ticket_id', async (req, res, next) => {
  try {
    const [t] = await db.select().from(kdsTickets).where(eq(kdsTickets.id, req.params.ticket_id)).limit(1);
    if (!t) return next(new NotFoundError('Ticket not found.'));

    const items = await db.select().from(kdsTicketItems).where(eq(kdsTicketItems.ticketId, t.id));

    const [order] = await db.select().from(orders).where(eq(orders.id, t.orderId)).limit(1);
    let tableNumber = null;
    if (order?.tableId) {
      const [tb] = await db.select().from(tables).where(eq(tables.id, order.tableId)).limit(1);
      if (tb) tableNumber = tb.tableNumber;
    }

    sendSuccess(res, {
      id: t.id, ticket_number: t.ticketNumber, order_id: t.orderId,
      table_number: tableNumber, stage: t.stage,
      items: items.map((item) => ({
        id: item.id, product_name: item.productName, quantity: item.quantity, completed: item.completed,
      })),
      sent_at: t.sentAt, updated_at: t.updatedAt,
    });
  } catch (err) { next(err); }
});

router.post('/tickets/:ticket_id/advance', async (req, res, next) => {
  try {
    const [t] = await db.select().from(kdsTickets).where(eq(kdsTickets.id, req.params.ticket_id)).limit(1);
    if (!t) return next(new NotFoundError('Ticket not found.'));

    const stages = ['to_cook', 'preparing', 'completed'];
    const currentIdx = stages.indexOf(t.stage);
    if (currentIdx >= stages.length - 1) {
      return next(new ConflictError('INVALID_STATE', `Ticket is already in the '${t.stage}' stage and cannot advance further.`));
    }

    const targetStage = req.query.target_stage || stages[currentIdx + 1];
    const targetIdx = stages.indexOf(targetStage);
    if (targetIdx === -1) {
      return next(new (require('../utils/errors').ValidationError)([{ field: 'target_stage', message: `Invalid target stage '${targetStage}'.` }]));
    }
    if (targetIdx <= currentIdx) {
      return next(new ConflictError('INVALID_STATE', `Cannot move backwards from '${t.stage}' to '${targetStage}'.`));
    }

    const [updated] = await db.update(kdsTickets).set({
      stage: targetStage, updatedAt: new Date().toISOString(),
    }).where(eq(kdsTickets.id, req.params.ticket_id)).returning();

    sendSuccess(res, {
      id: updated.id, ticket_number: updated.ticketNumber, stage: updated.stage, updated_at: updated.updatedAt,
    });
  } catch (err) { next(err); }
});

router.patch('/tickets/:ticket_id/items/:item_id', async (req, res, next) => {
  try {
    const { completed } = req.body;
    if (completed === undefined) {
      return next(new (require('../utils/errors').ValidationError)([{ field: 'completed', message: 'completed is required.' }]));
    }

    const [item] = await db.select().from(kdsTicketItems).where(and(
      eq(kdsTicketItems.id, req.params.item_id),
      eq(kdsTicketItems.ticketId, req.params.ticket_id),
    )).limit(1);
    if (!item) return next(new NotFoundError('Ticket item not found.'));

    const updates = { completed };
    if (completed) updates.completedAt = new Date().toISOString();

    const [updated] = await db.update(kdsTicketItems).set(updates).where(eq(kdsTicketItems.id, req.params.item_id)).returning();

    sendSuccess(res, {
      id: updated.id, product_name: updated.productName, quantity: updated.quantity,
      completed: updated.completed, completed_at: updated.completedAt,
    });
  } catch (err) { next(err); }
});

module.exports = router;
