const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { db } = require('../db');
const { paymentMethods } = require('../db/schema');
const { eq } = require('drizzle-orm');
const QRCode = require('qrcode');

const router = Router();
router.use(authenticate);

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  upi_id: z.string().max(100).optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const methods = await db.select().from(paymentMethods).orderBy(paymentMethods.createdAt);
    sendSuccess(res, methods.map((m) => ({
      id: m.id, type: m.type, label: m.label, enabled: m.enabled, ...(m.type === 'upi' ? { upi_id: m.upiId } : {}),
    })));
  } catch (err) { next(err); }
});

router.get('/:payment_method_id', async (req, res, next) => {
  try {
    const [m] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, req.params.payment_method_id)).limit(1);
    if (!m) return next(new NotFoundError('Payment method not found.'));
    sendSuccess(res, { id: m.id, type: m.type, label: m.label, enabled: m.enabled, upi_id: m.upiId, updated_at: m.updatedAt });
  } catch (err) { next(err); }
});

router.patch('/:payment_method_id', requireRole('admin'), validate(patchSchema), async (req, res, next) => {
  try {
    const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, req.params.payment_method_id)).limit(1);
    if (!method) return next(new NotFoundError('Payment method not found.'));

    if (method.type === 'upi' && req.body.enabled !== false && !req.body.upi_id && !method.upiId) {
      return next(new ValidationError([{ field: 'upi_id', message: 'UPI ID is required to enable UPI QR payments.' }]));
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.upi_id !== undefined) updates.upiId = req.body.upi_id;

    const [m] = await db.update(paymentMethods).set(updates).where(eq(paymentMethods.id, req.params.payment_method_id)).returning();
    sendSuccess(res, { id: m.id, type: m.type, label: m.label, enabled: m.enabled, updated_at: m.updatedAt });
  } catch (err) { next(err); }
});

router.get('/upi/qr-code', async (req, res, next) => {
  try {
    const amount = req.query.amount || '0.00';
    const orderId = req.query.order_id || '';

    const [upiMethod] = await db.select().from(paymentMethods).where(eq(paymentMethods.type, 'upi')).limit(1);
    const upiId = upiMethod?.upiId || 'cafe@ybl';

    const qrString = `upi://pay?pa=${upiId}&am=${amount}&cu=INR&tn=Order%20${encodeURIComponent(orderId)}`;
    const qrImage = await QRCode.toDataURL(qrString);

    sendSuccess(res, {
      upi_id: upiId,
      amount,
      qr_image_url: qrImage,
      qr_string: qrString,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  } catch (err) { next(err); }
});

module.exports = router;
