const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { db } = require('../db');
const { paymentMethods } = require('../db/schema');
const QRCode = require('qrcode');

const router = Router();
router.use(authenticate);

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  upi_id: z.string().max(100).optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const cursor = await db.collection(paymentMethods.tableName).find({});
    const methods = await cursor.sort({ createdAt: 1 }).toArray();
    sendSuccess(res, methods.map((m) => ({
      id: m.id, type: m.type, label: m.label, enabled: m.enabled, ...(m.type === 'upi' ? { upi_id: m.upiId } : {}),
    })));
  } catch (err) { next(err); }
});

router.get('/:payment_method_id', async (req, res, next) => {
  try {
    const m = await db.collection(paymentMethods.tableName).findOne({ id: req.params.payment_method_id });
    if (!m) return next(new NotFoundError('Payment method not found.'));
    sendSuccess(res, { id: m.id, type: m.type, label: m.label, enabled: m.enabled, upi_id: m.upiId, updated_at: m.updatedAt });
  } catch (err) { next(err); }
});

router.patch('/:payment_method_id', requireRole('admin'), validate(patchSchema), async (req, res, next) => {
  try {
    const method = await db.collection(paymentMethods.tableName).findOne({ id: req.params.payment_method_id });
    if (!method) return next(new NotFoundError('Payment method not found.'));

    if (method.type === 'upi' && req.body.enabled !== false && !req.body.upi_id && !method.upiId) {
      return next(new ValidationError([{ field: 'upi_id', message: 'UPI ID is required to enable UPI QR payments.' }]));
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.upi_id !== undefined) updates.upiId = req.body.upi_id;

    await db.collection(paymentMethods.tableName).updateOne(
      { id: req.params.payment_method_id },
      { $set: updates }
    );
    const m = await db.collection(paymentMethods.tableName).findOne({ id: req.params.payment_method_id });
    sendSuccess(res, { id: m.id, type: m.type, label: m.label, enabled: m.enabled, updated_at: m.updatedAt });
  } catch (err) { next(err); }
});

router.get('/upi/qr-code', async (req, res, next) => {
  try {
    const amount = req.query.amount || '0.00';
    const orderId = req.query.order_id || '';

    const upiMethod = await db.collection(paymentMethods.tableName).findOne({ type: 'upi' });
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
