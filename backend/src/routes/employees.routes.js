const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq, and, or, like, sql } = require('drizzle-orm');
const config = require('../config/env');

const router = Router();
router.use(authenticate);
router.use(requireRole('admin'));

const createEmployeeSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8),
  role: z.enum(['cashier']),
});

const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(['cashier', 'admin']).optional(),
});

const changePasswordSchema = z.object({
  new_password: z.string().min(8),
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const conditions = [];
    if (role) conditions.push(eq(users.role, role));
    if (status) conditions.push(eq(users.status, status));
    if (search) conditions.push(or(like(users.name, `%${search}%`), like(users.email, `%${search}%`)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(users).where(where).limit(pageSize).offset(offset).orderBy(users.createdAt),
      db.select({ count: sql`count(*)` }).from(users).where(where),
    ]);

    sendPaginated(res, data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      created_at: u.createdAt,
    })), { page, pageSize, totalCount: parseInt(count, 10) });
  } catch (err) { next(err); }
});

router.get('/:employee_id', async (req, res, next) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.employee_id)).limit(1);
    if (!user) return next(new NotFoundError('Employee not found.'));
    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  } catch (err) { next(err); }
});

router.post('/', validate(createEmployeeSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return next(new ConflictError('VALIDATION_ERROR', 'Email is already in use.'));
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const [user] = await db.insert(users).values({ name, email, passwordHash, role }).returning();

    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.createdAt,
    }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:employee_id', validate(updateEmployeeSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.name) updates.name = req.body.name;
    if (req.body.role) updates.role = req.body.role;

    const [user] = await db.update(users).set(updates).where(eq(users.id, req.params.employee_id)).returning();
    if (!user) return next(new NotFoundError('Employee not found.'));

    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      updated_at: user.updatedAt,
    });
  } catch (err) { next(err); }
});

router.post('/:employee_id/change-password', validate(changePasswordSchema), async (req, res, next) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.new_password, config.bcryptRounds);
    const [user] = await db.update(users).set({ passwordHash, updatedAt: new Date().toISOString() }).where(eq(users.id, req.params.employee_id)).returning();
    if (!user) return next(new NotFoundError('Employee not found.'));
    sendSuccess(res, { message: 'Password updated successfully.' });
  } catch (err) { next(err); }
});

router.post('/:employee_id/archive', async (req, res, next) => {
  try {
    const [user] = await db.update(users).set({ status: 'archived', archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(users.id, req.params.employee_id)).returning();
    if (!user) return next(new NotFoundError('Employee not found.'));
    sendSuccess(res, { id: user.id, status: user.status, archived_at: user.archivedAt });
  } catch (err) { next(err); }
});

router.delete('/:employee_id', async (req, res, next) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.employee_id)).limit(1);
    if (!user) return next(new NotFoundError('Employee not found.'));

    const { orders } = require('../db/schema');
    const orderCount = await db.select({ count: sql`count(*)` }).from(orders).where(eq(orders.employeeId, req.params.employee_id));
    if (parseInt(orderCount[0].count, 10) > 0) {
      return next(new ConflictError('RESOURCE_IN_USE', 'Employee has associated orders and cannot be permanently deleted. Archive instead.'));
    }

    await db.delete(users).where(eq(users.id, req.params.employee_id));
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
