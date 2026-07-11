# Odoo Café POS

A cloud-based Point of Sale system for cafes and restaurants, built as part of the Odoo x KAHE internship.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  Frontend   │────▶│  Backend API │────▶│ PostgreSQL │
│  (React)    │◀────│  (Express 5) │◀────│ (Supabase) │
└─────────────┘     └──────────────┘     └────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework | Express 5 |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle ORM + Drizzle Kit |
| Validation | Zod |
| Auth | bcryptjs + jsonwebtoken |
| Real-Time | ws (WebSocket) |
| PDF | pdfkit |
| XLS | exceljs |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase project)

### Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
Postgres_URL=postgresql://user:password@host:port/database
PORT=3000
JWT_SECRET=your-secret-key
```

### Database

```bash
# Push schema to database (creates all tables)
npm run db:push

# Seed initial data (payment methods, settings, admin user)
npm run db:seed

# Generate migration files (for version control)
npm run db:generate
```

### Run

```bash
npm run dev     # Development with hot reload
npm start       # Production
```

## API Overview

Base URL: `http://localhost:3000/v1`

### Authentication

| Endpoint | Description |
|---|---|
| `POST /auth/signup` | Create admin account |
| `POST /auth/login` | Login (admin or cashier) |
| `POST /auth/refresh` | Refresh access token |
| `POST /auth/logout` | Invalidate session |
| `POST /auth/change-password` | Update own password |

### Master Data

| Endpoint | Description |
|---|---|
| `GET/POST /categories` | List / Create categories |
| `GET/PUT/DELETE /categories/:id` | Get / Update / Delete category |
| `GET/POST /products` | List (filterable) / Create products |
| `GET/PUT/DELETE /products/:id` | Get / Update / Delete product |
| `GET /payment-methods` | List payment methods |
| `PATCH /payment-methods/:id` | Toggle / configure payment method |
| `GET /payment-methods/upi/qr-code` | Generate UPI QR code |
| `GET/POST /customers` | List / Create customers |
| `GET/PUT/DELETE /customers/:id` | Get / Update / Delete customer |

### Venue

| Endpoint | Description |
|---|---|
| `GET/POST /floors` | List / Create floors |
| `GET/PUT/DELETE /floors/:id` | Get (with tables) / Update / Delete floor |
| `GET/POST /tables` | List (filterable) / Create tables |
| `GET/PUT/DELETE /tables/:id` | Get / Update / Delete table |
| `GET /tables/qr-codes/pdf` | Download table QR codes as PDF |

### Employees

| Endpoint | Description |
|---|---|
| `GET/POST /employees` | List (filterable) / Create employees |
| `GET/PUT/DELETE /employees/:id` | Get / Update / Delete employee |
| `POST /employees/:id/change-password` | Change employee password |
| `POST /employees/:id/archive` | Archive employee |

### Discounts

| Endpoint | Description |
|---|---|
| `GET/POST /coupons` | List / Create coupons |
| `GET/PUT/DELETE /coupons/:id` | Get / Update / Delete coupon |
| `POST /coupons/validate` | Validate & apply coupon to order |
| `GET/POST /promotions` | List / Create promotions (product or order scope) |
| `GET/PUT/DELETE /promotions/:id` | Get / Update / Delete promotion |
| `POST /promotions/evaluate` | Evaluate applicable promotions for an order |

### POS Core

| Endpoint | Description |
|---|---|
| `GET /sessions/latest` | Get latest session summary |
| `POST /sessions/open` | Open a new shift |
| `GET /sessions/active` | Get current active session |
| `POST /sessions/:id/close` | Close session with summary |
| `GET /sessions` | List sessions (date-filterable) |
| `GET/POST /orders` | List / Create order |
| `GET/PATCH/DELETE /orders/:id` | Get / Update / Delete order |
| `POST /orders/:id/send-to-kitchen` | Send order to KDS |
| `POST /orders/:id/cancel` | Cancel order |
| `POST /orders/:id/send-receipt` | Email receipt |
| `GET /orders/:id/receipt` | Get printable receipt data |
| `POST /orders/:id/lines` | Add item to cart |
| `PATCH /orders/:id/lines/:lineId` | Update item quantity |
| `DELETE /orders/:id/lines/:lineId` | Remove item from cart |
| `POST /orders/:id/payments/initiate` | Initiate payment (cash/card/upi) |
| `POST /orders/:id/payments/confirm` | Confirm payment |
| `POST /orders/:id/payments/cancel` | Cancel payment |
| `GET /orders/:id/payments` | Get payment details |

### Kitchen Display (KDS)

| Endpoint | Description |
|---|---|
| `GET /kds/tickets` | List tickets (filterable by stage/product) |
| `GET /kds/tickets/:id` | Get ticket detail |
| `POST /kds/tickets/:id/advance` | Advance ticket stage |
| `PATCH /kds/tickets/:id/items/:itemId` | Mark individual item complete |

### Self-Ordering

| Endpoint | Description |
|---|---|
| `GET /self-ordering/settings` | Get self-ordering config |
| `PUT /self-ordering/settings` | Update self-ordering config |
| `GET /self-ordering/resolve/:token` | Resolve table from QR token |
| `GET /self-ordering/menu` | Get digital menu (categories + products) |
| `POST /self-ordering/orders` | Place self-order |
| `GET /self-ordering/orders/:id/status` | Track order status |
| `GET /self-ordering/orders/history` | Get order history for table |

### Customer Display

| Endpoint | Description |
|---|---|
| `GET /customer-display/state` | Get current display state (order/payment/completed) |

### Reports

| Endpoint | Description |
|---|---|
| `GET /reports/dashboard` | Dashboard summary with sales trend, top products, etc. |
| `POST /reports/export` | Export report as PDF or XLS |

## Database Schema

17 tables with full foreign key relationships:

```
users ──── sessions, orders (employee)
categories ──── products
products ──── order_lines, promotions, kds_ticket_items
floors ──── tables
tables ──── orders
coupons ──── orders
promotions ──── order_lines
customers ──── orders
sessions ──── orders
orders ──── order_lines, payments, kds_tickets, receipts
kds_tickets ──── kds_ticket_items
```

## Response Format

**Success (single):**
```json
{ "data": { ... }, "meta": null }
```

**Success (list):**
```json
{ "data": [ ... ], "meta": { "page": 1, "page_size": 20, "total_count": 134, "total_pages": 7 } }
```

**Error:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Field validation failed |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `UNAUTHORIZED` | 401 | Missing or expired token |
| `FORBIDDEN` | 403 | Role not permitted |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_CODE` | 409 | Unique constraint violation |
| `RESOURCE_IN_USE` | 409 | Cannot delete due to references |
| `INVALID_STATE` | 409 | Action not allowed in current state |
| `SESSION_ALREADY_OPEN` | 409 | Session conflict |
| `INTERNAL_ERROR` | 500 | Unexpected error |

## Features

- **Role-based auth** — Admin and Cashier roles with different permissions
- **Real-time sync** — WebSocket events for orders, KDS, customer display, table status
- **QR ordering** — Table-side QR codes for self-ordering
- **Kitchen Display** — Stage-based ticket management (to cook → preparing → completed)
- **Smart discounts** — Coupon codes + automated promotions (product/order scope)
- **Multi-payment** — Cash (with change calculation), Card, UPI QR
- **Reporting** — Dashboard with trends, top products, exports (PDF/XLS)
- **Soft delete** — Products are soft-deleted to preserve historical orders

## Project Structure

```
backend/
├── index.js                  # Entry point
├── db.js                     # Database connection
├── drizzle.config.js         # Drizzle Kit config
├── seed.js                   # Initial data seeder
├── .env                      # Environment variables
├── src/
│   ├── config/env.js         # Config loader
│   ├── db/schema/index.js    # 17 table definitions + relations
│   ├── middleware/
│   │   ├── auth.js           # JWT verify + role guard
│   │   ├── errorHandler.js   # Global error handler
│   │   ├── validate.js       # Zod validation middleware
│   │   └── pagination.js     # Page/page_size parser
│   ├── routes/               # 19 route modules
│   ├── utils/
│   │   ├── response.js       # Response envelope helpers
│   │   └── errors.js         # Error classes
│   └── websocket/            # (coming soon)
└── api_doc.md                # Full API specification
```
