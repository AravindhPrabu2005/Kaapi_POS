const { Router } = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { parsePagination } = require("../middleware/pagination");
const { z } = require("zod");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { NotFoundError, ConflictError } = require("../utils/errors");
const { db } = require("../db");
const { categories, products } = require("../db/schema");

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1).max(255),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

router.get("/", parsePagination, async (req, res, next) => {
  try {
    const { search } = req.query;
    const { page, pageSize, offset } = req.pagination;

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const count = await db.collection(categories.tableName).countDocuments(filter);
    const data = await db
      .collection(categories.tableName)
      .find(filter)
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(pageSize)
      .toArray();

    const result = await Promise.all(
      data.map(async (cat) => {
        const productCount = await db
          .collection(products.tableName)
          .countDocuments({ categoryId: cat.id, deletedAt: null });
        return {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          product_count: productCount,
          created_at: cat.createdAt,
        };
      }),
    );

    sendPaginated(res, result, {
      page,
      pageSize,
      totalCount: count,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:category_id", async (req, res, next) => {
  try {
    const cat = await db.collection(categories.tableName).findOne({ id: req.params.category_id });
    if (!cat) return next(new NotFoundError("Category not found."));

    const count = await db.collection(products.tableName).countDocuments({ categoryId: cat.id, deletedAt: null });
    sendSuccess(res, {
      id: cat.id,
      name: cat.name,
      color: cat.color,
      product_count: count,
      created_at: cat.createdAt,
      updated_at: cat.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireRole("admin"),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const cat = {
        id: require('crypto').randomUUID(),
        name: req.body.name,
        color: req.body.color || "#F4A261",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(categories.tableName).insertOne(cat);
      sendSuccess(
        res,
        {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          product_count: 0,
          created_at: cat.createdAt,
        },
        null,
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/:category_id",
  requireRole("admin"),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      const updates = { ...req.body, updatedAt: new Date().toISOString() };
      const resUpdate = await db.collection(categories.tableName).updateOne(
        { id: req.params.category_id },
        { $set: updates }
      );
      if (resUpdate.matchedCount === 0) {
        return next(new NotFoundError("Category not found."));
      }
      const cat = await db.collection(categories.tableName).findOne({ id: req.params.category_id });
      sendSuccess(res, {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        updated_at: cat.updatedAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete("/:category_id", requireRole("admin"), async (req, res, next) => {
  try {
    const cat = await db.collection(categories.tableName).findOne({ id: req.params.category_id });
    if (!cat) return next(new NotFoundError("Category not found."));

    const count = await db.collection(products.tableName).countDocuments({ categoryId: req.params.category_id, deletedAt: null });
    if (count > 0) {
      return next(
        new ConflictError(
          "RESOURCE_IN_USE",
          `Category has ${count} product(s) assigned and cannot be deleted. Reassign products first.`,
        ),
      );
    }

    await db.collection(categories.tableName).deleteOne({ id: req.params.category_id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

module.exports = router;
