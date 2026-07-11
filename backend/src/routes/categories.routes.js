const { Router } = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { parsePagination } = require("../middleware/pagination");
const { z } = require("zod");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { NotFoundError, ConflictError } = require("../utils/errors");
const { db } = require("../db");
const { categories, products } = require("../db/schema");
const { eq, and, like, sql } = require("drizzle-orm");

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

    const conditions = [];
    if (search) conditions.push(like(categories.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(where)
        .limit(pageSize)
        .offset(offset)
        .orderBy(categories.createdAt),
      db.select({ count: sql`count(*)` }).from(categories).where(where),
    ]);

    const result = await Promise.all(
      data.map(async (cat) => {
        const [{ count: productCount }] = await db
          .select({ count: sql`count(*)` })
          .from(products)
          .where(eq(products.categoryId, cat.id));
        return {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          product_count: parseInt(productCount, 10),
          created_at: cat.createdAt,
        };
      }),
    );

    sendPaginated(res, result, {
      page,
      pageSize,
      totalCount: parseInt(count, 10),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:category_id", async (req, res, next) => {
  try {
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, req.params.category_id))
      .limit(1);
    if (!cat) return next(new NotFoundError("Category not found."));

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(products)
      .where(eq(products.categoryId, cat.id));
    sendSuccess(res, {
      id: cat.id,
      name: cat.name,
      color: cat.color,
      product_count: parseInt(count, 10),
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
      const [cat] = await db.insert(categories).values(req.body).returning();
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
      const updates = { ...req.body, updatedAt: new Date().toISOString() }; // "20-06-2026-05-30-10"
      const [cat] = await db
        .update(categories)
        .set(updates)
        .where(eq(categories.id, req.params.category_id))
        .returning();
      if (!cat) return next(new NotFoundError("Category not found."));
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
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, req.params.category_id))
      .limit(1);
    if (!cat) return next(new NotFoundError("Category not found."));

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(products)
      .where(eq(products.categoryId, req.params.category_id));
    if (parseInt(count, 10) > 0) {
      return next(
        new ConflictError(
          "RESOURCE_IN_USE",
          `Category has ${count} product(s) assigned and cannot be deleted. Reassign products first.`,
        ),
      );
    }

    await db
      .delete(categories)
      .where(eq(categories.id, req.params.category_id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
