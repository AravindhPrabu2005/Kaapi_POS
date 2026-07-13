const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { coupons, orders, couponUsages, customers } = require('../db/schema');

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.string().regex(/^\d+(\.\d{1,2})?$/),
  active: z.boolean().optional(),
  max_uses: z.number().int().positive().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

const updateSchema = z.object({
  discount_value: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  active: z.boolean().optional(),
  max_uses: z.number().int().positive().optional(),
  max_uses_null: z.boolean().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  valid_from_null: z.boolean().optional(),
  valid_until_null: z.boolean().optional(),
});

const validateSchema = z.object({
  code: z.string().min(1).max(50),
  order_id: z.string().uuid(),
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { active, search } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const filter = {};
    if (active !== undefined) {
      filter.active = active === 'true';
    }
    if (search) {
      filter.code = { $regex: search, $options: 'i' };
    }

    const count = await db.collection(coupons.tableName).countDocuments(filter);
    const cursor = await db.collection(coupons.tableName).find(filter);
    const data = await cursor.sort({ createdAt: 1 }).skip(offset).limit(pageSize).toArray();

    sendPaginated(res, data.map((c) => ({
      id: c.id, code: c.code, discount_type: c.discountType, discount_value: c.discountValue,
      active: c.active, max_uses: c.maxUses, redemption_count: c.redemptionCount,
      valid_from: c.validFrom, valid_until: c.validUntil, created_at: c.createdAt,
    })), { page, pageSize, totalCount: count });
  } catch (err) { next(err); }
});

router.get('/:coupon_id', async (req, res, next) => {
  try {
    const c = await db.collection(coupons.tableName).findOne({ id: req.params.coupon_id });
    if (!c) return next(new NotFoundError('Coupon not found.'));
    sendSuccess(res, {
      id: c.id, code: c.code, discount_type: c.discountType, discount_value: c.discountValue,
      active: c.active, max_uses: c.maxUses, redemption_count: c.redemptionCount,
      valid_from: c.validFrom, valid_until: c.validUntil, created_at: c.createdAt, updated_at: c.updatedAt,
    });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), validate(createSchema), async (req, res, next) => {
  try {
    const existing = await db.collection(coupons.tableName).findOne({ code: req.body.code });
    if (existing) {
      return next(new ConflictError('DUPLICATE_CODE', `A coupon with code '${req.body.code}' already exists.`));
    }

    const c = {
      id: require('crypto').randomUUID(),
      code: req.body.code,
      discountType: req.body.discount_type,
      discountValue: req.body.discount_value,
      active: req.body.active !== undefined ? req.body.active : true,
      maxUses: req.body.max_uses || null,
      redemptionCount: 0,
      validFrom: req.body.valid_from || null,
      validUntil: req.body.valid_until || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(coupons.tableName).insertOne(c);

    sendSuccess(res, {
      id: c.id, code: c.code, discount_type: c.discountType, discount_value: c.discountValue,
      active: c.active, max_uses: c.maxUses,
      valid_from: c.validFrom, valid_until: c.validUntil, created_at: c.createdAt,
    }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:coupon_id', requireRole('admin'), validate(updateSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.discount_value) updates.discountValue = req.body.discount_value;
    if (req.body.active !== undefined) updates.active = req.body.active;
    if (req.body.max_uses !== undefined) updates.maxUses = req.body.max_uses;
    if (req.body.max_uses_null) updates.maxUses = null;
    if (req.body.valid_from !== undefined) updates.validFrom = req.body.valid_from;
    if (req.body.valid_until !== undefined) updates.validUntil = req.body.valid_until;
    if (req.body.valid_from_null) updates.validFrom = null;
    if (req.body.valid_until_null) updates.validUntil = null;

    const resUpdate = await db.collection(coupons.tableName).updateOne(
      { id: req.params.coupon_id },
      { $set: updates }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Coupon not found.'));
    }

    const c = await db.collection(coupons.tableName).findOne({ id: req.params.coupon_id });

    sendSuccess(res, {
      id: c.id, code: c.code, discount_type: c.discountType, discount_value: c.discountValue,
      active: c.active, max_uses: c.maxUses,
      valid_from: c.validFrom, valid_until: c.validUntil, updated_at: c.updatedAt,
    });
  } catch (err) { next(err); }
});

router.delete('/:coupon_id', requireRole('admin'), async (req, res, next) => {
  try {
    const c = await db.collection(coupons.tableName).findOne({ id: req.params.coupon_id });
    if (!c) return next(new NotFoundError('Coupon not found.'));
    await db.collection(couponUsages.tableName).deleteMany({ couponId: req.params.coupon_id });
    await db.collection(orders.tableName).updateMany({ couponId: req.params.coupon_id }, { $set: { couponId: null } });
    await db.collection(coupons.tableName).deleteOne({ id: req.params.coupon_id });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/lookup/:code', async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const coupon = await db.collection(coupons.tableName).findOne({
      code: req.params.code.toUpperCase(),
      active: true,
      $and: [
        { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
        { $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }
      ]
    });
    if (!coupon) return next(new NotFoundError('INVALID_COUPON', 'Coupon code is invalid, expired, or inactive.'));
    if (coupon.maxUses && coupon.redemptionCount >= coupon.maxUses) {
      return next(new NotFoundError('COUPON_EXHAUSTED', 'This coupon has reached its maximum usage limit.'));
    }
    sendSuccess(res, {
      id: coupon.id, code: coupon.code, discount_type: coupon.discountType,
      discount_value: coupon.discountValue, max_uses: coupon.maxUses, redemption_count: coupon.redemptionCount,
    });
  } catch (err) { next(err); }
});

router.post('/validate', validate(validateSchema), async (req, res, next) => {
  try {
    const { code, order_id } = req.body;

    const now = new Date().toISOString();
    const coupon = await db.collection(coupons.tableName).findOne({
      code: code,
      active: true,
      $and: [
        { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
        { $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }
      ]
    });
    if (!coupon) {
      return next(new NotFoundError('INVALID_COUPON', `Coupon code '${code}' is invalid, expired, or inactive.`));
    }

    if (coupon.maxUses && coupon.redemptionCount >= coupon.maxUses) {
      return next(new NotFoundError('COUPON_EXHAUSTED', 'This coupon has reached its maximum usage limit.'));
    }

    const order = await db.collection(orders.tableName).findOne({ id: order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    if (order.customerId) {
      const existingUsage = await db.collection(couponUsages.tableName).findOne({
        couponId: coupon.id,
        customerId: order.customerId
      });
      if (existingUsage) {
        return next(new NotFoundError('COUPON_ALREADY_USED', 'This coupon has already been used by this customer.'));
      }
    }

    let discountAmount = '0.00';
    if (coupon.discountType === 'percentage') {
      discountAmount = (parseFloat(order.subtotal) * parseFloat(coupon.discountValue) / 100).toFixed(2);
    } else {
      discountAmount = parseFloat(coupon.discountValue).toFixed(2);
    }

    const subtotal = parseFloat(order.subtotal);
    const tax = parseFloat(order.tax);
    const discount = parseFloat(discountAmount);
    const total = subtotal + tax - discount;

    sendSuccess(res, {
      coupon: { id: coupon.id, code: coupon.code, discount_type: coupon.discountType, discount_value: coupon.discountValue },
      applied_discount_amount: discountAmount,
      order_totals: {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: discount.toFixed(2),
        total: Math.max(0, total).toFixed(2),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
