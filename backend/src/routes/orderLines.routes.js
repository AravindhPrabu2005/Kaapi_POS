const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../db');
const { orders, orderLines, products, promotions, promotionUsages } = require('../db/schema');
const { eq, and, lte, gte, isNull, or, ne } = require('drizzle-orm');

const router = Router();
router.use(authenticate);

const addLineSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});

const updateLineSchema = z.object({
  quantity: z.number().int().positive(),
});

async function recalcOrderTotals(orderId) {
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const ordersTable = require('../db/schema').orders;
  const couponsTable = require('../db/schema').coupons;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return;

  let subtotal = 0;
  let promoDiscount = 0;

  for (const line of lines) {
    const lineTotal = parseFloat(line.lineTotal);
    subtotal += lineTotal + parseFloat(line.lineDiscount);
    promoDiscount += parseFloat(line.lineDiscount);
  }

  let couponDiscount = 0;
  if (order.couponId) {
    const [cp] = await db.select().from(couponsTable).where(eq(couponsTable.id, order.couponId)).limit(1);
    if (cp) {
      if (cp.discountType === 'percentage') {
        couponDiscount = subtotal * parseFloat(cp.discountValue) / 100;
      } else {
        couponDiscount = parseFloat(cp.discountValue);
      }
      couponDiscount = Math.min(couponDiscount, subtotal);
    }
  }

  const totalDiscount = promoDiscount + couponDiscount;
  const taxRate = 0.05;
  const tax = subtotal * taxRate;
  const total = subtotal + tax - totalDiscount;

  await db.update(ordersTable).set({
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    discount: totalDiscount.toFixed(2),
    total: Math.max(0, total).toFixed(2),
    updatedAt: new Date().toISOString(),
  }).where(eq(ordersTable.id, orderId));
}

router.post('/:order_id/lines', validate(addLineSchema), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const [product] = await db.select().from(products).where(eq(products.id, req.body.product_id)).limit(1);
    if (!product) return next(new NotFoundError('Product not found.'));

    const quantity = req.body.quantity;
    const unitPrice = parseFloat(product.price);
    const lineTotal = (unitPrice * quantity).toFixed(2);

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
    let lineDiscount = 0;
    let appliedPromotionId = null;
    for (const promo of activePromos) {
      if (promo.scope === 'product' && promo.productId === req.body.product_id && quantity >= promo.minQuantity && !existingPromoUsages.has(promo.id)) {
        if (promo.discountType === 'percentage') {
          lineDiscount = unitPrice * quantity * parseFloat(promo.discountValue) / 100;
        } else {
          lineDiscount = parseFloat(promo.discountValue);
        }
        appliedPromotionId = promo.id;
      }
    }

    const finalLineTotal = (unitPrice * quantity - lineDiscount).toFixed(2);

    const [line] = await db.insert(orderLines).values({
      orderId: req.params.order_id,
      productId: req.body.product_id,
      quantity,
      unitPrice: product.price,
      lineDiscount: lineDiscount.toFixed(2),
      appliedPromotionId,
      lineTotal: finalLineTotal,
    }).returning();

    // Record promotion usage
    if (order.customerId && appliedPromotionId) {
      await db.insert(promotionUsages).values({
        promotionId: appliedPromotionId, orderId: order.id, customerId: order.customerId,
      });
    }

    await recalcOrderTotals(req.params.order_id);

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);

    sendSuccess(res, {
      id: line.id,
      product: { id: product.id, name: product.name },
      quantity: line.quantity, unit_price: line.unitPrice,
      line_discount: line.lineDiscount, line_total: line.lineTotal,
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    }, null, 201);
  } catch (err) { next(err); }
});

router.patch('/:order_id/lines/:line_id', validate(updateLineSchema), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const [line] = await db.select().from(orderLines).where(and(
      eq(orderLines.id, req.params.line_id),
      eq(orderLines.orderId, req.params.order_id),
    )).limit(1);
    if (!line) return next(new NotFoundError('Order line not found.'));

    const quantity = req.body.quantity;
    const unitPrice = parseFloat(line.unitPrice);
    const now = new Date().toISOString();

    // Check this customer's existing promo usages on other orders
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
    let lineDiscount = 0;
    let appliedPromotionId = null;

    for (const promo of activePromos) {
      if (promo.scope === 'product' && promo.productId === line.productId && quantity >= promo.minQuantity && !existingPromoUsages.has(promo.id)) {
        if (promo.discountType === 'percentage') {
          lineDiscount = unitPrice * quantity * parseFloat(promo.discountValue) / 100;
        } else {
          lineDiscount = parseFloat(promo.discountValue);
        }
        appliedPromotionId = promo.id;
      }
    }

    const lineTotal = (unitPrice * quantity - lineDiscount).toFixed(2);

    // Clean up old promotion usage for this line, then record new one
    if (order.customerId && line.appliedPromotionId) {
      await db.delete(promotionUsages).where(
        and(eq(promotionUsages.promotionId, line.appliedPromotionId),
          eq(promotionUsages.orderId, order.id),
          eq(promotionUsages.customerId, order.customerId))
      );
    }
    if (order.customerId && appliedPromotionId) {
      await db.insert(promotionUsages).values({
        promotionId: appliedPromotionId, orderId: order.id, customerId: order.customerId,
      });
    }

    const [updatedLine] = await db.update(orderLines).set({
      quantity,
      lineDiscount: lineDiscount.toFixed(2),
      appliedPromotionId,
      lineTotal,
    }).where(eq(orderLines.id, req.params.line_id)).returning();

    await recalcOrderTotals(req.params.order_id);

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);

    let productData = null;
    const [p] = await db.select().from(products).where(eq(products.id, updatedLine.productId)).limit(1);
    if (p) productData = { id: p.id, name: p.name };

    let promoData = null;
    if (updatedLine.appliedPromotionId) {
      const [pr] = await db.select().from(promotions).where(eq(promotions.id, updatedLine.appliedPromotionId)).limit(1);
      if (pr) promoData = { id: pr.id, name: pr.name };
    }

    sendSuccess(res, {
      id: updatedLine.id, product: productData,
      quantity: updatedLine.quantity, unit_price: updatedLine.unitPrice,
      line_discount: updatedLine.lineDiscount, applied_promotion: promoData,
      line_total: updatedLine.lineTotal,
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    });
  } catch (err) { next(err); }
});

router.delete('/:order_id/lines/:line_id', async (req, res, next) => {
  try {
    const [line] = await db.select().from(orderLines).where(and(
      eq(orderLines.id, req.params.line_id),
      eq(orderLines.orderId, req.params.order_id),
    )).limit(1);
    if (!line) return next(new NotFoundError('Order line not found.'));

    if (line.appliedPromotionId) {
      await db.delete(promotionUsages).where(
        and(eq(promotionUsages.orderId, req.params.order_id),
          eq(promotionUsages.promotionId, line.appliedPromotionId))
      );
    }

    await db.delete(orderLines).where(eq(orderLines.id, req.params.line_id));
    await recalcOrderTotals(req.params.order_id);

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);

    sendSuccess(res, {
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
