const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { orders, tables, customers, users, sessions, orderLines, products, categories, kdsTickets, kdsTicketItems, coupons, couponUsages, promotions, promotionUsages, payments } = require('../db/schema');
const { randomUUID: uuidv4 } = require('crypto');

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

    const filter = {};
    if (session_id) filter.sessionId = session_id;
    if (status) filter.status = status;
    if (table_id) filter.tableId = table_id;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { createdAt: { $regex: search, $options: 'i' } }
      ];
    }

    const [data, count] = await Promise.all([
      (async () => {
        const cursor = await db.collection(orders.tableName).find(filter);
        return await cursor.sort({ createdAt: -1 }).skip(offset).limit(pageSize).toArray();
      })(),
      db.collection(orders.tableName).countDocuments(filter)
    ]);

    const result = await Promise.all(data.map(async (o) => {
      let tableData = null;
      if (o.tableId) {
        const t = await db.collection(tables.tableName).findOne({ id: o.tableId });
        if (t) tableData = { id: t.id, table_number: t.tableNumber };
      }
      let customerData = null;
      if (o.customerId) {
        const c = await db.collection(customers.tableName).findOne({ id: o.customerId });
        if (c) customerData = { id: c.id, name: c.name };
      }
      let paymentData = null;
      const payment = await db.collection(payments.tableName).findOne({ orderId: o.id });
      if (payment && payment.status === 'confirmed') paymentData = { method: payment.method, amount: payment.amount };
      return {
        id: o.id, order_number: o.orderNumber, status: o.status,
        table: tableData, customer: customerData,
        payment: paymentData,
        subtotal: o.subtotal, tax: o.tax, discount: o.discount, total: o.total,
        created_at: o.createdAt,
      };
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: count });
  } catch (err) { next(err); }
});

router.get('/:order_id', async (req, res, next) => {
  try {
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!o) return next(new NotFoundError('Order not found.'));

    let tableData = null;
    if (o.tableId) {
      const t = await db.collection(tables.tableName).findOne({ id: o.tableId });
      if (t) {
        const floorsTable = require('../db/schema').floors;
        const f = await db.collection(floorsTable.tableName).findOne({ id: t.floorId });
        tableData = { id: t.id, table_number: t.tableNumber, floor: f ? f.name : null };
      }
    }

    let customerData = null;
    if (o.customerId) {
      const c = await db.collection(customers.tableName).findOne({ id: o.customerId });
      if (c) customerData = { id: c.id, name: c.name, email: c.email };
    }

    let employeeData = null;
    if (o.employeeId) {
      const u = await db.collection(users.tableName).findOne({ id: o.employeeId });
      if (u) employeeData = { id: u.id, name: u.name };
    }

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: o.id })).toArray();
    const lineData = await Promise.all(lines.map(async (l) => {
      let productData = null;
      if (l.productId) {
        const p = await db.collection(products.tableName).findOne({ id: l.productId });
        if (p) productData = { id: p.id, name: p.name };
      }
      let promoData = null;
      if (l.appliedPromotionId) {
        const promotionsTable = require('../db/schema').promotions;
        const pr = await db.collection(promotionsTable.tableName).findOne({ id: l.appliedPromotionId });
        if (pr) promoData = { id: pr.id, name: pr.name };
      }
      return {
        id: l.id, product: productData, quantity: l.quantity, unit_price: l.unitPrice,
        line_discount: l.lineDiscount, applied_promotion: promoData, line_total: l.lineTotal,
      };
    }));

    let couponData = null;
    if (o.couponId) {
      const cp = await db.collection(coupons.tableName).findOne({ id: o.couponId });
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

    const session = await db.collection(sessions.tableName).findOne({ status: 'open' });
    if (!session) return next(new ConflictError('INVALID_STATE', 'No active session. Open a session first.'));

    const orderNumber = `#${Date.now().toString().slice(-6)}`;
    const orderId = uuidv4();
    const now = new Date().toISOString();

    const orderDoc = {
      id: orderId,
      orderNumber,
      tableId: table_id || null,
      employeeId: req.user.id,
      sessionId: session.id,
      status: 'draft',
      subtotal: '0.00',
      tax: '0.00',
      discount: '0.00',
      total: '0.00',
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(orders.tableName).insertOne(orderDoc);

    sendSuccess(res, {
      id: orderDoc.id, order_number: orderDoc.orderNumber, status: 'draft',
      table: { id: table_id }, customer: null, lines: [],
      subtotal: '0.00', tax: '0.00', discount: '0.00', total: '0.00',
      created_at: orderDoc.createdAt,
    }, null, 201);
  } catch (err) { next(err); }
});

router.patch('/:order_id', validate(patchSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.customer_id) updates.customerId = req.body.customer_id;

    await db.collection(orders.tableName).updateOne(
      { id: req.params.order_id },
      { $set: updates }
    );
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!o) return next(new NotFoundError('Order not found.'));

    let customerData = null;
    if (o.customerId) {
      const c = await db.collection(customers.tableName).findOne({ id: o.customerId });
      if (c) customerData = { id: c.id, name: c.name };
    }

    sendSuccess(res, { id: o.id, customer: customerData, updated_at: o.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:order_id', async (req, res, next) => {
  try {
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!o) return next(new NotFoundError('Order not found.'));
    if (o.status !== 'draft') {
      return next(new ConflictError('INVALID_STATE', `Only Draft orders can be deleted. This order is ${o.status}.`));
    }

    await db.collection(orderLines.tableName).deleteMany({ orderId: req.params.order_id });
    await db.collection(orders.tableName).deleteOne({ id: req.params.order_id });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:order_id/send-to-kitchen', async (req, res, next) => {
  try {
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: o.id })).toArray();

    const existingTicketsCursor = await db.collection(kdsTickets.tableName).find({ orderId: o.id });
    const existingTickets = await existingTicketsCursor.sort({ sentAt: 1 }).toArray();

    const now = new Date().toISOString();

    if (existingTickets.length > 0) {
      // Gather all items already tracked across all existing tickets
      const allExistingItems = [];
      for (const ticket of existingTickets) {
        const items = await (await db.collection(kdsTicketItems.tableName).find({ ticketId: ticket.id })).toArray();
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
      const ticketId = uuidv4();
      const ticketDoc = {
        id: ticketId,
        orderId: o.id,
        ticketNumber,
        stage: 'to_cook',
        sentAt: now,
        updatedAt: now,
      };
      await db.collection(kdsTickets.tableName).insertOne(ticketDoc);

      for (const line of newLines) {
        let productName = 'Unknown';
        const p = await db.collection(products.tableName).findOne({ id: line.productId });
        if (p) productName = p.name;

        await db.collection(kdsTicketItems.tableName).insertOne({
          id: uuidv4(),
          ticketId,
          productId: line.productId,
          productName,
          quantity: line.quantity,
          completed: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      sendSuccess(res, {
        order_id: o.id,
        kds_ticket: { id: ticketDoc.id, ticket_number: ticketDoc.ticketNumber, stage: ticketDoc.stage, sent_at: ticketDoc.sentAt },
      });
    } else {
      // First time — create initial ticket
      const ticketId = uuidv4();
      const ticketDoc = {
        id: ticketId,
        orderId: o.id,
        ticketNumber: o.orderNumber,
        stage: 'to_cook',
        sentAt: now,
        updatedAt: now,
      };
      await db.collection(kdsTickets.tableName).insertOne(ticketDoc);

      for (const line of lines) {
        let productName = 'Unknown';
        const p = await db.collection(products.tableName).findOne({ id: line.productId });
        if (p) productName = p.name;

        await db.collection(kdsTicketItems.tableName).insertOne({
          id: uuidv4(),
          ticketId,
          productId: line.productId,
          productName,
          quantity: line.quantity,
          completed: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      sendSuccess(res, {
        order_id: o.id,
        kds_ticket: { id: ticketDoc.id, ticket_number: ticketDoc.ticketNumber, stage: ticketDoc.stage, sent_at: ticketDoc.sentAt },
      });
    }
  } catch (err) { next(err); }
});

router.post('/:order_id/cancel', validate(cancelSchema), async (req, res, next) => {
  try {
    const order = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    // Reverse coupon usage
    if (order.couponId) {
      const cp = await db.collection(coupons.tableName).findOne({ id: order.couponId });
      if (cp) {
        await db.collection(coupons.tableName).updateOne(
          { id: order.couponId },
          { $set: { redemptionCount: Math.max(0, cp.redemptionCount - 1) } }
        );
      }
      await db.collection(couponUsages.tableName).deleteMany({
        couponId: order.couponId,
        orderId: order.id,
      });
    }

    // Clean up promotion usages
    await db.collection(promotionUsages.tableName).deleteMany({ orderId: order.id });

    const now = new Date().toISOString();
    await db.collection(orders.tableName).updateOne(
      { id: req.params.order_id },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: req.body.reason || null,
          updatedAt: now,
        }
      }
    );
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });

    sendSuccess(res, {
      id: o.id, status: 'cancelled', cancelled_at: o.cancelledAt, reason: o.cancelReason,
    });
  } catch (err) { next(err); }
});

router.post('/:order_id/apply-coupon', validate(z.object({ code: z.string().min(1).max(50) })), async (req, res, next) => {
  try {
    const { code } = req.body;

    const now = new Date().toISOString();
    const coupon = await db.collection(coupons.tableName).findOne({
      code,
      active: true,
      $and: [
        { $or: [ { validFrom: null }, { validFrom: { $exists: false } }, { validFrom: { $lte: now } } ] },
        { $or: [ { validUntil: null }, { validUntil: { $exists: false } }, { validUntil: { $gte: now } } ] }
      ]
    });
    if (!coupon) return next(new (require('../utils/errors').NotFoundError)('INVALID_COUPON', 'Coupon code is invalid or inactive.'));

    if (coupon.maxUses && coupon.redemptionCount >= coupon.maxUses) {
      return next(new NotFoundError('COUPON_EXHAUSTED', 'This coupon has reached its maximum usage limit.'));
    }

    const order = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    if (order.customerId) {
      const existingUsage = await db.collection(couponUsages.tableName).findOne({
        couponId: coupon.id,
        customerId: order.customerId,
      });
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

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: order.id })).toArray();
    const promoDiscount = lines.reduce((sum, l) => sum + parseFloat(l.lineDiscount), 0);
    const totalDiscount = promoDiscount + couponDiscount;
    const subtotal = parseFloat(order.subtotal);
    const tax = parseFloat(order.tax);
    const total = subtotal + tax - totalDiscount;

    await db.collection(orders.tableName).updateOne(
      { id: order.id },
      {
        $set: {
          couponId: coupon.id,
          discount: totalDiscount.toFixed(2),
          total: Math.max(0, total).toFixed(2),
          updatedAt: now,
        }
      }
    );

    await db.collection(coupons.tableName).updateOne(
      { id: coupon.id },
      { $set: { redemptionCount: coupon.redemptionCount + 1 } }
    );

    await db.collection(couponUsages.tableName).insertOne({
      id: uuidv4(),
      couponId: coupon.id,
      orderId: order.id,
      customerId: order.customerId || null,
      createdAt: now,
      updatedAt: now,
    });

    const updatedOrder = await db.collection(orders.tableName).findOne({ id: order.id });

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
    const order = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    if (order.couponId) {
      await db.collection(couponUsages.tableName).deleteMany({
        couponId: order.couponId,
        orderId: order.id,
      });

      const coupon = await db.collection(coupons.tableName).findOne({ id: order.couponId });
      if (coupon) {
        await db.collection(coupons.tableName).updateOne(
          { id: coupon.id },
          { $set: { redemptionCount: Math.max(0, coupon.redemptionCount - 1) } }
        );
      }
    }

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: order.id })).toArray();
    const promoDiscount = lines.reduce((sum, l) => sum + parseFloat(l.lineDiscount), 0);
    const subtotal = parseFloat(order.subtotal);
    const tax = parseFloat(order.tax);
    const total = subtotal + tax - promoDiscount;

    const now = new Date().toISOString();
    await db.collection(orders.tableName).updateOne(
      { id: order.id },
      {
        $set: {
          couponId: null,
          discount: promoDiscount.toFixed(2),
          total: Math.max(0, total).toFixed(2),
          updatedAt: now,
        }
      }
    );

    const updatedOrder = await db.collection(orders.tableName).findOne({ id: order.id });

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
    const order = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!order) return next(new NotFoundError('Order not found.'));

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: order.id })).toArray();
    const now = new Date().toISOString();

    const activePromos = await (await db.collection(promotions.tableName).find({
      active: true,
      $and: [
        { $or: [ { validFrom: null }, { validFrom: { $exists: false } }, { validFrom: { $lte: now } } ] },
        { $or: [ { validUntil: null }, { validUntil: { $exists: false } }, { validUntil: { $gte: now } } ] }
      ]
    })).toArray();

    // Build set of promo IDs already used by this customer on other orders
    const existingPromoUsages = new Set();
    if (order.customerId) {
      const usages = await (await db.collection(promotionUsages.tableName).find({
        customerId: order.customerId,
        orderId: { $ne: order.id }
      })).toArray();
      usages.forEach((u) => existingPromoUsages.add(u.promotionId));
    }

    // Clear stale usage records for this order
    await db.collection(promotionUsages.tableName).deleteMany({ orderId: order.id });

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

      await db.collection(orderLines.tableName).updateOne(
        { id: line.id },
        {
          $set: {
            lineDiscount: lineDiscount.toFixed(2),
            appliedPromotionId,
            lineTotal: parseFloat(newLineTotal) < 0 ? '0.00' : newLineTotal,
          }
        }
      );

      if (appliedPromotionId) appliedPromotions.add(appliedPromotionId);
      totalLineDiscount += lineDiscount;
    }

    // Recalc totals
    const updatedLines = await (await db.collection(orderLines.tableName).find({ orderId: order.id })).toArray();
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
      const cp = await db.collection(coupons.tableName).findOne({ id: order.couponId });
      if (cp) {
        let cd = 0;
        if (cp.discountType === 'percentage') cd = subtotal * parseFloat(cp.discountValue) / 100;
        else cd = parseFloat(cp.discountValue);
        totalDiscount += Math.min(cd, subtotal);
      }
    }
    const total = Math.max(0, subtotal + (typeof tax === 'number' ? tax : parseFloat(tax)) - totalDiscount);

    await db.collection(orders.tableName).updateOne(
      { id: order.id },
      {
        $set: {
          subtotal: subtotal.toFixed(2),
          discount: totalDiscount.toFixed(2),
          total: total.toFixed(2),
          updatedAt: new Date().toISOString(),
        }
      }
    );

    // Record promotion usages for newly applied promotions
    if (order.customerId && appliedPromotions.size > 0) {
      const values = [];
      const nowStr = new Date().toISOString();
      for (const promoId of appliedPromotions) {
        values.push({
          id: uuidv4(),
          promotionId: promoId,
          orderId: order.id,
          customerId: order.customerId,
          createdAt: nowStr,
          updatedAt: nowStr
        });
      }
      if (values.length > 0) await db.collection(promotionUsages.tableName).insertMany(values);
    }

    const updatedOrder = await db.collection(orders.tableName).findOne({ id: order.id });

    const lineResults = await Promise.all(updatedLines.map(async (l) => {
      const p = await db.collection(products.tableName).findOne({ id: l.productId });
      let promoData = null;
      if (l.appliedPromotionId) {
        const pr = await db.collection(promotions.tableName).findOne({ id: l.appliedPromotionId });
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
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: o.id })).toArray();
    const items = await Promise.all(lines.map(async (l) => {
      let name = 'Unknown';
      const p = await db.collection(products.tableName).findOne({ id: l.productId });
      if (p) name = p.name;
      return { name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal };
    }));

    const paymentsTable = require('../db/schema').payments;
    const payment = await db.collection(paymentsTable.tableName).findOne({ orderId: o.id });

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
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: o.id })).toArray();
    const items = await Promise.all(lines.map(async (l) => {
      let name = 'Unknown';
      const p = await db.collection(products.tableName).findOne({ id: l.productId });
      if (p) name = p.name;
      return { name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal };
    }));

    const paymentsTable = require('../db/schema').payments;
    const payment = await db.collection(paymentsTable.tableName).findOne({ orderId: o.id });

    let tableNumber = null;
    if (o.tableId) {
      const tb = await db.collection(tables.tableName).findOne({ id: o.tableId });
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
    const o = await db.collection(orders.tableName).findOne({ id: req.params.order_id });
    if (!o) return next(new NotFoundError('Order not found.'));

    const lines = await (await db.collection(orderLines.tableName).find({ orderId: o.id })).toArray();
    const items = await Promise.all(lines.map(async (l) => {
      let name = 'Unknown';
      const p = await db.collection(products.tableName).findOne({ id: l.productId });
      if (p) name = p.name;
      return { name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal };
    }));

    const paymentsTable = require('../db/schema').payments;
    const payment = await db.collection(paymentsTable.tableName).findOne({ orderId: o.id });

    let tableNumber = null;
    if (o.tableId) {
      const tb = await db.collection(tables.tableName).findOne({ id: o.tableId });
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
    await db.collection(receipts.tableName).insertOne({
      id: uuidv4(),
      orderId: o.id,
      email: req.body.email,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    sendSuccess(res, { message: `Receipt sent to ${req.body.email}.`, sent_at: new Date().toISOString() });
  } catch (err) { next(err); }
});

module.exports = router;
