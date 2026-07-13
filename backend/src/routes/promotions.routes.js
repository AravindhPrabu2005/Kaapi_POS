const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { db } = require('../db');
const { promotions, products, orders, orderLines, promotionUsages } = require('../db/schema');

const router = Router();
router.use(authenticate);

const createProductScopeSchema = z.object({
  name: z.string().min(1).max(255),
  scope: z.literal('product'),
  product_id: z.string().uuid(),
  min_quantity: z.number().int().positive(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.string().regex(/^\d+(\.\d{1,2})?$/),
  active: z.boolean().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

const createOrderScopeSchema = z.object({
  name: z.string().min(1).max(255),
  scope: z.literal('order'),
  min_order_amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.string().regex(/^\d+(\.\d{1,2})?$/),
  active: z.boolean().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { scope, active, search } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const filter = {};
    if (scope) filter.scope = scope;
    if (active !== undefined) filter.active = active === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };

    const count = await db.collection(promotions.tableName).countDocuments(filter);
    const cursor = await db.collection(promotions.tableName).find(filter);
    const data = await cursor.sort({ createdAt: 1 }).skip(offset).limit(pageSize).toArray();

    const result = data.map((p) => ({
      id: p.id, name: p.name, scope: p.scope,
      ...(p.scope === 'product' ? { product: { id: p.productId } } : {}),
      ...(p.scope === 'product' ? { min_quantity: p.minQuantity } : {}),
      ...(p.scope === 'order' ? { min_order_amount: p.minOrderAmount } : {}),
      discount_type: p.discountType, discount_value: p.discountValue, active: p.active,
      valid_from: p.validFrom, valid_until: p.validUntil,
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: count });
  } catch (err) { next(err); }
});

router.get('/:promotion_id', async (req, res, next) => {
  try {
    const p = await db.collection(promotions.tableName).findOne({ id: req.params.promotion_id });
    if (!p) return next(new NotFoundError('Promotion not found.'));

    let productData = null;
    if (p.productId) {
      const prod = await db.collection(products.tableName).findOne({ id: p.productId });
      if (prod) productData = { id: prod.id, name: prod.name };
    }

    sendSuccess(res, {
      id: p.id, name: p.name, scope: p.scope, product: productData,
      min_quantity: p.minQuantity, min_order_amount: p.minOrderAmount,
      discount_type: p.discountType, discount_value: p.discountValue, active: p.active,
      valid_from: p.validFrom, valid_until: p.validUntil, created_at: p.createdAt,
    });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    if (req.body.scope === 'product') {
      const parsed = createProductScopeSchema.parse(req.body);
      const promo = {
        id: require('uuid').v4(),
        name: parsed.name,
        scope: 'product',
        productId: parsed.product_id,
        minQuantity: parsed.min_quantity,
        discountType: parsed.discount_type,
        discountValue: parsed.discount_value,
        active: parsed.active !== undefined ? parsed.active : true,
        validFrom: parsed.valid_from || null,
        validUntil: parsed.valid_until || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(promotions.tableName).insertOne(promo);

      let productData = null;
      const prod = await db.collection(products.tableName).findOne({ id: promo.productId });
      if (prod) productData = { id: prod.id, name: prod.name };

      return sendSuccess(res, {
        id: promo.id, name: promo.name, scope: 'product', product: productData,
        min_quantity: promo.minQuantity, discount_type: promo.discountType,
        discount_value: promo.discountValue, active: promo.active,
        valid_from: promo.validFrom, valid_until: promo.validUntil, created_at: promo.createdAt,
      }, null, 201);
    }

    if (req.body.scope === 'order') {
      const parsed = createOrderScopeSchema.parse(req.body);
      const promo = {
        id: require('uuid').v4(),
        name: parsed.name,
        scope: 'order',
        minOrderAmount: parsed.min_order_amount,
        discountType: parsed.discount_type,
        discountValue: parsed.discount_value,
        active: parsed.active !== undefined ? parsed.active : true,
        validFrom: parsed.valid_from || null,
        validUntil: parsed.valid_until || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(promotions.tableName).insertOne(promo);

      return sendSuccess(res, {
        id: promo.id, name: promo.name, scope: 'order', min_order_amount: promo.minOrderAmount,
        discount_type: promo.discountType, discount_value: promo.discountValue,
        active: promo.active,
        valid_from: promo.validFrom, valid_until: promo.validUntil, created_at: promo.createdAt,
      }, null, 201);
    }

    return next(new ValidationError([{ field: 'scope', message: 'Scope must be "product" or "order".' }]));
  } catch (err) { next(err); }
});

router.put('/:promotion_id', requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await db.collection(promotions.tableName).findOne({ id: req.params.promotion_id });
    if (!existing) return next(new NotFoundError('Promotion not found.'));

    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.scope !== undefined) updates.scope = req.body.scope;
    if (req.body.discount_type !== undefined) updates.discountType = req.body.discount_type;
    if (req.body.discount_value !== undefined) updates.discountValue = req.body.discount_value;
    if (req.body.active !== undefined) updates.active = req.body.active;
    if (req.body.valid_from !== undefined) updates.validFrom = req.body.valid_from;
    if (req.body.valid_until !== undefined) updates.validUntil = req.body.valid_until;

    const scope = req.body.scope || existing.scope;
    if (scope === 'product') {
      if (req.body.product_id !== undefined) updates.productId = req.body.product_id;
      if (req.body.min_quantity !== undefined) updates.minQuantity = req.body.min_quantity;
      updates.minOrderAmount = null;
    } else if (scope === 'order') {
      if (req.body.min_order_amount !== undefined) updates.minOrderAmount = req.body.min_order_amount;
      updates.productId = null;
      updates.minQuantity = null;
    }

    const resUpdate = await db.collection(promotions.tableName).updateOne(
      { id: req.params.promotion_id },
      { $set: updates }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Promotion not found.'));
    }

    const p = await db.collection(promotions.tableName).findOne({ id: req.params.promotion_id });

    let productData = null;
    if (p.productId) {
      const prod = await db.collection(products.tableName).findOne({ id: p.productId });
      if (prod) productData = { id: prod.id, name: prod.name };
    }

    sendSuccess(res, {
      id: p.id, name: p.name, scope: p.scope,
      product: productData, min_quantity: p.minQuantity,
      min_order_amount: p.minOrderAmount,
      discount_type: p.discountType, discount_value: p.discountValue,
      active: p.active, valid_from: p.validFrom, valid_until: p.validUntil, updated_at: p.updatedAt,
    });
  } catch (err) { next(err); }
});

router.delete('/:promotion_id', requireRole('admin'), async (req, res, next) => {
  try {
    const p = await db.collection(promotions.tableName).findOne({ id: req.params.promotion_id });
    if (!p) return next(new NotFoundError('Promotion not found.'));
    await db.collection(promotionUsages.tableName).deleteMany({ promotionId: req.params.promotion_id });
    await db.collection(orderLines.tableName).updateMany(
      { appliedPromotionId: req.params.promotion_id },
      { $set: { appliedPromotionId: null } }
    );
    await db.collection(promotions.tableName).deleteOne({ id: req.params.promotion_id });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/evaluate', async (req, res, next) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return next(new ValidationError([{ field: 'order_id', message: 'order_id is required.' }]));

    const order = await db.collection(orders.tableName).findOne({ id: order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    const linesCursor = await db.collection(orderLines.tableName).find({ orderId: order_id });
    const lines = await linesCursor.toArray();
    const now = new Date().toISOString();

    // Check which promos this customer already used on other orders
    const existingPromoUsages = new Set();
    if (order.customerId) {
      const usagesCursor = await db.collection(promotionUsages.tableName).find({
        customerId: order.customerId,
        orderId: { $ne: order.id }
      });
      const usages = await usagesCursor.toArray();
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    const activePromosCursor = await db.collection(promotions.tableName).find({
      active: true,
      $and: [
        { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
        { $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }
      ]
    });
    const activePromos = await activePromosCursor.toArray();

    let totalDiscount = 0;
    const applied = [];

    for (const line of lines) {
      for (const promo of activePromos) {
        if (promo.scope === 'product' && promo.productId === line.productId && line.quantity >= promo.minQuantity && !existingPromoUsages.has(promo.id)) {
          let d = 0;
          if (promo.discountType === 'percentage') d = parseFloat(line.unitPrice) * line.quantity * parseFloat(promo.discountValue) / 100;
          else d = parseFloat(promo.discountValue);
          totalDiscount += d;
          applied.push({
            promotion_id: promo.id, name: promo.name, scope: 'product',
            applies_to_order_line_id: line.id,
            discount_amount: d.toFixed(2),
          });
        }
      }
    }

    for (const promo of activePromos) {
      if (promo.scope === 'order' && promo.minOrderAmount && parseFloat(order.subtotal) >= parseFloat(promo.minOrderAmount) && !existingPromoUsages.has(promo.id)) {
        let d = 0;
        if (promo.discountType === 'percentage') d = parseFloat(order.subtotal) * parseFloat(promo.discountValue) / 100;
        else d = parseFloat(promo.discountValue);
        totalDiscount += d;
        applied.push({
          promotion_id: promo.id, name: promo.name, scope: 'order',
          applies_to_order_line_id: null,
          discount_amount: d.toFixed(2),
        });
      }
    }

    const subtotal = parseFloat(order.subtotal);
    const tax = parseFloat(order.tax);
    const discount = Math.min(totalDiscount, subtotal);
    const total = subtotal + tax - discount;

    sendSuccess(res, {
      applied_promotions: applied,
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
