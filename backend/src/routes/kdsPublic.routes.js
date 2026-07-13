const { Router } = require('express');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { kdsTickets, kdsTicketItems, orders, tables } = require('../db/schema');

const router = Router();

router.get('/tickets', async (req, res, next) => {
  try {
    const { stage } = req.query;
    const filter = {};
    if (stage) filter.stage = stage;

    const cursor = await db.collection(kdsTickets.tableName).find(filter);
    const tickets = await cursor.sort({ sentAt: 1 }).toArray();

    const result = await Promise.all(tickets.map(async (t) => {
      const order = await db.collection(orders.tableName).findOne({ id: t.orderId });
      let tableNumber = null;
      if (order?.tableId) {
        const tb = await db.collection(tables.tableName).findOne({ id: order.tableId });
        if (tb) tableNumber = tb.tableNumber;
      }

      const items = await (await db.collection(kdsTicketItems.tableName).find({ ticketId: t.id })).toArray();
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

router.post('/tickets/:ticket_id/advance', async (req, res, next) => {
  try {
    const t = await db.collection(kdsTickets.tableName).findOne({ id: req.params.ticket_id });
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

    const updatedAt = new Date().toISOString();
    await db.collection(kdsTickets.tableName).updateOne(
      { id: req.params.ticket_id },
      { $set: { stage: targetStage, updatedAt } }
    );
    const updated = await db.collection(kdsTickets.tableName).findOne({ id: req.params.ticket_id });

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

    const item = await db.collection(kdsTicketItems.tableName).findOne({
      id: req.params.item_id,
      ticketId: req.params.ticket_id,
    });
    if (!item) return next(new NotFoundError('Ticket item not found.'));

    const updates = { completed };
    if (completed) updates.completedAt = new Date().toISOString();

    await db.collection(kdsTicketItems.tableName).updateOne(
      { id: req.params.item_id },
      { $set: updates }
    );
    const updated = await db.collection(kdsTicketItems.tableName).findOne({ id: req.params.item_id });

    sendSuccess(res, {
      id: updated.id, product_name: updated.productName, quantity: updated.quantity,
      completed: updated.completed, completed_at: updated.completedAt,
    });
  } catch (err) { next(err); }
});

module.exports = router;
