const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../db');
const { products, categories } = require('../db/schema');
const { eq, and, like, sql, isNull } = require('drizzle-orm');

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1).max(255),
  category_id: z.string().uuid(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  unit_of_measure: z.string().max(50).optional(),
  tax_percent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  description: z.string().optional(),
  kds_enabled: z.boolean().optional(),
  image_url: z.string().max(500).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category_id: z.string().uuid().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  unit_of_measure: z.string().max(50).optional(),
  tax_percent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  description: z.string().optional(),
  kds_enabled: z.boolean().optional(),
  image_url: z.string().max(500).optional(),
});

router.get('/', parsePagination, async (req, res, next) => {
  try {
    const { category_id, search, kds_enabled } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const conditions = [isNull(products.deletedAt)];
    if (category_id) conditions.push(eq(products.categoryId, category_id));
    if (search) conditions.push(like(products.name, `%${search}%`));
    if (kds_enabled !== undefined) conditions.push(eq(products.kdsEnabled, kds_enabled === 'true'));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select().from(products).where(where).limit(pageSize).offset(offset).orderBy(products.createdAt),
      db.select({ count: sql`count(*)` }).from(products).where(where),
    ]);

    const result = await Promise.all(data.map(async (p) => {
      let category = null;
      if (p.categoryId) {
        const [cat] = await db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1);
        if (cat) category = { id: cat.id, name: cat.name, color: cat.color };
      }
      return { id: p.id, name: p.name, category, price: p.price, unit_of_measure: p.unitOfMeasure, tax_percent: p.taxPercent, description: p.description, kds_enabled: p.kdsEnabled, image_url: p.imageUrl, created_at: p.createdAt };
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: parseInt(count, 10) });
  } catch (err) { next(err); }
});

router.get('/:product_id', async (req, res, next) => {
  try {
    const [p] = await db.select().from(products).where(and(eq(products.id, req.params.product_id), isNull(products.deletedAt))).limit(1);
    if (!p) return next(new NotFoundError('Product not found.'));

    let category = null;
    if (p.categoryId) {
      const [cat] = await db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1);
      if (cat) category = { id: cat.id, name: cat.name, color: cat.color };
    }

    sendSuccess(res, { id: p.id, name: p.name, category, price: p.price, unit_of_measure: p.unitOfMeasure, tax_percent: p.taxPercent, description: p.description, kds_enabled: p.kdsEnabled, image_url: p.imageUrl, created_at: p.createdAt, updated_at: p.updatedAt });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), validate(createSchema), async (req, res, next) => {
  try {
    const vals = {
      name: req.body.name,
      categoryId: req.body.category_id,
      price: req.body.price,
      unitOfMeasure: req.body.unit_of_measure || 'per_piece',
      taxPercent: req.body.tax_percent || '0.00',
      description: req.body.description || null,
      kdsEnabled: req.body.kds_enabled || false,
      imageUrl: req.body.image_url || null,
    };

    const [p] = await db.insert(products).values(vals).returning();

    let category = null;
    if (p.categoryId) {
      const [cat] = await db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1);
      if (cat) category = { id: cat.id, name: cat.name, color: cat.color };
    }

    sendSuccess(res, { id: p.id, name: p.name, category, price: p.price, unit_of_measure: p.unitOfMeasure, tax_percent: p.taxPercent, description: p.description, kds_enabled: p.kdsEnabled, image_url: p.imageUrl, created_at: p.createdAt }, null, 201);
  } catch (err) { next(err); }
});

router.put('/:product_id', requireRole('admin'), validate(updateSchema), async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date().toISOString() };
    if (req.body.name) updates.name = req.body.name;
    if (req.body.category_id) updates.categoryId = req.body.category_id;
    if (req.body.price) updates.price = req.body.price;
    if (req.body.unit_of_measure) updates.unitOfMeasure = req.body.unit_of_measure;
    if (req.body.tax_percent) updates.taxPercent = req.body.tax_percent;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.kds_enabled !== undefined) updates.kdsEnabled = req.body.kds_enabled;
    if (req.body.image_url !== undefined) updates.imageUrl = req.body.image_url;

    const [p] = await db.update(products).set(updates).where(eq(products.id, req.params.product_id)).returning();
    if (!p) return next(new NotFoundError('Product not found.'));

    sendSuccess(res, { id: p.id, name: p.name, price: p.price, updated_at: p.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:product_id', requireRole('admin'), async (req, res, next) => {
  try {
    const [p] = await db.select().from(products).where(eq(products.id, req.params.product_id)).limit(1);
    if (!p) return next(new NotFoundError('Product not found.'));

    await db.update(products).set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(products.id, req.params.product_id));
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
