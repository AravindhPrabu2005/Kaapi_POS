const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { orders, tables, customers, users, sessions, orderLines, products, categories, kdsTickets, kdsTicketItems, coupons, couponUsages, promotions, promotionUsages, payments } = require('../db/schema');
const { eq, and, or, like, desc, sql, lte, gte, isNull, ne } = require('drizzle-orm');

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  table_id: z.string().uuid().nullable().optional(),
});

const patchSchema = z.object({
  customer_id: z.string().uuid().optional(),
});

const cancelSchema = z.object({
  reason: z.string().optional(),
});

const sendReceiptSchema = z.object({
  email: z.string().email(),
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { session_id, status, search, table_id } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const conditions = [];
    if (session_id) conditions.push(eq(orders.sessionId, session_id));
    if (status) conditions.push(eq(orders.status, status));
    if (table_id) conditions.push(eq(orders.tableId, table_id));
    if (search) {
      conditions.push(or(
        like(orders.orderNumber, `%${search}%`),
        sql`${orders.createdAt}::text LIKE ${`%${search}%`}`
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(orders).where(where).limit(pageSize).offset(offset).orderBy(desc(orders.createdAt)),
      db.select({ count: sql`count(*)` }).from(orders).where(where),
    ]);

    const result = await Promise.all(data.map(async (o) => {
      let tableData = null;
      if (o.tableId) {
        const [t] = await db.select().from(tables).where(eq(tables.id, o.tableId)).limit(1);
        if (t) tableData = { id: t.id, table_number: t.tableNumber };
      }
      let customerData = null;
      if (o.customerId) {
        const [c] = await db.select().from(customers).where(eq(customers.id, o.customerId)).limit(1);
        if (c) customerData = { id: c.id, name: c.name };
      }
      let paymentData = null;
      const [payment] = await db.select().from(payments).where(eq(payments.orderId, o.id)).limit(1);
      if (payment && payment.status === 'confirmed') paymentData = { method: payment.method, amount: payment.amount };
      return {
        id: o.id, order_number: o.orderNumber, status: o.status,
        table: tableData, customer: customerData,
        payment: paymentData,
        subtotal: o.subtotal, tax: o.tax, discount: o.discount, total: o.total,
        created_at: o.createdAt,
      };
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: parseInt(count, 10) });
  } catch (err) { next(err); }
});

router.get('/:order_id', async (req, res, next) => {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!o) return next(new NotFoundError('Order not found.'));

    let tableData = null;
    if (o.tableId) {
      const [t] = await db.select().from(tables).where(eq(tables.id, o.tableId)).limit(1);
      if (t) {
        const [f] = await db.select().from(require('../db/schema').floors).where(eq(require('../db/schema').floors.id, t.floorId)).limit(1);
        tableData = { id: t.id, table_number: t.tableNumber, floor: f ? f.name : null };
      }
    }

    let customerData = null;
    if (o.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, o.customerId)).limit(1);
      if (c) customerData = { id: c.id, name: c.name, email: c.email };
    }

    let employeeData = null;
    if (o.employeeId) {
      const [u] = await db.select().from(users).where(eq(users.id, o.employeeId)).limit(1);
      if (u) employeeData = { id: u.id, name: u.name };
    }

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, o.id));
    const lineData = await Promise.all(lines.map(async (l) => {
      let productData = null;
      if (l.productId) {
        const [p] = await db.select().from(products).where(eq(products.id, l.productId)).limit(1);
        if (p) productData = { id: p.id, name: p.name };
      }
      let promoData = null;
      if (l.appliedPromotionId) {
        const [pr] = await db.select().from(require('../db/schema').promotions).where(eq(require('../db/schema').promotions.id, l.appliedPromotionId)).limit(1);
        if (pr) promoData = { id: pr.id, name: pr.name };
      }
      return {
        id: l.id, product: productData, quantity: l.quantity, unit_price: l.unitPrice,
        line_discount: l.lineDiscount, applied_promotion: promoData, line_total: l.lineTotal,
      };
    }));

    let couponData = null;
    if (o.couponId) {
      const [cp] = await db.select().from(coupons).where(eq(coupons.id, o.couponId)).limit(1);
      if (cp) couponData = { id: cp.id, code: cp.code, discount_type: cp.discountType, discount_value: cp.discountValue };
    }

    sendSuccess(res, {
      id: o.id, order_number: o.orderNumber, status: o.status,
      table: tableData, customer: customerData, employee: employeeData,
      session_id: o.sessionId, lines: lineData, coupon: couponData,
      subtotal: o.subtotal, tax: o.tax, discount: o.discount, total: o.total,
      created_at: o.createdAt, updated_at: o.updatedAt,
    });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { table_id } = req.body;

    const [session] = await db.select().from(sessions).where(eq(sessions.status, 'open')).limit(1);
    if (!session) return next(new ConflictError('INVALID_STATE', 'No active session. Open a session first.'));

    const orderNumber = `#${Date.now().toString().slice(-6)}`;

    const [order] = await db.insert(orders).values({
      orderNumber, tableId: table_id, employeeId: req.user.id,
      sessionId: session.id, status: 'draft',
    }).returning();

    sendSuccess(res, {
      id: order.id, order_number: order.orderNumber, status: 'draft',
      table: { id: table_id }, customer: null, lines: [],
      subtotal: '0.00', tax: '0.00', discount: '0.00', total: '0.00',
      created_at: order.createdAt,
    }, null, 201);
  } catch (err) { next(err); }
});

router.patch('/:order_id', validate(patchSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.customer_id) updates.customerId = req.body.customer_id;

    const [o] = await db.update(orders).set(updates).where(eq(orders.id, req.params.order_id)).returning();
    if (!o) return next(new NotFoundError('Order not found.'));

    let customerData = null;
    if (o.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, o.customerId)).limit(1);
      if (c) customerData = { id: c.id, name: c.name };
    }

    sendSuccess(res, { id: o.id, customer: customerData, updated_at: o.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:order_id', async (req, res, next) => {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!o) return next(new NotFoundError('Order not found.'));
    if (o.status !== 'draft') {
      return next(new ConflictError('INVALID_STATE', `Only Draft orders can be deleted. This order is ${o.status}.`));
    }

    await db.delete(orderLines).where(eq(orderLines.orderId, req.params.order_id));
    await db.delete(orders).where(eq(orders.id, req.params.order_id));
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:order_id/send-to-kitchen', async (req, res, next) => {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, o.id));

    const existingTickets = await db.select().from(kdsTickets).where(eq(kdsTickets.orderId, o.id)).orderBy(kdsTickets.sentAt);

    if (existingTickets.length > 0) {
      // Gather all items already tracked across all existing tickets
      const allExistingItems = [];
      for (const ticket of existingTickets) {
        const items = await db.select().from(kdsTicketItems).where(eq(kdsTicketItems.ticketId, ticket.id));
        allExistingItems.push(...items);
      }

      // Determine new/additional quantities not yet tracked
      const newLines = [];
      for (const line of lines) {
        const tracked = allExistingItems
          .filter((item) => item.productId === line.productId)
          .reduce((sum, item) => sum + item.quantity, 0);
        const untracked = line.quantity - tracked;
        if (untracked > 0) {
          newLines.push({ ...line, quantity: untracked });
        }
      }

      if (newLines.length === 0) {
        return sendSuccess(res, {
          order_id: o.id,
          kds_ticket: { id: existingTickets[0].id, ticket_number: existingTickets[0].ticketNumber, stage: existingTickets[0].stage, sent_at: existingTickets[0].sentAt },
        });
      }

      // Create a new ticket for the additional items
      const revNumber = existingTickets.length;
      const ticketNumber = `${o.orderNumber}-A${revNumber}`;
      const [ticket] = await db.insert(kdsTickets).values({
        orderId: o.id, ticketNumber, stage: 'to_cook',
      }).returning();

      for (const line of newLines) {
        let productName = 'Unknown';
        const [p] = await db.select().from(products).where(eq(products.id, line.productId)).limit(1);
        if (p) productName = p.name;

        await db.insert(kdsTicketItems).values({
          ticketId: ticket.id, productId: line.productId,
          productName, quantity: line.quantity, completed: false,
        });
      }

      sendSuccess(res, {
        order_id: o.id,
        kds_ticket: { id: ticket.id, ticket_number: ticket.ticketNumber, stage: ticket.stage, sent_at: ticket.sentAt },
      });
    } else {
      // First time — create initial ticket
      const [ticket] = await db.insert(kdsTickets).values({
        orderId: o.id, ticketNumber: o.orderNumber, stage: 'to_cook',
      }).returning();

      for (const line of lines) {
        let productName = 'Unknown';
        const [p] = await db.select().from(products).where(eq(products.id, line.productId)).limit(1);
        if (p) productName = p.name;

        await db.insert(kdsTicketItems).values({
          ticketId: ticket.id, productId: line.productId,
          productName, quantity: line.quantity, completed: false,
        });
      }

      sendSuccess(res, {
        order_id: o.id,
        kds_ticket: { id: ticket.id, ticket_number: ticket.ticketNumber, stage: ticket.stage, sent_at: ticket.sentAt },
      });
    }
  } catch (err) { next(err); }
});

router.post('/:order_id/cancel', validate(cancelSchema), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    // Reverse coupon usage
    if (order.couponId) {
      const [cp] = await db.select().from(coupons).where(eq(coupons.id, order.couponId)).limit(1);
      if (cp) {
        await db.update(coupons).set({
          redemptionCount: Math.max(0, cp.redemptionCount - 1),
        }).where(eq(coupons.id, order.couponId));
      }
      await db.delete(couponUsages).where(and(
        eq(couponUsages.couponId, order.couponId),
        eq(couponUsages.orderId, order.id),
      ));
    }

    // Clean up promotion usages
    await db.delete(promotionUsages).where(eq(promotionUsages.orderId, order.id));

    const [o] = await db.update(orders).set({
      status: 'cancelled', cancelledAt: new Date().toISOString(),
      cancelReason: req.body.reason || null, updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, req.params.order_id)).returning();

    sendSuccess(res, {
      id: o.id, status: 'cancelled', cancelled_at: o.cancelledAt, reason: o.cancelReason,
    });
  } catch (err) { next(err); }
});

router.post('/:order_id/apply-coupon', validate(z.object({ code: z.string().min(1).max(50) })), async (req, res, next) => {
  try {
    const { code } = req.body;

    const now = new Date().toISOString();
    const [coupon] = await db.select().from(coupons).where(
      and(eq(coupons.code, code), eq(coupons.active, true),
        or(isNull(coupons.validFrom), lte(coupons.validFrom, now)),
        or(isNull(coupons.validUntil), gte(coupons.validUntil, now)))
    ).limit(1);
    if (!coupon) return next(new (require('../utils/errors').NotFoundError)('INVALID_COUPON', 'Coupon code is invalid or inactive.'));

    if (coupon.maxUses && coupon.redemptionCount >= coupon.maxUses) {
      return next(new NotFoundError('COUPON_EXHAUSTED', 'This coupon has reached its maximum usage limit.'));
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    if (order.customerId) {
      const [existingUsage] = await db.select().from(couponUsages)
        .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.customerId, order.customerId)))
        .limit(1);
      if (existingUsage) {
        return next(new NotFoundError('COUPON_ALREADY_USED', 'This coupon has already been used by this customer.'));
      }
    }

    let couponDiscount = 0;
    if (coupon.discountType === 'percentage') {
      couponDiscount = parseFloat(order.subtotal) * parseFloat(coupon.discountValue) / 100;
    } else {
      couponDiscount = parseFloat(coupon.discountValue);
    }
    couponDiscount = Math.min(couponDiscount, parseFloat(order.subtotal));

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
    const promoDiscount = lines.reduce((sum, l) => sum + parseFloat(l.lineDiscount), 0);
    const totalDiscount = promoDiscount + couponDiscount;
    const subtotal = parseFloat(order.subtotal);
    const tax = parseFloat(order.tax);
    const total = subtotal + tax - totalDiscount;

    await db.update(orders).set({
      couponId: coupon.id,
      discount: totalDiscount.toFixed(2),
      total: Math.max(0, total).toFixed(2),
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, order.id));

    await db.update(coupons).set({
      redemptionCount: coupon.redemptionCount + 1,
    }).where(eq(coupons.id, coupon.id));

    await db.insert(couponUsages).values({
      couponId: coupon.id,
      orderId: order.id,
      customerId: order.customerId || null,
    });

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);

    sendSuccess(res, {
      id: updatedOrder.id, order_number: updatedOrder.orderNumber, status: updatedOrder.status,
      coupon: { id: coupon.id, code: coupon.code, discount_type: coupon.discountType, discount_value: coupon.discountValue },
      discount: updatedOrder.discount,
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    });
  } catch (err) { next(err); }
});

router.post('/:order_id/remove-coupon', async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    if (order.couponId) {
      await db.delete(couponUsages).where(and(eq(couponUsages.couponId, order.couponId), eq(couponUsages.orderId, order.id)));

      const [coupon] = await db.select().from(coupons).where(eq(coupons.id, order.couponId)).limit(1);
      if (coupon) {
        await db.update(coupons).set({
          redemptionCount: Math.max(0, coupon.redemptionCount - 1),
        }).where(eq(coupons.id, coupon.id));
      }
    }

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
    const promoDiscount = lines.reduce((sum, l) => sum + parseFloat(l.lineDiscount), 0);
    const subtotal = parseFloat(order.subtotal);
    const tax = parseFloat(order.tax);
    const total = subtotal + tax - promoDiscount;

    await db.update(orders).set({
      couponId: null,
      discount: promoDiscount.toFixed(2),
      total: Math.max(0, total).toFixed(2),
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, order.id));

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);

    sendSuccess(res, {
      id: updatedOrder.id, order_number: updatedOrder.orderNumber,
      coupon: null, discount: updatedOrder.discount,
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    });
  } catch (err) { next(err); }
});

router.post('/:order_id/evaluate-promotions', async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!order) return next(new NotFoundError('Order not found.'));

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
    const now = new Date().toISOString();
    const activePromos = await db.select().from(promotions).where(
      and(eq(promotions.active, true),
        or(isNull(promotions.validFrom), lte(promotions.validFrom, now)),
        or(isNull(promotions.validUntil), gte(promotions.validUntil, now)))
    );

    // Build set of promo IDs already used by this customer on other orders
    const existingPromoUsages = new Set();
    if (order.customerId) {
      const usages = await db.select().from(promotionUsages)
        .where(and(eq(promotionUsages.customerId, order.customerId), ne(promotionUsages.orderId, order.id)));
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    // Clear stale usage records for this order
    await db.delete(promotionUsages).where(eq(promotionUsages.orderId, order.id));

    const appliedPromotions = new Set();
    let totalLineDiscount = 0;

    for (const line of lines) {
      let lineDiscount = 0;
      let appliedPromotionId = null;

      for (const promo of activePromos) {
        if (promo.scope === 'product' && promo.productId === line.productId && line.quantity >= promo.minQuantity && !existingPromoUsages.has(promo.id)) {
          if (promo.discountType === 'percentage') {
            lineDiscount = parseFloat(line.unitPrice) * line.quantity * parseFloat(promo.discountValue) / 100;
          } else {
            lineDiscount = parseFloat(promo.discountValue);
          }
          appliedPromotionId = promo.id;
        }
      }

      const newLineTotal = (parseFloat(line.unitPrice) * line.quantity - lineDiscount).toFixed(2);

      await db.update(orderLines).set({
        lineDiscount: lineDiscount.toFixed(2),
        appliedPromotionId,
        lineTotal: parseFloat(newLineTotal) < 0 ? '0.00' : newLineTotal,
      }).where(eq(orderLines.id, line.id));

      if (appliedPromotionId) appliedPromotions.add(appliedPromotionId);
      totalLineDiscount += lineDiscount;
    }

    // Recalc totals
    const updatedLines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
    let subtotal = 0;
    for (const l of updatedLines) {
      subtotal += parseFloat(l.lineTotal) + parseFloat(l.lineDiscount);
    }
    let orderPromoDiscount = 0;
    for (const promo of activePromos) {
      if (promo.scope === 'order' && promo.minOrderAmount && subtotal >= parseFloat(promo.minOrderAmount) && !existingPromoUsages.has(promo.id)) {
        if (promo.discountType === 'percentage') {
          orderPromoDiscount = subtotal * parseFloat(promo.discountValue) / 100;
        } else {
          orderPromoDiscount = parseFloat(promo.discountValue);
        }
        appliedPromotions.add(promo.id);
      }
    }

    const tax = parseFloat(order.tax) || (subtotal * 0.05);
    let totalDiscount = totalLineDiscount + orderPromoDiscount;
    if (order.couponId) {
      const [cp] = await db.select().from(coupons).where(eq(coupons.id, order.couponId)).limit(1);
      if (cp) {
        let cd = 0;
        if (cp.discountType === 'percentage') cd = subtotal * parseFloat(cp.discountValue) / 100;
        else cd = parseFloat(cp.discountValue);
        totalDiscount += Math.min(cd, subtotal);
      }
    }
    const total = Math.max(0, subtotal + (typeof tax === 'number' ? tax : parseFloat(tax)) - totalDiscount);

    await db.update(orders).set({
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date().toISOString(),
    }).where(eq(orders.id, order.id));

    // Record promotion usages for newly applied promotions
    if (order.customerId && appliedPromotions.size > 0) {
      const values = [];
      for (const promoId of appliedPromotions) {
        values.push({ promotionId: promoId, orderId: order.id, customerId: order.customerId });
      }
      if (values.length > 0) await db.insert(promotionUsages).values(values);
    }

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);

    const lineResults = await Promise.all(updatedLines.map(async (l) => {
      const [p] = await db.select().from(products).where(eq(products.id, l.productId)).limit(1);
      let promoData = null;
      if (l.appliedPromotionId) {
        const [pr] = await db.select().from(promotions).where(eq(promotions.id, l.appliedPromotionId)).limit(1);
        if (pr) promoData = { id: pr.id, name: pr.name };
      }
      return {
        id: l.id, product: p ? { id: p.id, name: p.name } : null,
        quantity: l.quantity, unit_price: l.unitPrice,
        line_discount: l.lineDiscount, applied_promotion: promoData, line_total: l.lineTotal,
      };
    }));

    sendSuccess(res, {
      id: updatedOrder.id, order_number: updatedOrder.orderNumber, status: updatedOrder.status,
      lines: lineResults,
      order_totals: {
        subtotal: updatedOrder.subtotal, tax: updatedOrder.tax,
        discount: updatedOrder.discount, total: updatedOrder.total,
      },
    });
  } catch (err) { next(err); }
});

router.get('/:order_id/receipt', async (req, res, next) => {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, o.id));
    const items = await Promise.all(lines.map(async (l) => {
      let name = 'Unknown';
      const [p] = await db.select().from(products).where(eq(products.id, l.productId)).limit(1);
      if (p) name = p.name;
      return { name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal };
    }));

    const [payment] = await db.select().from(require('../db/schema').payments).where(eq(require('../db/schema').payments.orderId, o.id)).limit(1);

    sendSuccess(res, {
      order_number: o.orderNumber, date: o.createdAt,
      cafe_name: 'Odoo Cafe', items,
      subtotal: o.subtotal, tax: o.tax, discount: o.discount, total: o.total,
      payment_method: payment?.method || null,
    });
  } catch (err) { next(err); }
});

router.get('/:order_id/receipt-pdf', async (req, res, next) => {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, o.id));
    const items = await Promise.all(lines.map(async (l) => {
      let name = 'Unknown';
      const [p] = await db.select().from(products).where(eq(products.id, l.productId)).limit(1);
      if (p) name = p.name;
      return { name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal };
    }));

    const [payment] = await db.select().from(require('../db/schema').payments).where(eq(require('../db/schema').payments.orderId, o.id)).limit(1);

    let tableNumber = null;
    if (o.tableId) {
      const [tb] = await db.select().from(tables).where(eq(tables.id, o.tableId)).limit(1);
      if (tb) tableNumber = tb.tableNumber;
    }

    const pdfBuf = await require('../utils/receiptPdf').generateReceiptPdf({
      order_number: o.orderNumber,
      createdAt: o.createdAt,
      table_number: tableNumber,
      items,
      subtotal: o.subtotal,
      tax: o.tax,
      discount: o.discount,
      total: o.total,
      payment_method: payment?.method || null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${o.orderNumber.replace('#', '')}.pdf"`);
    res.send(pdfBuf);
  } catch (err) { next(err); }
});

router.post('/:order_id/send-receipt', validate(sendReceiptSchema), async (req, res, next) => {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, o.id));
    const items = await Promise.all(lines.map(async (l) => {
      let name = 'Unknown';
      const [p] = await db.select().from(products).where(eq(products.id, l.productId)).limit(1);
      if (p) name = p.name;
      return { name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal };
    }));

    const [payment] = await db.select().from(require('../db/schema').payments).where(eq(require('../db/schema').payments.orderId, o.id)).limit(1);

    let tableNumber = null;
    if (o.tableId) {
      const [tb] = await db.select().from(tables).where(eq(tables.id, o.tableId)).limit(1);
      if (tb) tableNumber = tb.tableNumber;
    }

    const pdfBuf = await require('../utils/receiptPdf').generateReceiptPdf({
      order_number: o.orderNumber,
      createdAt: o.createdAt,
      table_number: tableNumber,
      items,
      subtotal: o.subtotal,
      tax: o.tax,
      discount: o.discount,
      total: o.total,
      payment_method: payment?.method || null,
    });

    const env = require('../config/env');
    if (env.resendApiKey) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(env.resendApiKey);
        await resend.emails.send({
          from: 'Odoo Cafe <onboarding@resend.dev>',
          to: [req.body.email],
          subject: `Receipt - ${o.orderNumber}`,
          html: `<p>Thank you for your order!</p><p>Your receipt for ${o.orderNumber} is attached.</p><p>Regards,<br/>Odoo Cafe</p>`,
          attachments: [
            {
              filename: `receipt-${o.orderNumber.replace('#', '')}.pdf`,
              content: pdfBuf.toString('base64'),
            },
          ],
        });
      } catch (emailErr) {
        console.error('Send email error:', emailErr);
        const { sendError } = require('../utils/response');
        const { AppError } = require('../utils/errors');
        return sendError(res, new AppError(500, 'EMAIL_FAILED', 'Failed to send email.'));
      }
    }

    const { receipts } = require('../db/schema');
    await db.insert(receipts).values({
      orderId: o.id, email: req.body.email, sentAt: new Date().toISOString(),
    });

    sendSuccess(res, { message: `Receipt sent to ${req.body.email}.`, sent_at: new Date().toISOString() });
  } catch (err) { next(err); }
});

module.exports = router;
