const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!user) return next(new NotFoundError('User not found.'));
    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
    });
  } catch (err) { next(err); }
});

router.patch('/me', authenticate, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.name) updates.name = req.body.name;

    const [user] = await db.update(users).set(updates).where(eq(users.id, req.user.id)).returning();
    if (!user) return next(new NotFoundError('User not found.'));

    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  } catch (err) { next(err); }
});

module.exports = router;
