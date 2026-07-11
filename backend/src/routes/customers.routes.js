const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../db');
const { customers } = require('../db/schema');
const { eq, like, or, sql } = require('drizzle-orm');

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

    const conditions = [];
    if (search) conditions.push(or(like(customers.name, `%${search}%`), like(customers.email, `%${search}%`)));

    const where = conditions.length > 0 ? or(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(customers).where(where).limit(pageSize).offset(offset).orderBy(customers.createdAt),
      db.select({ count: sql`count(*)` }).from(customers).where(where),
    ]);

    sendPaginated(res, data.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
    })), { page, pageSize, totalCount: parseInt(count, 10) });
  } catch (err) { next(err); }
});

router.get('/:customer_id', async (req, res, next) => {
  try {
    const [c] = await db.select().from(customers).where(eq(customers.id, req.params.customer_id)).limit(1);
    if (!c) return next(new NotFoundError('Customer not found.'));

    const { orders } = require('../db/schema');
    const [{ count }] = await db.select({ count: sql`count(*)` }).from(orders).where(eq(orders.customerId, c.id));

    sendSuccess(res, {
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      created_at: c.createdAt, order_count: parseInt(count, 10),
    });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const [c] = await db.insert(customers).values({
      name: req.body.name,
      email: req.body.email || null,
      phone: req.body.phone || null,
    }).returning();

    sendSuccess(res, { id: c.id, name: c.name, email: c.email, phone: c.phone, created_at: c.createdAt }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:customer_id', validate(updateSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;

    const [c] = await db.update(customers).set(updates).where(eq(customers.id, req.params.customer_id)).returning();
    if (!c) return next(new NotFoundError('Customer not found.'));

    sendSuccess(res, { id: c.id, name: c.name, email: c.email, phone: c.phone, updated_at: c.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:customer_id', async (req, res, next) => {
  try {
    const [c] = await db.select().from(customers).where(eq(customers.id, req.params.customer_id)).limit(1);
    if (!c) return next(new NotFoundError('Customer not found.'));
    await db.delete(customers).where(eq(customers.id, req.params.customer_id));
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
