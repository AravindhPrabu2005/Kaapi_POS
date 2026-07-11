const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { db } = require('../db');
const { tables, floors, orders } = require('../db/schema');
const { eq, and, like, sql, isNull } = require('drizzle-orm');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const { frontendUrl } = require('../config/env');

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  floor_id: z.string().uuid(),
  table_number: z.number().int().positive(),
  seats: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  seats: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { floor_id, status, active, search } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const conditions = [];
    if (floor_id) conditions.push(eq(tables.floorId, floor_id));
    if (active !== undefined) conditions.push(eq(tables.active, active === 'true'));
    if (search) conditions.push(like(sql`CAST(${tables.tableNumber} AS TEXT)`, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(tables).where(where).limit(pageSize).offset(offset).orderBy(tables.tableNumber),
      db.select({ count: sql`count(*)` }).from(tables).where(where),
    ]);

    const allDraftOrders = await db.select({ tableId: orders.tableId, id: orders.id })
      .from(orders)
      .where(eq(orders.status, 'draft'));
    const occupiedMap = {};
    allDraftOrders.forEach((o) => { occupiedMap[o.tableId] = o.id; });

    const result = data.map((t) => ({
      id: t.id,
      floor: { id: t.floorId },
      table_number: t.tableNumber,
      seats: t.seats,
      active: t.active,
      status: occupiedMap[t.id] ? 'occupied' : 'available',
      current_order_id: occupiedMap[t.id] || null,
      qr_token: t.qrToken,
      qr_url: `${frontendUrl}/s/${t.qrToken}`,
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: parseInt(count, 10) });
  } catch (err) { next(err); }
});

router.get('/:table_id', async (req, res, next) => {
  try {
    const [t] = await db.select().from(tables).where(eq(tables.id, req.params.table_id)).limit(1);
    if (!t) return next(new NotFoundError('Table not found.'));

    let floorData = null;
    if (t.floorId) {
      const [f] = await db.select().from(floors).where(eq(floors.id, t.floorId)).limit(1);
      if (f) floorData = { id: f.id, name: f.name };
    }

    const [draftOrder] = await db.select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.tableId, t.id), eq(orders.status, 'draft')))
      .limit(1);
    const status = draftOrder ? 'occupied' : 'available';
    const currentOrderId = draftOrder ? draftOrder.id : null;

    sendSuccess(res, {
      id: t.id, floor: floorData, table_number: t.tableNumber, seats: t.seats,
      active: t.active, status, current_order_id: currentOrderId, qr_token: t.qrToken,
      qr_url: `${frontendUrl}/s/${t.qrToken}`, created_at: t.createdAt,
    });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), validate(createSchema), async (req, res, next) => {
  try {
    const qrToken = `tbl_${require('uuid').v4().slice(0, 8)}`;
    const vals = {
      floorId: req.body.floor_id,
      tableNumber: req.body.table_number,
      seats: req.body.seats || 2,
      active: req.body.active !== undefined ? req.body.active : true,
      qrToken,
    };

    const [t] = await db.insert(tables).values(vals).returning();
    let floorData = null;
    if (t.floorId) {
      const [f] = await db.select().from(floors).where(eq(floors.id, t.floorId)).limit(1);
      if (f) floorData = { id: f.id, name: f.name };
    }

    sendSuccess(res, {
      id: t.id, floor: floorData, table_number: t.tableNumber, seats: t.seats,
      active: t.active, status: 'available', qr_token: t.qrToken,
      qr_url: `${frontendUrl}/s/${t.qrToken}`, created_at: t.createdAt,
    }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:table_id', requireRole('admin'), validate(updateSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.seats) updates.seats = req.body.seats;
    if (req.body.active !== undefined) updates.active = req.body.active;

    const [t] = await db.update(tables).set(updates).where(eq(tables.id, req.params.table_id)).returning();
    if (!t) return next(new NotFoundError('Table not found.'));
    sendSuccess(res, { id: t.id, seats: t.seats, active: t.active, updated_at: t.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:table_id', requireRole('admin'), async (req, res, next) => {
  try {
    const [t] = await db.select().from(tables).where(eq(tables.id, req.params.table_id)).limit(1);
    if (!t) return next(new NotFoundError('Table not found.'));

    const { orders } = require('../db/schema');
    const [activeOrder] = await db.select().from(orders).where(and(eq(orders.tableId, req.params.table_id), eq(orders.status, 'draft'))).limit(1);
    if (activeOrder) {
      return next(new ConflictError('RESOURCE_IN_USE', 'Table has an active order and cannot be deleted.'));
    }

    await db.delete(tables).where(eq(tables.id, req.params.table_id));
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/qr-codes/pdf', async (req, res, next) => {
  try {
    const { floor_id } = req.query;
    const conditions = [eq(tables.active, true)];
    if (floor_id) conditions.push(eq(tables.floorId, floor_id));

    const tableList = await db.select().from(tables).where(and(...conditions)).orderBy(tables.tableNumber);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=table-qr-codes.pdf');

    const doc = new PDFDocument();
    doc.pipe(res);

    doc.fontSize(20).text('Table QR Codes', { align: 'center' });
    doc.moveDown();

    for (const t of tableList) {
      const qrData = `${frontendUrl}/s/${t.qrToken}`;
      try {
        const qrImage = await QRCode.toDataURL(qrData);
        doc.image(qrImage, { fit: [100, 100], align: 'center' });
      } catch { /* skip qr if fails */ }
      doc.fontSize(14).text(`Table ${t.tableNumber}`, { align: 'center' });
      doc.moveDown(0.5);
    }

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
