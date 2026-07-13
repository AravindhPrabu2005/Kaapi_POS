const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { floors, tables, orders } = require('../db/schema');

const router = Router();
router.use(authenticate);

const createSchema = z.object({ name: z.string().min(1).max(255) });
const updateSchema = z.object({ name: z.string().min(1).max(255) });

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const cursor = await db.collection(floors.tableName).find(filter);
    const data = await cursor.sort({ createdAt: 1 }).toArray();

    const result = await Promise.all(data.map(async (f) => {
      const count = await db.collection(tables.tableName).countDocuments({ floorId: f.id });
      return { id: f.id, name: f.name, table_count: count, created_at: f.createdAt };
    }));
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.get('/:floor_id', async (req, res, next) => {
  try {
    const f = await db.collection(floors.tableName).findOne({ id: req.params.floor_id });
    if (!f) return next(new NotFoundError('Floor not found.'));

    const tablesCursor = await db.collection(tables.tableName).find({ floorId: f.id });
    const tableList = await tablesCursor.sort({ tableNumber: 1 }).toArray();

    const ordersCursor = await db.collection(orders.tableName).find({ status: 'draft' }, { projection: { tableId: 1, id: 1 } });
    const allDraftOrders = await ordersCursor.toArray();
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
    const f = {
      id: require('crypto').randomUUID(),
      name: req.body.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(floors.tableName).insertOne(f);
    sendSuccess(res, { id: f.id, name: f.name, table_count: 0, created_at: f.createdAt }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:floor_id', requireRole('admin'), validate(updateSchema), async (req, res, next) => {
  try {
    const updates = { name: req.body.name, updatedAt: new Date().toISOString() };
    const resUpdate = await db.collection(floors.tableName).updateOne(
      { id: req.params.floor_id },
      { $set: updates }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Floor not found.'));
    }
    const f = await db.collection(floors.tableName).findOne({ id: req.params.floor_id });
    sendSuccess(res, { id: f.id, name: f.name, updated_at: f.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:floor_id', requireRole('admin'), async (req, res, next) => {
  try {
    const f = await db.collection(floors.tableName).findOne({ id: req.params.floor_id });
    if (!f) return next(new NotFoundError('Floor not found.'));

    const count = await db.collection(tables.tableName).countDocuments({ floorId: req.params.floor_id });
    if (count > 0) {
      return next(new ConflictError('RESOURCE_IN_USE', 'Floor has tables assigned and cannot be deleted. Remove or reassign tables first.'));
    }

    await db.collection(floors.tableName).deleteOne({ id: req.params.floor_id });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
