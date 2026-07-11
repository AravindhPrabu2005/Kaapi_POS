const { pgTable, uuid, text, varchar, timestamp, boolean, integer, decimal, uniqueIndex, primaryKey } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

// ─── 1. Users ───────────────────────────────────────────────────
const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('cashier'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  archivedAt: timestamp('archived_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 2. Categories ─────────────────────────────────────────────
const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  color: varchar('color', { length: 7 }).notNull().default('#F4A261'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 3. Products ───────────────────────────────────────────────
const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }).notNull().default('per_piece'),
  taxPercent: decimal('tax_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  description: text('description'),
  kdsEnabled: boolean('kds_enabled').notNull().default(false),
  imageUrl: varchar('image_url', { length: 500 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { mode: 'string' }),
});

// ─── 4. Payment Methods ────────────────────────────────────────
const paymentMethods = pgTable('payment_methods', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 20 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  upiId: varchar('upi_id', { length: 100 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 5. Floors ─────────────────────────────────────────────────
const floors = pgTable('floors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 6. Tables ─────────────────────────────────────────────────
const tables = pgTable('tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  floorId: uuid('floor_id').references(() => floors.id),
  tableNumber: integer('table_number').notNull(),
  seats: integer('seats').notNull().default(2),
  active: boolean('active').notNull().default(true),
  qrToken: varchar('qr_token', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 7. Coupons ────────────────────────────────────────────────
const coupons = pgTable('coupons', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  discountType: varchar('discount_type', { length: 20 }).notNull(),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }).notNull(),
  active: boolean('active').notNull().default(true),
  redemptionCount: integer('redemption_count').notNull().default(0),
  maxUses: integer('max_uses'),
  validFrom: timestamp('valid_from', { mode: 'string' }),
  validUntil: timestamp('valid_until', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 8. Coupon Usages ────────────────────────────────────────────
const couponUsages = pgTable('coupon_usages', {
  id: uuid('id').defaultRandom().primaryKey(),
  couponId: uuid('coupon_id').references(() => coupons.id).notNull(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  usedAt: timestamp('used_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 9. Promotion Usages ─────────────────────────────────────────
const promotionUsages = pgTable('promotion_usages', {
  id: uuid('id').defaultRandom().primaryKey(),
  promotionId: uuid('promotion_id').references(() => promotions.id).notNull(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  usedAt: timestamp('used_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 10. Promotions ─────────────────────────────────────────────
const promotions = pgTable('promotions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  scope: varchar('scope', { length: 20 }).notNull(),
  productId: uuid('product_id').references(() => products.id),
  minQuantity: integer('min_quantity'),
  minOrderAmount: decimal('min_order_amount', { precision: 12, scale: 2 }),
  discountType: varchar('discount_type', { length: 20 }).notNull(),
  discountValue: decimal('discount_value', { precision: 12, scale: 2 }).notNull(),
  active: boolean('active').notNull().default(true),
  validFrom: timestamp('valid_from', { mode: 'string' }),
  validUntil: timestamp('valid_until', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 10. Customers ──────────────────────────────────────────────
const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 10. Sessions ──────────────────────────────────────────────
const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  openedBy: uuid('opened_by').references(() => users.id),
  openedAt: timestamp('opened_at', { mode: 'string' }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { mode: 'string' }),
  closingAmount: decimal('closing_amount', { precision: 12, scale: 2 }),
});

// ─── 11. Orders ────────────────────────────────────────────────
const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 20 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  tableId: uuid('table_id').references(() => tables.id),
  customerId: uuid('customer_id').references(() => customers.id),
  employeeId: uuid('employee_id').references(() => users.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull().default('0.00'),
  tax: decimal('tax', { precision: 12, scale: 2 }).notNull().default('0.00'),
  discount: decimal('discount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  total: decimal('total', { precision: 12, scale: 2 }).notNull().default('0.00'),
  couponId: uuid('coupon_id').references(() => coupons.id),
  cancelledAt: timestamp('cancelled_at', { mode: 'string' }),
  cancelReason: text('cancel_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 12. Order Lines ───────────────────────────────────────────
const orderLines = pgTable('order_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  lineDiscount: decimal('line_discount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  appliedPromotionId: uuid('applied_promotion_id').references(() => promotions.id),
  lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 13. Payments ──────────────────────────────────────────────
const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  method: varchar('method', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  amountReceived: decimal('amount_received', { precision: 12, scale: 2 }),
  changeDue: decimal('change_due', { precision: 12, scale: 2 }),
  transactionReference: varchar('transaction_reference', { length: 100 }),
  status: varchar('status', { length: 30 }).notNull().default('awaiting_confirmation'),
  confirmedAt: timestamp('confirmed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 14. KDS Tickets ───────────────────────────────────────────
const kdsTickets = pgTable('kds_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  ticketNumber: varchar('ticket_number', { length: 20 }).notNull(),
  stage: varchar('stage', { length: 20 }).notNull().default('to_cook'),
  sentAt: timestamp('sent_at', { mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 15. KDS Ticket Items ──────────────────────────────────────
const kdsTicketItems = pgTable('kds_ticket_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').references(() => kdsTickets.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { mode: 'string' }),
});

// ─── 16. Self Ordering Settings ────────────────────────────────
const selfOrderingSettings = pgTable('self_ordering_settings', {
  id: integer('id').primaryKey().default(1),
  enabled: boolean('enabled').notNull().default(true),
  mode: varchar('mode', { length: 30 }).notNull().default('online_ordering'),
  backgroundColor: varchar('background_color', { length: 7 }).notNull().default('#FBF3E7'),
  backgroundImageUrl: text('background_image_url'),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── 17. Receipts ──────────────────────────────────────────────
const receipts = pgTable('receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  email: varchar('email', { length: 255 }),
  sentAt: timestamp('sent_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

// ─── Relations ──────────────────────────────────────────────────
const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(orders),
}));

const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  orderLines: many(orderLines),
  promotions: many(promotions),
  kdsTicketItems: many(kdsTicketItems),
}));

const floorsRelations = relations(floors, ({ many }) => ({
  tables: many(tables),
}));

const tablesRelations = relations(tables, ({ one, many }) => ({
  floor: one(floors, { fields: [tables.floorId], references: [floors.id] }),
  orders: many(orders),
}));

const couponsRelations = relations(coupons, ({ many }) => ({
  orders: many(orders),
  usages: many(couponUsages),
}));

const couponUsagesRelations = relations(couponUsages, ({ one }) => ({
  coupon: one(coupons, { fields: [couponUsages.couponId], references: [coupons.id] }),
  order: one(orders, { fields: [couponUsages.orderId], references: [orders.id] }),
  customer: one(customers, { fields: [couponUsages.customerId], references: [customers.id] }),
}));

const promotionsRelations = relations(promotions, ({ one, many }) => ({
  product: one(products, { fields: [promotions.productId], references: [products.id] }),
  orderLines: many(orderLines),
  usages: many(promotionUsages),
}));

const promotionUsagesRelations = relations(promotionUsages, ({ one }) => ({
  promotion: one(promotions, { fields: [promotionUsages.promotionId], references: [promotions.id] }),
  order: one(orders, { fields: [promotionUsages.orderId], references: [orders.id] }),
  customer: one(customers, { fields: [promotionUsages.customerId], references: [customers.id] }),
}));

const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

const sessionsRelations = relations(sessions, ({ one, many }) => ({
  openedByUser: one(users, { fields: [sessions.openedBy], references: [users.id] }),
  orders: many(orders),
}));

const ordersRelations = relations(orders, ({ one, many }) => ({
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  employee: one(users, { fields: [orders.employeeId], references: [users.id] }),
  session: one(sessions, { fields: [orders.sessionId], references: [sessions.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  lines: many(orderLines),
  payments: many(payments),
  kdsTickets: many(kdsTickets),
  receipts: many(receipts),
}));

const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, { fields: [orderLines.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderLines.productId], references: [products.id] }),
  appliedPromotion: one(promotions, { fields: [orderLines.appliedPromotionId], references: [promotions.id] }),
}));

const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

const kdsTicketsRelations = relations(kdsTickets, ({ one, many }) => ({
  order: one(orders, { fields: [kdsTickets.orderId], references: [orders.id] }),
  items: many(kdsTicketItems),
}));

const kdsTicketItemsRelations = relations(kdsTicketItems, ({ one }) => ({
  ticket: one(kdsTickets, { fields: [kdsTicketItems.ticketId], references: [kdsTickets.id] }),
  product: one(products, { fields: [kdsTicketItems.productId], references: [products.id] }),
}));

const receiptsRelations = relations(receipts, ({ one }) => ({
  order: one(orders, { fields: [receipts.orderId], references: [orders.id] }),
}));

module.exports = {
  users, usersRelations,
  categories, categoriesRelations,
  products, productsRelations,
  paymentMethods,
  floors, floorsRelations,
  tables, tablesRelations,
  coupons, couponsRelations,
  couponUsages, couponUsagesRelations,
  promotions, promotionsRelations,
  promotionUsages, promotionUsagesRelations,
  customers, customersRelations,
  sessions, sessionsRelations,
  orders, ordersRelations,
  orderLines, orderLinesRelations,
  payments, paymentsRelations,
  kdsTickets, kdsTicketsRelations,
  kdsTicketItems, kdsTicketItemsRelations,
  selfOrderingSettings,
  receipts, receiptsRelations,
};
