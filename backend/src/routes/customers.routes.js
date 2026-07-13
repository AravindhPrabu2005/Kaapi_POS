const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../db');
const { customers } = require('../db/schema');

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { search } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const count = await db.collection(customers.tableName).countDocuments(filter);
    const cursor = await db.collection(customers.tableName).find(filter);
    const data = await cursor.sort({ createdAt: 1 }).skip(offset).limit(pageSize).toArray();

    sendPaginated(res, data.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
    })), { page, pageSize, totalCount: count });
  } catch (err) { next(err); }
});

router.get('/:customer_id', async (req, res, next) => {
  try {
    const c = await db.collection(customers.tableName).findOne({ id: req.params.customer_id });
    if (!c) return next(new NotFoundError('Customer not found.'));

    const { orders } = require('../db/schema');
    const count = await db.collection(orders.tableName).countDocuments({ customerId: c.id });

    sendSuccess(res, {
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      created_at: c.createdAt, order_count: count,
    });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const c = {
      id: require('crypto').randomUUID(),
      name: req.body.name,
      email: req.body.email || null,
      phone: req.body.phone || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(customers.tableName).insertOne(c);

    sendSuccess(res, { id: c.id, name: c.name, email: c.email, phone: c.phone, created_at: c.createdAt }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:customer_id', validate(updateSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;

    const resUpdate = await db.collection(customers.tableName).updateOne(
      { id: req.params.customer_id },
      { $set: updates }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Customer not found.'));
    }

    const c = await db.collection(customers.tableName).findOne({ id: req.params.customer_id });

    sendSuccess(res, { id: c.id, name: c.name, email: c.email, phone: c.phone, updated_at: c.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:customer_id', async (req, res, next) => {
  try {
    const c = await db.collection(customers.tableName).findOne({ id: req.params.customer_id });
    if (!c) return next(new NotFoundError('Customer not found.'));
    await db.collection(customers.tableName).deleteOne({ id: req.params.customer_id });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
