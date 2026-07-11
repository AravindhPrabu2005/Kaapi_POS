const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const { db } = require('../db');
const { orders, payments } = require('../db/schema');
const { eq } = require('drizzle-orm');
const QRCode = require('qrcode');

const router = Router();
router.use(authenticate);

const initiateSchema = z.object({
  payment_method: z.enum(['cash', 'card', 'upi']),
  amount_received: z.string().optional(),
  transaction_reference: z.string().optional(),
});

const confirmSchema = z.object({
  payment_method: z.enum(['cash', 'card', 'upi']),
});

router.post('/:order_id/payments/initiate', validate(initiateSchema), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const { payment_method, amount_received, transaction_reference } = req.body;

    if (payment_method === 'upi') {
      const { paymentMethods } = require('../db/schema');
      const [upiMethod] = await db.select().from(paymentMethods).where(eq(paymentMethods.type, 'upi')).limit(1);
      const upiId = upiMethod?.upiId || 'cafe@ybl';

      const qrString = `upi://pay?pa=${upiId}&am=${order.total}&cu=INR&tn=Order%20${encodeURIComponent(order.orderNumber)}`;
      const qrImage = await QRCode.toDataURL(qrString);

      return sendSuccess(res, {
        payment_method: 'upi', amount_due: order.total,
        qr_image_url: qrImage, qr_string: qrString, status: 'awaiting_confirmation',
      });
    }

    if (payment_method === 'cash') {
      if (!amount_received) {
        return next(new ValidationError([{ field: 'amount_received', message: 'amount_received is required for cash payments.' }]));
      }
      const change = (parseFloat(amount_received) - parseFloat(order.total)).toFixed(2);
      return sendSuccess(res, {
        payment_method: 'cash', amount_due: order.total,
        amount_received, change_due: change, status: 'awaiting_confirmation',
      });
    }

    if (payment_method === 'card') {
      return sendSuccess(res, {
        payment_method: 'card', amount_due: order.total,
        transaction_reference: transaction_reference || null, status: 'awaiting_confirmation',
      });
    }
  } catch (err) { next(err); }
});

router.post('/:order_id/payments/confirm', validate(confirmSchema), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const [payment] = await db.insert(payments).values({
      orderId: req.params.order_id,
      method: req.body.payment_method,
      amount: order.total,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    }).returning();

    await db.update(orders).set({ status: 'paid', updatedAt: new Date().toISOString() }).where(eq(orders.id, req.params.order_id));

    sendSuccess(res, {
      order_id: order.id, order_status: 'paid',
      payment: { id: payment.id, method: payment.method, amount: payment.amount, confirmed_at: payment.confirmedAt },
    });
  } catch (err) { next(err); }
});

router.post('/:order_id/payments/cancel', async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const existingPayments = await db.select().from(payments).where(eq(payments.orderId, req.params.order_id));
    for (const p of existingPayments) {
      await db.update(payments).set({ status: 'cancelled' }).where(eq(payments.id, p.id));
    }

    sendSuccess(res, {
      order_id: order.id, order_status: 'draft',
      message: 'Payment cancelled; returned to cart.',
    });
  } catch (err) { next(err); }
});

router.get('/:order_id/payments', async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const [payment] = await db.select().from(payments).where(eq(payments.orderId, req.params.order_id)).limit(1);
    if (!payment) return sendSuccess(res, null);

    sendSuccess(res, {
      id: payment.id, order_id: payment.orderId, method: payment.method,
      amount: payment.amount, confirmed_at: payment.confirmedAt,
    });
  } catch (err) { next(err); }
});

module.exports = router;
