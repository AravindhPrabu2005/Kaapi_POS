const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { sendSuccess } = require('../utils/response');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { db } = require('../db');
const { selfOrderingSettings, tables, floors, products, categories, orderLines, kdsTickets, kdsTicketItems, orders, couponUsages, promotionUsages } = require('../db/schema');
const { eq, and, like, desc, sql, lte, gte, isNull, or } = require('drizzle-orm');

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
    let [settings] = await db.select().from(selfOrderingSettings).limit(1);
    if (!settings) {
      [settings] = await db.insert(selfOrderingSettings).values({}).returning();
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

    const [settings] = await db.update(selfOrderingSettings).set(updates).where(eq(selfOrderingSettings.id, 1)).returning();
    sendSuccess(res, {
      enabled: settings.enabled, mode: settings.mode,
      background_color: settings.backgroundColor, background_image_url: settings.backgroundImageUrl,
      updated_at: settings.updatedAt,
    });
  } catch (err) { next(err); }
});

router.get('/resolve/:unique_token', async (req, res, next) => {
  try {
    const [table] = await db.select().from(tables).where(eq(tables.qrToken, req.params.unique_token)).limit(1);
    if (!table) return next(new NotFoundError('INVALID_QR_TOKEN', 'This QR code is no longer valid.'));

    let floorData = null;
    if (table.floorId) {
      const [f] = await db.select().from(floors).where(eq(floors.id, table.floorId)).limit(1);
      if (f) floorData = { id: f.id, name: f.name };
    }

    const [settings] = await db.select().from(selfOrderingSettings).limit(1);

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

    const cats = await db.select().from(categories).orderBy(categories.name);
    const result = await Promise.all(cats.map(async (cat) => {
      const conditions = [eq(products.categoryId, cat.id)];
      if (search) conditions.push(like(products.name, `%${search}%`));
      const prods = await db.select().from(products).where(and(...conditions));
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
    const [settings] = await db.select().from(selfOrderingSettings).limit(1);
    if (settings && settings.mode !== 'online_ordering') {
      return next(new ForbiddenError('ORDERING_DISABLED', 'Self ordering is currently set to QR Menu mode; placing orders is not available.'));


    }

    const { table_id, customer, items, coupon_code } = req.body;

    const [session] = await db.select().from(require('../db/schema').sessions).where(eq(require('../db/schema').sessions.status, 'open')).limit(1);
    if (!session) return next(new (require('../utils/errors').ConflictError)('INVALID_STATE', 'No active session.'));

    const { customers: customerModel, coupons, orders: ordersModel } = require('../db/schema');

    let customerId = null;
    if (customer.email) {
      const [existing] = await db.select().from(customerModel).where(eq(customerModel.email, customer.email)).limit(1);
      if (existing) {
        customerId = existing.id;
      } else {
        const [newC] = await db.insert(customerModel).values({ name: customer.name, email: customer.email, phone: customer.phone || null }).returning();
        customerId = newC.id;
      }
    } else if (customer.phone) {
      const [existing] = await db.select().from(customerModel).where(eq(customerModel.phone, customer.phone)).limit(1);
      if (existing) {
        customerId = existing.id;
      } else {
        const [newC] = await db.insert(customerModel).values({ name: customer.name, phone: customer.phone }).returning();
        customerId = newC.id;
      }
    } else {
      const [newC] = await db.insert(customerModel).values({ name: customer.name }).returning();
      customerId = newC.id;
    }

    const orderNumber = `#${Date.now().toString().slice(-6)}`;
    const [order] = await db.insert(ordersModel).values({
      orderNumber, tableId: table_id, customerId, sessionId: session.id, status: 'draft',
    }).returning();

    const now = new Date().toISOString();

    // Check which promos this customer already used on other orders
    const existingPromoUsages = new Set();
    if (customerId) {
      const usages = await db.select().from(promotionUsages).where(eq(promotionUsages.customerId, customerId));
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    const activePromos = await db.select().from(require('../db/schema').promotions).where(
      and(eq(require('../db/schema').promotions.active, true),
        or(isNull(require('../db/schema').promotions.validFrom), lte(require('../db/schema').promotions.validFrom, now)),
        or(isNull(require('../db/schema').promotions.validUntil), gte(require('../db/schema').promotions.validUntil, now)))
    );
    let rawSubtotal = 0;
    let totalLineDiscount = 0;
    const appliedPromotions = new Set();

    for (const item of items) {
      const [product] = await db.select().from(products).where(eq(products.id, item.product_id)).limit(1);
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

      await db.insert(orderLines).values({
        orderId: order.id, productId: item.product_id, quantity: lineQty,
        unitPrice: product.price, lineDiscount: lineDiscount.toFixed(2),
        appliedPromotionId, lineTotal,
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
      const [cp] = await db.select().from(couponsModel).where(
        and(eq(couponsModel.code, coupon_code), eq(couponsModel.active, true),
          or(isNull(couponsModel.validFrom), lte(couponsModel.validFrom, now)),
          or(isNull(couponsModel.validUntil), gte(couponsModel.validUntil, now)))
      ).limit(1);
      if (cp) {
        if (cp.maxUses && cp.redemptionCount >= cp.maxUses) {
          return next(new NotFoundError('COUPON_EXHAUSTED', 'This coupon has reached its maximum usage limit.'));
        }
        if (customerId) {
          const [existingUsage] = await db.select().from(couponUsages)
            .where(and(eq(couponUsages.couponId, cp.id), eq(couponUsages.customerId, customerId)))
            .limit(1);
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
        await db.update(couponsModel).set({
          redemptionCount: cp.redemptionCount + 1,
        }).where(eq(couponsModel.id, cp.id));
      }
    }

    const totalDiscount = totalLineDiscount + orderPromoDiscount + couponDiscount;
    const taxRate = 0.05;
    const tax = rawSubtotal * taxRate;
    const total = Math.max(0, rawSubtotal + tax - totalDiscount);

    await db.update(ordersModel).set({
      subtotal: rawSubtotal.toFixed(2), tax: tax.toFixed(2),
      discount: totalDiscount.toFixed(2), total: total.toFixed(2),
      couponId, updatedAt: new Date().toISOString(),
    }).where(eq(ordersModel.id, order.id));

    if (couponId && customerId) {
      await db.insert(couponUsages).values({
        couponId, orderId: order.id, customerId,
      });
    }

    if (customerId && appliedPromotions.size > 0) {
      const values = [];
      for (const promoId of appliedPromotions) {
        values.push({ promotionId: promoId, orderId: order.id, customerId });
      }
      if (values.length > 0) await db.insert(promotionUsages).values(values);
    }

    const [kt] = await db.insert(kdsTickets).values({
      orderId: order.id, ticketNumber: orderNumber, stage: 'to_cook',
    }).returning();

    for (const item of items) {
      const [p] = await db.select().from(products).where(eq(products.id, item.product_id)).limit(1);
      if (!p) continue;
      await db.insert(kdsTicketItems).values({
        ticketId: kt.id, productId: item.product_id,
        productName: p.name, quantity: item.quantity, completed: false,
      });
    }

    const [updatedOrder] = await db.select().from(ordersModel).where(eq(ordersModel.id, order.id)).limit(1);

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
    const [order] = await db.select().from(ordersModel).where(eq(ordersModel.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const [ticket] = await db.select().from(kdsTickets).where(eq(kdsTickets.orderId, order.id)).limit(1);

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

    const conditions = [eq(ordersModel.tableId, table_id)];
    const data = await db.select().from(ordersModel).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(ordersModel.createdAt)).limit(20);

    sendSuccess(res, data.map((o) => ({
      order_id: o.id, order_number: o.orderNumber, status: o.status,
      total: o.total, created_at: o.createdAt,
    })), { page: 1, page_size: 20, total_count: data.length, total_pages: 1 });
  } catch (err) { next(err); }
});

module.exports = router;
