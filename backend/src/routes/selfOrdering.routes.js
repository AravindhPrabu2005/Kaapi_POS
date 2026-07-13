const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { db } = require('../db');
const { selfOrderingSettings, tables, floors, products, categories, orderLines, kdsTickets, kdsTicketItems, orders, couponUsages, promotionUsages } = require('../db/schema');

const router = Router();

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(['online_ordering', 'qr_menu']).optional(),
  background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  background_image_url: z.string().optional(),
});

const placeOrderSchema = z.object({
  table_id: z.string().uuid(),
  customer: z.object({
    name: z.string().min(1).max(255),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
  }),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
  coupon_code: z.string().optional(),
});

router.get('/settings', async (_req, res, next) => {
  try {
    let settings = await db.collection(selfOrderingSettings.tableName).findOne({});
    if (!settings) {
      settings = {
        id: 1,
        enabled: false,
        mode: 'online_ordering',
        backgroundColor: '#FBF3E7',
        backgroundImageUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(selfOrderingSettings.tableName).insertOne(settings);
    }
    sendSuccess(res, {
      enabled: settings.enabled, mode: settings.mode,
      background_color: settings.backgroundColor, background_image_url: settings.backgroundImageUrl,
    });
  } catch (err) { next(err); }
});

router.put('/settings', authenticate, requireRole('admin'), validate(updateSettingsSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.mode) updates.mode = req.body.mode;
    if (req.body.background_color) updates.backgroundColor = req.body.background_color;
    if (req.body.background_image_url !== undefined) updates.backgroundImageUrl = req.body.background_image_url;

    await db.collection(selfOrderingSettings.tableName).updateOne(
      {},
      { $set: updates }
    );
    const settings = await db.collection(selfOrderingSettings.tableName).findOne({});
    sendSuccess(res, {
      enabled: settings.enabled, mode: settings.mode,
      background_color: settings.backgroundColor, background_image_url: settings.backgroundImageUrl,
      updated_at: settings.updatedAt,
    });
  } catch (err) { next(err); }
});

router.get('/resolve/:unique_token', async (req, res, next) => {
  try {
    const table = await db.collection(tables.tableName).findOne({ qrToken: req.params.unique_token });
    if (!table) return next(new NotFoundError('INVALID_QR_TOKEN', 'This QR code is no longer valid.'));

    let floorData = null;
    if (table.floorId) {
      const f = await db.collection(floors.tableName).findOne({ id: table.floorId });
      if (f) floorData = { id: f.id, name: f.name };
    }

    const settings = await db.collection(selfOrderingSettings.tableName).findOne({});

    sendSuccess(res, {
      table: { id: table.id, table_number: table.tableNumber, floor: floorData?.name || null },
      mode: settings?.mode || 'online_ordering',
      background_color: settings?.backgroundColor || '#FBF3E7',
      background_image_url: settings?.backgroundImageUrl || null,
      menu_url: `/self-ordering/menu?table_id=${table.id}`,
    });
  } catch (err) { next(err); }
});

router.get('/menu', async (req, res, next) => {
  try {
    const { table_id, search } = req.query;

    const catsCursor = await db.collection(categories.tableName).find({});
    const cats = await catsCursor.sort({ name: 1 }).toArray();
    const result = await Promise.all(cats.map(async (cat) => {
      const conditions = { categoryId: cat.id };
      if (search) conditions.name = { $regex: search, $options: 'i' };
      const prodsCursor = await db.collection(products.tableName).find(conditions);
      const prods = await prodsCursor.toArray();
      return {
        id: cat.id, name: cat.name, color: cat.color,
        products: prods.map((p) => ({
          id: p.id, name: p.name, price: p.price, description: p.description, image_url: p.imageUrl,
        })),
      };
    }));

    sendSuccess(res, { categories: result });
  } catch (err) { next(err); }
});

router.post('/orders', validate(placeOrderSchema), async (req, res, next) => {
  try {
    const settings = await db.collection(selfOrderingSettings.tableName).findOne({});
    if (settings && settings.mode !== 'online_ordering') {
      return next(new ForbiddenError('ORDERING_DISABLED', 'Self ordering is currently set to QR Menu mode; placing orders is not available.'));
    }

    const { table_id, customer, items, coupon_code } = req.body;

    const session = await db.collection(require('../db/schema').sessions.tableName).findOne({ status: 'open' });
    if (!session) return next(new (require('../utils/errors').ConflictError)('INVALID_STATE', 'No active session.'));

    const { customers: customerModel, coupons, orders: ordersModel } = require('../db/schema');

    let customerId = null;
    if (customer.email) {
      const existing = await db.collection(customerModel.tableName).findOne({ email: customer.email });
      if (existing) {
        customerId = existing.id;
      } else {
        const newC = {
          id: require('crypto').randomUUID(),
          name: customer.name,
          email: customer.email,
          phone: customer.phone || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.collection(customerModel.tableName).insertOne(newC);
        customerId = newC.id;
      }
    } else if (customer.phone) {
      const existing = await db.collection(customerModel.tableName).findOne({ phone: customer.phone });
      if (existing) {
        customerId = existing.id;
      } else {
        const newC = {
          id: require('crypto').randomUUID(),
          name: customer.name,
          phone: customer.phone,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.collection(customerModel.tableName).insertOne(newC);
        customerId = newC.id;
      }
    } else {
      const newC = {
        id: require('crypto').randomUUID(),
        name: customer.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(customerModel.tableName).insertOne(newC);
      customerId = newC.id;
    }

    const orderNumber = `#${Date.now().toString().slice(-6)}`;
    const order = {
      id: require('crypto').randomUUID(),
      orderNumber,
      tableId: table_id,
      customerId,
      sessionId: session.id,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(ordersModel.tableName).insertOne(order);

    const now = new Date().toISOString();

    // Check which promos this customer already used on other orders
    const existingPromoUsages = new Set();
    if (customerId) {
      const usagesCursor = await db.collection(promotionUsages.tableName).find({ customerId });
      const usages = await usagesCursor.toArray();
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    const activePromosCursor = await db.collection(require('../db/schema').promotions.tableName).find({
      active: true,
      $and: [
        { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
        { $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }
      ]
    });
    const activePromos = await activePromosCursor.toArray();
    let rawSubtotal = 0;
    let totalLineDiscount = 0;
    const appliedPromotions = new Set();

    for (const item of items) {
      const product = await db.collection(products.tableName).findOne({ id: item.product_id });
      if (!product) continue;

      const unitPrice = parseFloat(product.price);
      const lineQty = item.quantity;
      rawSubtotal += unitPrice * lineQty;

      let lineDiscount = 0;
      let appliedPromotionId = null;
      for (const promo of activePromos) {
        if (promo.scope === 'product' && promo.productId === item.product_id && lineQty >= promo.minQuantity && !existingPromoUsages.has(promo.id)) {
          if (promo.discountType === 'percentage') {
            lineDiscount = unitPrice * lineQty * parseFloat(promo.discountValue) / 100;
          } else {
            lineDiscount = parseFloat(promo.discountValue);
          }
          appliedPromotionId = promo.id;
        }
      }

      totalLineDiscount += lineDiscount;
      const lineTotal = (unitPrice * lineQty - lineDiscount).toFixed(2);

      await db.collection(orderLines.tableName).insertOne({
        id: require('crypto').randomUUID(),
        orderId: order.id,
        productId: item.product_id,
        quantity: lineQty,
        unitPrice: product.price,
        lineDiscount: lineDiscount.toFixed(2),
        appliedPromotionId,
        lineTotal,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (appliedPromotionId) appliedPromotions.add(appliedPromotionId);
    }

    let orderPromoDiscount = 0;
    for (const promo of activePromos) {
      if (promo.scope === 'order' && promo.minOrderAmount && rawSubtotal >= parseFloat(promo.minOrderAmount) && !existingPromoUsages.has(promo.id)) {
        if (promo.discountType === 'percentage') {
          orderPromoDiscount = rawSubtotal * parseFloat(promo.discountValue) / 100;
        } else {
          orderPromoDiscount = parseFloat(promo.discountValue);
        }
        appliedPromotions.add(promo.id);
      }
    }

    let couponDiscount = 0;
    let couponId = null;
    if (coupon_code) {
      const { coupons: couponsModel } = require('../db/schema');
      const now = new Date().toISOString();
      const cp = await db.collection(couponsModel.tableName).findOne({
        code: coupon_code,
        active: true,
        $and: [
          { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
          { $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }
        ]
      });
      if (cp) {
        if (cp.maxUses && cp.redemptionCount >= cp.maxUses) {
          return next(new NotFoundError('COUPON_EXHAUSTED', 'This coupon has reached its maximum usage limit.'));
        }
        if (customerId) {
          const existingUsage = await db.collection(couponUsages.tableName).findOne({
            couponId: cp.id,
            customerId
          });
          if (existingUsage) {
            return next(new NotFoundError('COUPON_ALREADY_USED', 'This coupon has already been used by this customer.'));
          }
        }
        if (cp.discountType === 'percentage') {
          couponDiscount = rawSubtotal * parseFloat(cp.discountValue) / 100;
        } else {
          couponDiscount = parseFloat(cp.discountValue);
        }
        couponDiscount = Math.min(couponDiscount, rawSubtotal);
        couponId = cp.id;
        await db.collection(couponsModel.tableName).updateOne(
          { id: cp.id },
          { $set: { redemptionCount: cp.redemptionCount + 1 } }
        );
      }
    }

    const totalDiscount = totalLineDiscount + orderPromoDiscount + couponDiscount;
    const taxRate = 0.05;
    const tax = rawSubtotal * taxRate;
    const total = Math.max(0, rawSubtotal + tax - totalDiscount);

    await db.collection(ordersModel.tableName).updateOne(
      { id: order.id },
      {
        $set: {
          subtotal: rawSubtotal.toFixed(2),
          tax: tax.toFixed(2),
          discount: totalDiscount.toFixed(2),
          total: total.toFixed(2),
          couponId,
          updatedAt: new Date().toISOString(),
        }
      }
    );

    if (couponId && customerId) {
      await db.collection(couponUsages.tableName).insertOne({
        id: require('crypto').randomUUID(),
        couponId,
        orderId: order.id,
        customerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (customerId && appliedPromotions.size > 0) {
      const values = [];
      for (const promoId of appliedPromotions) {
        values.push({
          id: require('crypto').randomUUID(),
          promotionId: promoId,
          orderId: order.id,
          customerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      if (values.length > 0) await db.collection(promotionUsages.tableName).insertMany(values);
    }

    const kt = {
      id: require('crypto').randomUUID(),
      orderId: order.id,
      ticketNumber: orderNumber,
      stage: 'to_cook',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection(kdsTickets.tableName).insertOne(kt);

    for (const item of items) {
      const p = await db.collection(products.tableName).findOne({ id: item.product_id });
      if (!p) continue;
      await db.collection(kdsTicketItems.tableName).insertOne({
        id: require('crypto').randomUUID(),
        ticketId: kt.id,
        productId: item.product_id,
        productName: p.name,
        quantity: item.quantity,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const updatedOrder = await db.collection(ordersModel.tableName).findOne({ id: order.id });

    sendSuccess(res, {
      order_id: updatedOrder.id, order_number: updatedOrder.orderNumber, status: 'draft',
      subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
      discount: updatedOrder.discount, total: updatedOrder.total,
      sent_to_kitchen: true,
      kds_ticket: { id: kt.id, stage: 'to_cook' },
      created_at: updatedOrder.createdAt,
    }, null, 201);
  } catch (err) { next(err); }
});

router.get('/orders/:order_id/status', async (req, res, next) => {
  try {
    const { orders: ordersModel } = require('../db/schema');
    const order = await db.collection(ordersModel.tableName).findOne({ id: req.params.order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    const ticket = await db.collection(kdsTickets.tableName).findOne({ orderId: order.id });

    sendSuccess(res, {
      order_id: order.id, order_number: order.orderNumber,
      stage: ticket?.stage || 'unknown', updated_at: ticket?.updatedAt || order.updatedAt,
    });
  } catch (err) { next(err); }
});

router.get('/orders/history', async (req, res, next) => {
  try {
    const { table_id } = req.query;
    const { orders: ordersModel } = require('../db/schema');

    const filter = { tableId: table_id };
    const cursor = await db.collection(ordersModel.tableName).find(filter);
    const data = await cursor.sort({ createdAt: -1 }).limit(20).toArray();

    sendSuccess(res, data.map((o) => ({
      order_id: o.id, order_number: o.orderNumber, status: o.status,
      total: o.total, created_at: o.createdAt,
    })), { page: 1, page_size: 20, total_count: data.length, total_pages: 1 });
  } catch (err) { next(err); }
});

module.exports = router;
