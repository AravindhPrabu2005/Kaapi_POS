const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { UnauthorizedError, ConflictError } = require('../utils/errors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { users } = require('../db/schema');
const { JWT_SECRET } = require('../middleware/auth');
const config = require('../config/env');

const router = Router();

const signupSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().uuid(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

function generateTokens(userRecord) {
  const accessToken = jwt.sign(
    { id: userRecord.id, email: userRecord.email, role: userRecord.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const refreshToken = require('uuid').v4();
  return { accessToken, refreshToken, expiresIn: 3600 };
}

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await db.collection(users.tableName).find({ email }).limit(1).toArray();
    if (existing.length > 0) {
      return next(new ConflictError('VALIDATION_ERROR', 'Email is already in use.'));
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = {
      id: require('uuid').v4(),
      name,
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(users.tableName).insertOne(user);

    const tokens = generateTokens(user);
    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
    }, null, 201);
  } catch (err) { next(err); }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await db.collection(users.tableName).findOne({ email });
    if (!user) return next(new UnauthorizedError('INVALID_CREDENTIALS', 'Email or password is incorrect.'));

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return next(new UnauthorizedError('INVALID_CREDENTIALS', 'Email or password is incorrect.'));

    if (user.status === 'archived') {
      return next(new UnauthorizedError('UNAUTHORIZED', 'Account is archived.'));
    }

    const tokens = generateTokens(user);
    sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      last_session: null,
    });
  } catch (err) { next(err); }
});

router.post('/refresh', validate(refreshSchema), (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const newAccessToken = jwt.sign(
      { id: req.user?.id, email: req.user?.email, role: req.user?.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    sendSuccess(res, { access_token: newAccessToken, expires_in: 3600 });
  } catch (err) { next(err); }
});

router.post('/logout', authenticate, (req, res) => {
  res.status(204).send();
});

router.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    const user = await db.collection(users.tableName).findOne({ id: req.user.id });
    if (!user) return next(new UnauthorizedError());

    const valid = await bcrypt.compare(current_password, user.passwordHash);
    if (!valid) return next(new UnauthorizedError('INVALID_CREDENTIALS', 'Current password is incorrect.'));

    const passwordHash = await bcrypt.hash(new_password, config.bcryptRounds);
    await db.collection(users.tableName).updateOne(
      { id: user.id },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );

    sendSuccess(res, { message: 'Password updated successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
