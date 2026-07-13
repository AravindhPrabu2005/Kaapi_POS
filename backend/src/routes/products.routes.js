const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../middleware/pagination');
const { z } = require('zod');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../db');
const { products, categories } = require('../db/schema');

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

    const filter = { deletedAt: null };
    if (category_id) filter.categoryId = category_id;
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (kds_enabled !== undefined) filter.kdsEnabled = kds_enabled === 'true';

    const count = await db.collection(products.tableName).countDocuments(filter);
    const cursor = await db.collection(products.tableName).find(filter);
    const data = await cursor.sort({ createdAt: 1 }).skip(offset).limit(pageSize).toArray();

    const result = await Promise.all(data.map(async (p) => {
      let category = null;
      if (p.categoryId) {
        const cat = await db.collection(categories.tableName).findOne({ id: p.categoryId });
        if (cat) category = { id: cat.id, name: cat.name, color: cat.color };
      }
      return { id: p.id, name: p.name, category, price: p.price, unit_of_measure: p.unitOfMeasure, tax_percent: p.taxPercent, description: p.description, kds_enabled: p.kdsEnabled, image_url: p.imageUrl, created_at: p.createdAt };
    }));

    sendPaginated(res, result, { page, pageSize, totalCount: count });
  } catch (err) { next(err); }
});

router.get('/:product_id', async (req, res, next) => {
  try {
    const p = await db.collection(products.tableName).findOne({ id: req.params.product_id, deletedAt: null });
    if (!p) return next(new NotFoundError('Product not found.'));

    let category = null;
    if (p.categoryId) {
      const cat = await db.collection(categories.tableName).findOne({ id: p.categoryId });
      if (cat) category = { id: cat.id, name: cat.name, color: cat.color };
    }

    sendSuccess(res, { id: p.id, name: p.name, category, price: p.price, unit_of_measure: p.unitOfMeasure, tax_percent: p.taxPercent, description: p.description, kds_enabled: p.kdsEnabled, image_url: p.imageUrl, created_at: p.createdAt, updated_at: p.updatedAt });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), validate(createSchema), async (req, res, next) => {
  try {
    const p = {
      id: require('uuid').v4(),
      name: req.body.name,
      categoryId: req.body.category_id,
      price: req.body.price,
      unitOfMeasure: req.body.unit_of_measure || 'per_piece',
      taxPercent: req.body.tax_percent || '0.00',
      description: req.body.description || null,
      kdsEnabled: req.body.kds_enabled || false,
      imageUrl: req.body.image_url || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    await db.collection(products.tableName).insertOne(p);

    let category = null;
    if (p.categoryId) {
      const cat = await db.collection(categories.tableName).findOne({ id: p.categoryId });
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

    const resUpdate = await db.collection(products.tableName).updateOne(
      { id: req.params.product_id },
      { $set: updates }
    );
    if (resUpdate.matchedCount === 0) {
      return next(new NotFoundError('Product not found.'));
    }

    const p = await db.collection(products.tableName).findOne({ id: req.params.product_id });
    sendSuccess(res, { id: p.id, name: p.name, price: p.price, updated_at: p.updatedAt });
  } catch (err) { next(err); }
});

router.delete('/:product_id', requireRole('admin'), async (req, res, next) => {
  try {
    const p = await db.collection(products.tableName).findOne({ id: req.params.product_id });
    if (!p) return next(new NotFoundError('Product not found.'));

    await db.collection(products.tableName).updateOne(
      { id: req.params.product_id },
      { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
