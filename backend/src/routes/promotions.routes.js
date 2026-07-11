const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { db } = require('../db');
const { promotions, products, orders, orderLines, promotionUsages } = require('../db/schema');
const { eq, and, like, sql, lte, gte, isNull, or, ne } = require('drizzle-orm');

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

    const conditions = [];
    if (scope) conditions.push(eq(promotions.scope, scope));
    if (active !== undefined) conditions.push(eq(promotions.active, active === 'true'));
    if (search) conditions.push(like(promotions.name, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(promotions).where(where).limit(pageSize).offset(offset).orderBy(promotions.createdAt),
      db.select({ count: sql`count(*)` }).from(promotions).where(where),
    ]);

    const result = data.map((p) => ({
      id: p.id, name: p.name, scope: p.scope,
      ...(p.scope === 'product' ? { product: { id: p.productId } } : {}),
      ...(p.scope === 'product' ? { min_quantity: p.minQuantity } : {}),
      ...(p.scope === 'order' ? { min_order_amount: p.minOrderAmount } : {}),
      discount_type: p.discountType, discount_value: p.discountValue, active: p.active,
      valid_from: p.validFrom, valid_until: p.validUntil,
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: parseInt(count, 10) });
  } catch (err) { next(err); }
});

router.get('/:promotion_id', async (req, res, next) => {
  try {
    const [p] = await db.select().from(promotions).where(eq(promotions.id, req.params.promotion_id)).limit(1);
    if (!p) return next(new NotFoundError('Promotion not found.'));

    let productData = null;
    if (p.productId) {
      const [prod] = await db.select().from(products).where(eq(products.id, p.productId)).limit(1);
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
      const [promo] = await db.insert(promotions).values({
        name: parsed.name, scope: 'product', productId: parsed.product_id,
        minQuantity: parsed.min_quantity, discountType: parsed.discount_type,
        discountValue: parsed.discount_value, active: parsed.active !== undefined ? parsed.active : true,
        validFrom: parsed.valid_from || null, validUntil: parsed.valid_until || null,
      }).returning();

      let productData = null;
      const [prod] = await db.select().from(products).where(eq(products.id, promo.productId)).limit(1);
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
      const [promo] = await db.insert(promotions).values({
        name: parsed.name, scope: 'order', minOrderAmount: parsed.min_order_amount,
        discountType: parsed.discount_type, discountValue: parsed.discount_value,
        active: parsed.active !== undefined ? parsed.active : true,
        validFrom: parsed.valid_from || null, validUntil: parsed.valid_until || null,
      }).returning();

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
    const [existing] = await db.select().from(promotions).where(eq(promotions.id, req.params.promotion_id)).limit(1);
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

    const [p] = await db.update(promotions).set(updates).where(eq(promotions.id, req.params.promotion_id)).returning();
    if (!p) return next(new NotFoundError('Promotion not found.'));

    let productData = null;
    if (p.productId) {
      const [prod] = await db.select().from(products).where(eq(products.id, p.productId)).limit(1);
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
    const [p] = await db.select().from(promotions).where(eq(promotions.id, req.params.promotion_id)).limit(1);
    if (!p) return next(new NotFoundError('Promotion not found.'));
    await db.delete(promotionUsages).where(eq(promotionUsages.promotionId, req.params.promotion_id));
    await db.update(orderLines).set({ appliedPromotionId: null }).where(eq(orderLines.appliedPromotionId, req.params.promotion_id));
    await db.delete(promotions).where(eq(promotions.id, req.params.promotion_id));
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/evaluate', async (req, res, next) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return next(new ValidationError([{ field: 'order_id', message: 'order_id is required.' }]));

    const [order] = await db.select().from(orders).where(eq(orders.id, order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order_id));
    const now = new Date().toISOString();

    // Check which promos this customer already used on other orders
    const existingPromoUsages = new Set();
    if (order.customerId) {
      const usages = await db.select().from(promotionUsages)
        .where(and(eq(promotionUsages.customerId, order.customerId), ne(promotionUsages.orderId, order.id)));
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    const activePromos = await db.select().from(promotions).where(
      and(eq(promotions.active, true),
        or(isNull(promotions.validFrom), lte(promotions.validFrom, now)),
        or(isNull(promotions.validUntil), gte(promotions.validUntil, now)))
    );

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
