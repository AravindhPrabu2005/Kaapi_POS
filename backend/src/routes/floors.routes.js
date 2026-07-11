const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { floors, tables, orders } = require('../db/schema');
const { eq, and, like, sql } = require('drizzle-orm');

const router = Router();
router.use(authenticate);

const createSchema = z.object({ name: z.string().min(1).max(255) });
const updateSchema = z.object({ name: z.string().min(1).max(255) });

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const conditions = [];
    if (search) conditions.push(like(floors.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.select().from(floors).where(where).orderBy(floors.createdAt);
    const result = await Promise.all(data.map(async (f) => {
      const [{ count }] = await db.select({ count: sql`count(*)` }).from(tables).where(eq(tables.floorId, f.id));
      return { id: f.id, name: f.name, table_count: parseInt(count, 10), created_at: f.createdAt };
    }));
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.get('/:floor_id', async (req, res, next) => {
  try {
    const [f] = await db.select().from(floors).where(eq(floors.id, req.params.floor_id)).limit(1);
    if (!f) return next(new NotFoundError('Floor not found.'));

    const tableList = await db.select().from(tables).where(eq(tables.floorId, f.id)).orderBy(tables.tableNumber);

    const allDraftOrders = await db.select({ tableId: orders.tableId, id: orders.id })
      .from(orders)
      .where(eq(orders.status, 'draft'));
    const occupiedMap = {};
    allDraftOrders.forEach((o) => { occupiedMap[o.tableId] = o.id; });

    const tableData = tableList.map((t) => ({
      id: t.id, table_number: t.tableNumber, seats: t.seats, active: t.active,
      status: occupiedMap[t.id] ? 'occupied' : 'available',
      current_order_id: occupiedMap[t.id] || null,
    }));

    sendSuccess(res, { id: f.id, name: f.name, created_at: f.createdAt, tables: tableData });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), validate(createSchema), async (req, res, next) => {
  try {
    const [f] = await db.insert(floors).values(req.body).returning();
    sendSuccess(res, { id: f.id, name: f.name, table_count: 0, created_at: f.createdAt }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:floor_id', requireRole('admin'), validate(updateSchema), async (req, res, next) => {
  try {
    const [f] = await db.update(floors).set({ name: req.body.name, updatedAt: new Date().toISOString() }).where(eq(floors.id, req.params.floor_id)).returning();
    if (!f) return next(new NotFoundError('Floor not found.'));
    sendSuccess(res, { id: f.id, name: f.name, updated_at: f.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:floor_id', requireRole('admin'), async (req, res, next) => {
  try {
    const [f] = await db.select().from(floors).where(eq(floors.id, req.params.floor_id)).limit(1);
    if (!f) return next(new NotFoundError('Floor not found.'));

    const [{ count }] = await db.select({ count: sql`count(*)` }).from(tables).where(eq(tables.floorId, req.params.floor_id));
    if (parseInt(count, 10) > 0) {
      return next(new ConflictError('RESOURCE_IN_USE', 'Floor has tables assigned and cannot be deleted. Remove or reassign tables first.'));
    }

    await db.delete(floors).where(eq(floors.id, req.params.floor_id));
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
