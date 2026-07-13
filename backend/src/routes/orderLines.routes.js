const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../db');
const { orders, orderLines, products, promotions, promotionUsages } = require('../db/schema');
const { randomUUID: uuidv4 } = require('crypto');

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
  const lines = await (await db.collection(orderLines.tableName).find({ orderId })).toArray();
  const ordersTable = require('../db/schema').orders;
  const couponsTable = require('../db/schema').coupons;
  const order = await db.collection(ordersTable.tableName).findOne({ id: orderId });
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
    const cp = await db.collection(couponsTable.tableName).findOne({ id: order.couponId });
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

  await db.collection(ordersTable.tableName).updateOne(
    { id: orderId },
    {
      $set: {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: totalDiscount.toFixed(2),
        total: Math.max(0, total).toFixed(2),
        updatedAt: new Date().toISOString(),
      }
    }
  );
}

router.post('/:order_id/lines', validate(addLineSchema), async (req, res, next) => {
  try {
    const order = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    const product = await db.collection(products.tableName).findOne({ id: req.body.product_id });
    if (!product) return next(new NotFoundError('Product not found.'));

    const quantity = req.body.quantity;
    const unitPrice = parseFloat(product.price);
    const lineTotal = (unitPrice * quantity).toFixed(2);

    const now = new Date().toISOString();

    // Check which promos this customer already used on other orders
    const existingPromoUsages = new Set();
    if (order.customerId) {
      const usages = await (await db.collection(promotionUsages.tableName).find({
        customerId: order.customerId,
        orderId: { $ne: order.id }
      })).toArray();
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    const activePromos = await (await db.collection(promotions.tableName).find({
      active: true,
      $and: [
        { $or: [ { validFrom: null }, { validFrom: { $exists: false } }, { validFrom: { $lte: now } } ] },
        { $or: [ { validUntil: null }, { validUntil: { $exists: false } }, { validUntil: { $gte: now } } ] }
      ]
    })).toArray();

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

    const lineId = uuidv4();
    const lineDoc = {
      id: lineId,
      orderId: req.params.order_id,
      productId: req.body.product_id,
      quantity,
      unitPrice: product.price,
      lineDiscount: lineDiscount.toFixed(2),
      appliedPromotionId,
      lineTotal: finalLineTotal,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(orderLines.tableName).insertOne(lineDoc);

    // Record promotion usage
    if (order.customerId && appliedPromotionId) {
      await db.collection(promotionUsages.tableName).insertOne({
        id: uuidv4(),
        promotionId: appliedPromotionId,
        orderId: order.id,
        customerId: order.customerId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recalcOrderTotals(req.params.order_id);

    const updatedOrder = await db.collection(orders.tableName).findOne({ id: req.params.order_id });

    sendSuccess(res, {
      id: lineDoc.id,
      product: { id: product.id, name: product.name },
      quantity: lineDoc.quantity, unit_price: lineDoc.unitPrice,
      line_discount: lineDoc.lineDiscount, line_total: lineDoc.lineTotal,
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    }, null, 201);
  } catch (err) { next(err); }
});

router.patch('/:order_id/lines/:line_id', validate(updateLineSchema), async (req, res, next) => {
  try {
    const order = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    const line = await db.collection(orderLines.tableName).findOne({
      id: req.params.line_id,
      orderId: req.params.order_id,
    });
    if (!line) return next(new NotFoundError('Order line not found.'));

    const quantity = req.body.quantity;
    const unitPrice = parseFloat(line.unitPrice);
    const now = new Date().toISOString();

    // Check this customer's existing promo usages on other orders
    const existingPromoUsages = new Set();
    if (order.customerId) {
      const usages = await (await db.collection(promotionUsages.tableName).find({
        customerId: order.customerId,
        orderId: { $ne: order.id }
      })).toArray();
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    const activePromos = await (await db.collection(promotions.tableName).find({
      active: true,
      $and: [
        { $or: [ { validFrom: null }, { validFrom: { $exists: false } }, { validFrom: { $lte: now } } ] },
        { $or: [ { validUntil: null }, { validUntil: { $exists: false } }, { validUntil: { $gte: now } } ] }
      ]
    })).toArray();

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
      await db.collection(promotionUsages.tableName).deleteMany({
        promotionId: line.appliedPromotionId,
        orderId: order.id,
        customerId: order.customerId,
      });
    }
    if (order.customerId && appliedPromotionId) {
      await db.collection(promotionUsages.tableName).insertOne({
        id: uuidv4(),
        promotionId: appliedPromotionId,
        orderId: order.id,
        customerId: order.customerId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.collection(orderLines.tableName).updateOne(
      { id: req.params.line_id },
      {
        $set: {
          quantity,
          lineDiscount: lineDiscount.toFixed(2),
          appliedPromotionId,
          lineTotal,
          updatedAt: now,
        }
      }
    );
    const updatedLine = await db.collection(orderLines.tableName).findOne({ id: req.params.line_id });

    await recalcOrderTotals(req.params.order_id);

    const updatedOrder = await db.collection(orders.tableName).findOne({ id: req.params.order_id });

    let productData = null;
    const p = await db.collection(products.tableName).findOne({ id: updatedLine.productId });
    if (p) productData = { id: p.id, name: p.name };

    let promoData = null;
    if (updatedLine.appliedPromotionId) {
      const pr = await db.collection(promotions.tableName).findOne({ id: updatedLine.appliedPromotionId });
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
    const line = await db.collection(orderLines.tableName).findOne({
      id: req.params.line_id,
      orderId: req.params.order_id,
    });
    if (!line) return next(new NotFoundError('Order line not found.'));

    if (line.appliedPromotionId) {
      await db.collection(promotionUsages.tableName).deleteMany({
        orderId: req.params.order_id,
        promotionId: line.appliedPromotionId,
      });
    }

    await db.collection(orderLines.tableName).deleteOne({ id: req.params.line_id });
    await recalcOrderTotals(req.params.order_id);

    const updatedOrder = await db.collection(orders.tableName).findOne({ id: req.params.order_id });

    sendSuccess(res, {
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
