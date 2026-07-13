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

    const filter = {};
    if (role) {
      filter.role = role;
    }
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const count = await db.collection(users.tableName).countDocuments(filter);
    const cursor = await db.collection(users.tableName).find(filter);
    const data = await cursor.sort({ createdAt: 1 }).skip(offset).limit(pageSize).toArray();

    sendPaginated(res, data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      created_at: u.createdAt,
    })), { page, pageSize, totalCount: count });
  } catch (err) { next(err); }
});

router.get('/:employee_id', async (req, res, next) => {
  try {
    const user = await db.collection(users.tableName).findOne({ id: req.params.employee_id });
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

    const existing = await db.collection(users.tableName).findOne({ email });
    if (existing) {
      return next(new ConflictError('VALIDATION_ERROR', 'Email is already in use.'));
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = {
      id: require('uuid').v4(),
      name,
      email,
      passwordHash,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(users.tableName).insertOne(user);

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

    const resUpdate = await db.collection(users.tableName).updateOne(
      { id: req.params.employee_id },
      { $set: updates }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Employee not found.'));
    }

    const user = await db.collection(users.tableName).findOne({ id: req.params.employee_id });

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
    const resUpdate = await db.collection(users.tableName).updateOne(
      { id: req.params.employee_id },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Employee not found.'));
    }
    sendSuccess(res, { message: 'Password updated successfully.' });
  } catch (err) { next(err); }
});

router.post('/:employee_id/archive', async (req, res, next) => {
  try {
    const updates = {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const resUpdate = await db.collection(users.tableName).updateOne(
      { id: req.params.employee_id },
      { $set: updates }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Employee not found.'));
    }
    const user = await db.collection(users.tableName).findOne({ id: req.params.employee_id });
    sendSuccess(res, { id: user.id, status: user.status, archived_at: user.archivedAt });
  } catch (err) { next(err); }
});

router.delete('/:employee_id', async (req, res, next) => {
  try {
    const user = await db.collection(users.tableName).findOne({ id: req.params.employee_id });
    if (!user) return next(new NotFoundError('Employee not found.'));

    const { orders } = require('../db/schema');
    const count = await db.collection(orders.tableName).countDocuments({ employeeId: req.params.employee_id });
    if (count > 0) {
      return next(new ConflictError('RESOURCE_IN_USE', 'Employee has associated orders and cannot be permanently deleted. Archive instead.'));
    }

    await db.collection(users.tableName).deleteOne({ id: req.params.employee_id });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
