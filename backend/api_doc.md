# Odoo Café POS — API Specification

**Version:** 1.0
**Base URL:** `https://api.odoocafepos.com/v1`
**Format:** All requests and responses use `application/json` unless noted otherwise.

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Users (Admin)](#3-users-admin)
4. [Employees](#4-employees)
5. [Categories](#5-categories)
6. [Products](#6-products)
7. [Payment Methods](#7-payment-methods)
8. [Floors](#8-floors)
9. [Tables](#9-tables)
10. [Coupons](#10-coupons)
11. [Automated Promotions](#11-automated-promotions)
12. [Customers](#12-customers)
13. [Sessions](#13-sessions)
14. [Orders](#14-orders)
15. [Order Lines](#15-order-lines)
16. [Payments](#16-payments)
17. [KDS Tickets](#17-kds-tickets)
18. [Self Ordering](#18-self-ordering)
19. [Customer Display](#19-customer-display)
20. [Reports & Dashboard](#20-reports--dashboard)
21. [Error Codes Reference](#21-error-codes-reference)
22. [Webhooks / Real-Time Events](#22-webhooks--real-time-events)

---

## 1. Conventions

### 1.1 Base Path

All endpoints are prefixed with `/v1`. Examples in this document omit the host for brevity:

```
GET /v1/products
```

### 1.2 Authentication

All endpoints except `POST /auth/signup` and `POST /auth/login` require a Bearer token:

```
Authorization: Bearer <access_token>
```

### 1.3 Standard Response Envelope

**Success (single resource):**
```json
{
  "data": { },
  "meta": null
}
```

**Success (list/collection):**
```json
{
  "data": [ ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 134,
    "total_pages": 7
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "email", "message": "Email is already in use." }
    ]
  }
}
```

### 1.4 Standard Query Parameters (list endpoints)

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number, default `1` |
| `page_size` | integer | Items per page, default `20`, max `100` |
| `sort_by` | string | Field to sort on |
| `sort_dir` | string | `asc` or `desc` |
| `search` | string | Free-text search (field varies per resource, documented per endpoint) |

### 1.5 HTTP Status Codes Used

| Code | Meaning |
|---|---|
| `200 OK` | Successful GET/PUT/PATCH |
| `201 Created` | Successful POST that creates a resource |
| `204 No Content` | Successful DELETE |
| `400 Bad Request` | Malformed request |
| `401 Unauthorized` | Missing/invalid token |
| `403 Forbidden` | Authenticated but not permitted (role check) |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate / state conflict (e.g. coupon already redeemed) |
| `422 Unprocessable Entity` | Validation error |
| `500 Internal Server Error` | Unexpected server error |

### 1.6 ID Format

All resource IDs are UUID v4 strings unless otherwise noted. Human-facing sequence numbers (e.g. Order Number, Ticket Number) are separate, short, display-friendly strings (e.g. `#2205`).

### 1.7 Timestamps

All timestamps are ISO 8601 UTC, e.g. `2026-06-20T09:15:00Z`.

### 1.8 Currency

All monetary values are decimal strings in the system's configured currency (INR in examples), e.g. `"450.00"`. Amounts are never floats to avoid rounding errors.

---

## 2. Authentication

### 2.1 Sign Up (Admin)

Creates a new admin (User) account.

```
POST /auth/signup
```

**Request Body**
```json
{
  "name": "Riya Sharma",
  "email": "riya@odoocafe.com",
  "password": "SecurePass123!"
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "8f14e45f-ceea-4d3b-8a1a-9c1f3e6b1a11",
    "name": "Riya Sharma",
    "email": "riya@odoocafe.com",
    "role": "admin",
    "created_at": "2026-06-20T09:00:00Z",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "df1b6e3a-2c9d-4f3a-9b1e-3a6c8d2f5e10",
    "expires_in": 3600
  },
  "meta": null
}
```

**Error — `422 Unprocessable Entity`**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "email", "message": "Email is already in use." },
      { "field": "password", "message": "Password must be at least 8 characters." }
    ]
  }
}
```

### 2.2 Login

```
POST /auth/login
```

Used by both Admins and Employees. The `role` field in the response determines whether the client routes to the backend or directly into the POS terminal.

**Request Body**
```json
{
  "email": "riya@odoocafe.com",
  "password": "SecurePass123!"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "8f14e45f-ceea-4d3b-8a1a-9c1f3e6b1a11",
    "name": "Riya Sharma",
    "email": "riya@odoocafe.com",
    "role": "admin",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "df1b6e3a-2c9d-4f3a-9b1e-3a6c8d2f5e10",
    "expires_in": 3600,
    "last_session": {
      "opened_at": "2026-06-19T09:02:00Z",
      "closed_at": "2026-06-19T21:10:00Z",
      "closing_amount": "5000.00"
    }
  },
  "meta": null
}
```

**Error — `401 Unauthorized`**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect."
  }
}
```

### 2.3 Refresh Token

```
POST /auth/refresh
```

**Request Body**
```json
{
  "refresh_token": "df1b6e3a-2c9d-4f3a-9b1e-3a6c8d2f5e10"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  },
  "meta": null
}
```

### 2.4 Log Out

```
POST /auth/logout
```

**Request Body:** _none_

**Response — `204 No Content`**

### 2.5 Change Password (Self)

```
POST /auth/change-password
```

**Request Body**
```json
{
  "current_password": "SecurePass123!",
  "new_password": "EvenMoreSecure456!"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "message": "Password updated successfully."
  },
  "meta": null
}
```

---

## 3. Users (Admin)

Represents the **User/Admin** role. Most admin-management actions reuse the [Employees](#4-employees) endpoints with `role=admin`; this section covers the admin-only profile view.

### 3.1 Get Current Admin Profile

```
GET /users/me
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "8f14e45f-ceea-4d3b-8a1a-9c1f3e6b1a11",
    "name": "Riya Sharma",
    "email": "riya@odoocafe.com",
    "role": "admin",
    "created_at": "2026-01-10T08:00:00Z"
  },
  "meta": null
}
```

### 3.2 Update Current Admin Profile

```
PATCH /users/me
```

**Request Body**
```json
{
  "name": "Riya R. Sharma"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "8f14e45f-ceea-4d3b-8a1a-9c1f3e6b1a11",
    "name": "Riya R. Sharma",
    "email": "riya@odoocafe.com",
    "role": "admin",
    "created_at": "2026-01-10T08:00:00Z",
    "updated_at": "2026-06-20T09:05:00Z"
  },
  "meta": null
}
```

---

## 4. Employees

Covers **User/Employee Management** — list, create, change password, archive, delete. Both Admin and Employee accounts share this resource, differentiated by `role`.

### 4.1 List Employees

```
GET /employees?role=cashier&status=active&page=1&page_size=20
```

| Query Param | Description |
|---|---|
| `role` | Filter by `admin` or `cashier` |
| `status` | Filter by `active` or `archived` |
| `search` | Matches name or email |

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "1a2b3c4d-0001-0001-0001-000000000001",
      "name": "Arjun Mehta",
      "email": "arjun@odoocafe.com",
      "role": "cashier",
      "status": "active",
      "created_at": "2026-02-01T10:00:00Z"
    },
    {
      "id": "1a2b3c4d-0002-0002-0002-000000000002",
      "name": "Priya Nair",
      "email": "priya@odoocafe.com",
      "role": "cashier",
      "status": "active",
      "created_at": "2026-02-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 4.2 Get Employee by ID

```
GET /employees/{employee_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "1a2b3c4d-0001-0001-0001-000000000001",
    "name": "Arjun Mehta",
    "email": "arjun@odoocafe.com",
    "role": "cashier",
    "status": "active",
    "created_at": "2026-02-01T10:00:00Z",
    "updated_at": "2026-02-01T10:00:00Z"
  },
  "meta": null
}
```

**Error — `404 Not Found`**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Employee not found."
  }
}
```

### 4.3 Create Employee

```
POST /employees
```

**Request Body**
```json
{
  "name": "Karan Singh",
  "email": "karan@odoocafe.com",
  "password": "Welcome123!",
  "role": "cashier"
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "1a2b3c4d-0003-0003-0003-000000000003",
    "name": "Karan Singh",
    "email": "karan@odoocafe.com",
    "role": "cashier",
    "status": "active",
    "created_at": "2026-06-20T09:10:00Z"
  },
  "meta": null
}
```

### 4.4 Update Employee

```
PUT /employees/{employee_id}
```

**Request Body**
```json
{
  "name": "Karan A. Singh",
  "role": "cashier"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "1a2b3c4d-0003-0003-0003-000000000003",
    "name": "Karan A. Singh",
    "email": "karan@odoocafe.com",
    "role": "cashier",
    "status": "active",
    "updated_at": "2026-06-20T09:12:00Z"
  },
  "meta": null
}
```

### 4.5 Change Employee Password

```
POST /employees/{employee_id}/change-password
```

**Request Body**
```json
{
  "new_password": "NewSecurePass789!"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "message": "Password updated successfully."
  },
  "meta": null
}
```

### 4.6 Archive Employee

Deactivates the account without deleting it; historical orders/sessions remain intact.

```
POST /employees/{employee_id}/archive
```

**Request Body:** _none_

**Response — `200 OK`**
```json
{
  "data": {
    "id": "1a2b3c4d-0003-0003-0003-000000000003",
    "status": "archived",
    "archived_at": "2026-06-20T09:15:00Z"
  },
  "meta": null
}
```

### 4.7 Delete Employee

```
DELETE /employees/{employee_id}
```

**Response — `204 No Content`**

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "RESOURCE_IN_USE",
    "message": "Employee has associated orders and cannot be permanently deleted. Archive instead."
  }
}
```

---

## 5. Categories

### 5.1 List Categories

```
GET /categories?page=1&page_size=20
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "2b3c4d5e-0001-0001-0001-000000000001",
      "name": "Beverages",
      "color": "#F4A261",
      "product_count": 12,
      "created_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": "2b3c4d5e-0002-0002-0002-000000000002",
      "name": "Desserts",
      "color": "#E76F51",
      "product_count": 6,
      "created_at": "2026-01-15T08:05:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 5.2 Get Category by ID

```
GET /categories/{category_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "2b3c4d5e-0001-0001-0001-000000000001",
    "name": "Beverages",
    "color": "#F4A261",
    "product_count": 12,
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-01-15T08:00:00Z"
  },
  "meta": null
}
```

### 5.3 Create Category

Supports both the dedicated Category screen and the inline "create on the fly" picker inside the Product form.

```
POST /categories
```

**Request Body**
```json
{
  "name": "Snacks",
  "color": "#2A9D8F"
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "2b3c4d5e-0003-0003-0003-000000000003",
    "name": "Snacks",
    "color": "#2A9D8F",
    "product_count": 0,
    "created_at": "2026-06-20T09:20:00Z"
  },
  "meta": null
}
```

### 5.4 Update Category

Updating `color` here propagates to every surface that displays this category (product cards, filter tabs, order view) in real time — see [§22 Webhooks](#22-webhooks--real-time-events) for the corresponding `category.updated` event.

```
PUT /categories/{category_id}
```

**Request Body**
```json
{
  "name": "Snacks",
  "color": "#E9C46A"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "2b3c4d5e-0003-0003-0003-000000000003",
    "name": "Snacks",
    "color": "#E9C46A",
    "updated_at": "2026-06-20T09:25:00Z"
  },
  "meta": null
}
```

### 5.5 Delete Category

```
DELETE /categories/{category_id}
```

**Response — `204 No Content`**

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "RESOURCE_IN_USE",
    "message": "Category has 12 product(s) assigned and cannot be deleted. Reassign products first."
  }
}
```

---

## 6. Products

### 6.1 List Products

```
GET /products?category_id={category_id}&search=coffee&page=1&page_size=20
```

| Query Param | Description |
|---|---|
| `category_id` | Filter by category |
| `search` | Matches product name |
| `kds_enabled` | `true`/`false` — filter products assigned to Kitchen Display |

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "3c4d5e6f-0001-0001-0001-000000000001",
      "name": "Cappuccino",
      "category": {
        "id": "2b3c4d5e-0001-0001-0001-000000000001",
        "name": "Beverages",
        "color": "#F4A261"
      },
      "price": "180.00",
      "unit_of_measure": "per_piece",
      "tax_percent": "5.00",
      "description": "Espresso topped with steamed milk foam.",
      "kds_enabled": true,
      "created_at": "2026-01-16T08:00:00Z"
    },
    {
      "id": "3c4d5e6f-0002-0002-0002-000000000002",
      "name": "Masala Tea",
      "category": {
        "id": "2b3c4d5e-0001-0001-0001-000000000001",
        "name": "Beverages",
        "color": "#F4A261"
      },
      "price": "60.00",
      "unit_of_measure": "per_piece",
      "tax_percent": "5.00",
      "description": "Traditional spiced Indian tea.",
      "kds_enabled": true,
      "created_at": "2026-01-16T08:10:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 6.2 Get Product by ID

```
GET /products/{product_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "3c4d5e6f-0001-0001-0001-000000000001",
    "name": "Cappuccino",
    "category": {
      "id": "2b3c4d5e-0001-0001-0001-000000000001",
      "name": "Beverages",
      "color": "#F4A261"
    },
    "price": "180.00",
    "unit_of_measure": "per_piece",
    "tax_percent": "5.00",
    "description": "Espresso topped with steamed milk foam.",
    "kds_enabled": true,
    "created_at": "2026-01-16T08:00:00Z",
    "updated_at": "2026-01-16T08:00:00Z"
  },
  "meta": null
}
```

### 6.3 Create Product

`category_id` accepts an existing category. To create a category inline from the product form, call `POST /categories` first (§5.3), then pass the returned `id` here.

```
POST /products
```

**Request Body**
```json
{
  "name": "Cold Brew",
  "category_id": "2b3c4d5e-0001-0001-0001-000000000001",
  "price": "220.00",
  "unit_of_measure": "per_piece",
  "tax_percent": "5.00",
  "description": "Slow-steeped cold brew coffee served over ice.",
  "kds_enabled": true
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "3c4d5e6f-0003-0003-0003-000000000003",
    "name": "Cold Brew",
    "category": {
      "id": "2b3c4d5e-0001-0001-0001-000000000001",
      "name": "Beverages",
      "color": "#F4A261"
    },
    "price": "220.00",
    "unit_of_measure": "per_piece",
    "tax_percent": "5.00",
    "description": "Slow-steeped cold brew coffee served over ice.",
    "kds_enabled": true,
    "created_at": "2026-06-20T09:30:00Z"
  },
  "meta": null
}
```

**Error — `422 Unprocessable Entity`**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "price", "message": "Price must be a positive number." },
      { "field": "category_id", "message": "Category does not exist." }
    ]
  }
}
```

### 6.4 Update Product

```
PUT /products/{product_id}
```

**Request Body**
```json
{
  "name": "Cold Brew (Large)",
  "category_id": "2b3c4d5e-0001-0001-0001-000000000001",
  "price": "260.00",
  "unit_of_measure": "per_piece",
  "tax_percent": "5.00",
  "description": "Slow-steeped cold brew coffee served over ice, 16oz.",
  "kds_enabled": true
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "3c4d5e6f-0003-0003-0003-000000000003",
    "name": "Cold Brew (Large)",
    "price": "260.00",
    "updated_at": "2026-06-20T09:35:00Z"
  },
  "meta": null
}
```

### 6.5 Delete Product

```
DELETE /products/{product_id}
```

**Response — `204 No Content`**

> Note: products referenced by historical order lines are soft-deleted internally so past orders remain intact; the API still returns `204` to the caller.

---

## 7. Payment Methods

### 7.1 List Payment Methods

```
GET /payment-methods
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "4d5e6f70-0001-0001-0001-000000000001",
      "type": "cash",
      "label": "Cash",
      "enabled": true
    },
    {
      "id": "4d5e6f70-0002-0002-0002-000000000002",
      "type": "card",
      "label": "Digital / Card",
      "enabled": true
    },
    {
      "id": "4d5e6f70-0003-0003-0003-000000000003",
      "type": "upi",
      "label": "UPI QR",
      "enabled": true,
      "upi_id": "cafe@ybl"
    }
  ],
  "meta": null
}
```

### 7.2 Get Payment Method by ID

```
GET /payment-methods/{payment_method_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "4d5e6f70-0003-0003-0003-000000000003",
    "type": "upi",
    "label": "UPI QR",
    "enabled": true,
    "upi_id": "cafe@ybl",
    "updated_at": "2026-03-01T10:00:00Z"
  },
  "meta": null
}
```

### 7.3 Update Payment Method (Toggle / Configure)

```
PATCH /payment-methods/{payment_method_id}
```

**Request Body (toggling Cash off)**
```json
{
  "enabled": false
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "4d5e6f70-0001-0001-0001-000000000001",
    "type": "cash",
    "label": "Cash",
    "enabled": false,
    "updated_at": "2026-06-20T09:40:00Z"
  },
  "meta": null
}
```

**Request Body (configuring UPI ID)**
```json
{
  "enabled": true,
  "upi_id": "cafe@ybl"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "4d5e6f70-0003-0003-0003-000000000003",
    "type": "upi",
    "label": "UPI QR",
    "enabled": true,
    "upi_id": "cafe@ybl",
    "updated_at": "2026-06-20T09:42:00Z"
  },
  "meta": null
}
```

**Error — `422 Unprocessable Entity`**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "upi_id", "message": "UPI ID is required to enable UPI QR payments." }
    ]
  }
}
```

### 7.4 Get UPI QR Code (Generated)

Used by both the POS Terminal payment screen and the Customer Facing Display.

```
GET /payment-methods/upi/qr-code?amount=450.00&order_id={order_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "upi_id": "cafe@ybl",
    "amount": "450.00",
    "qr_image_url": "https://cdn.odoocafepos.com/qr/upi/8f2a1c.png",
    "qr_string": "upi://pay?pa=cafe@ybl&am=450.00&cu=INR&tn=Order%20%232205",
    "expires_at": "2026-06-20T09:55:00Z"
  },
  "meta": null
}
```

---

## 8. Floors

### 8.1 List Floors

```
GET /floors
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "5e6f7081-0001-0001-0001-000000000001",
      "name": "Ground Floor",
      "table_count": 12,
      "created_at": "2026-01-10T08:00:00Z"
    },
    {
      "id": "5e6f7081-0002-0002-0002-000000000002",
      "name": "Rooftop",
      "table_count": 4,
      "created_at": "2026-01-10T08:10:00Z"
    }
  ],
  "meta": null
}
```

### 8.2 Get Floor by ID (with Tables)

```
GET /floors/{floor_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "5e6f7081-0001-0001-0001-000000000001",
    "name": "Ground Floor",
    "created_at": "2026-01-10T08:00:00Z",
    "tables": [
      {
        "id": "6f708192-0001-0001-0001-000000000001",
        "table_number": 1,
        "seats": 4,
        "active": true,
        "status": "available"
      },
      {
        "id": "6f708192-0002-0002-0002-000000000002",
        "table_number": 2,
        "seats": 2,
        "active": true,
        "status": "occupied"
      }
    ]
  },
  "meta": null
}
```

### 8.3 Create Floor

```
POST /floors
```

**Request Body**
```json
{
  "name": "First Floor"
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "5e6f7081-0003-0003-0003-000000000003",
    "name": "First Floor",
    "table_count": 0,
    "created_at": "2026-06-20T09:45:00Z"
  },
  "meta": null
}
```

### 8.4 Update Floor

```
PUT /floors/{floor_id}
```

**Request Body**
```json
{
  "name": "First Floor (AC)"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "5e6f7081-0003-0003-0003-000000000003",
    "name": "First Floor (AC)",
    "updated_at": "2026-06-20T09:47:00Z"
  },
  "meta": null
}
```

### 8.5 Delete Floor

```
DELETE /floors/{floor_id}
```

**Response — `204 No Content`**

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "RESOURCE_IN_USE",
    "message": "Floor has tables assigned and cannot be deleted. Remove or reassign tables first."
  }
}
```

---

## 9. Tables

### 9.1 List Tables

```
GET /tables?floor_id={floor_id}&status=available&page=1&page_size=20
```

| Query Param | Description |
|---|---|
| `floor_id` | Filter by floor |
| `status` | `available` or `occupied` (derived from active orders, read-only) |
| `active` | `true`/`false` — filter by Active Status field |

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "6f708192-0001-0001-0001-000000000001",
      "floor": { "id": "5e6f7081-0001-0001-0001-000000000001", "name": "Ground Floor" },
      "table_number": 1,
      "seats": 4,
      "active": true,
      "status": "available",
      "qr_token": "tbl_8f2a1c9d",
      "qr_url": "https://app.odoocafepos.com/s/tbl_8f2a1c9d"
    },
    {
      "id": "6f708192-0002-0002-0002-000000000002",
      "floor": { "id": "5e6f7081-0001-0001-0001-000000000001", "name": "Ground Floor" },
      "table_number": 2,
      "seats": 2,
      "active": true,
      "status": "occupied",
      "current_order_id": "9a1b2c3d-0001-0001-0001-000000002205",
      "qr_token": "tbl_3b7e2f1a",
      "qr_url": "https://app.odoocafepos.com/s/tbl_3b7e2f1a"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 16,
    "total_pages": 1
  }
}
```

### 9.2 Get Table by ID

```
GET /tables/{table_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "6f708192-0002-0002-0002-000000000002",
    "floor": { "id": "5e6f7081-0001-0001-0001-000000000001", "name": "Ground Floor" },
    "table_number": 2,
    "seats": 2,
    "active": true,
    "status": "occupied",
    "current_order_id": "9a1b2c3d-0001-0001-0001-000000002205",
    "qr_token": "tbl_3b7e2f1a",
    "qr_url": "https://app.odoocafepos.com/s/tbl_3b7e2f1a",
    "created_at": "2026-01-10T08:05:00Z"
  },
  "meta": null
}
```

### 9.3 Create Table

```
POST /tables
```

**Request Body**
```json
{
  "floor_id": "5e6f7081-0001-0001-0001-000000000001",
  "table_number": 17,
  "seats": 6,
  "active": true
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "6f708192-0017-0017-0017-000000000017",
    "floor": { "id": "5e6f7081-0001-0001-0001-000000000001", "name": "Ground Floor" },
    "table_number": 17,
    "seats": 6,
    "active": true,
    "status": "available",
    "qr_token": "tbl_4c8d1e2b",
    "qr_url": "https://app.odoocafepos.com/s/tbl_4c8d1e2b",
    "created_at": "2026-06-20T09:50:00Z"
  },
  "meta": null
}
```

### 9.4 Update Table

```
PUT /tables/{table_id}
```

**Request Body**
```json
{
  "seats": 8,
  "active": true
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "6f708192-0017-0017-0017-000000000017",
    "seats": 8,
    "active": true,
    "updated_at": "2026-06-20T09:52:00Z"
  },
  "meta": null
}
```

### 9.5 Delete Table

```
DELETE /tables/{table_id}
```

**Response — `204 No Content`**

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "RESOURCE_IN_USE",
    "message": "Table has an active order and cannot be deleted."
  }
}
```

### 9.6 Download Table QR Codes (PDF)

Generates a single PDF containing every active table's QR code, for printing.

```
GET /tables/qr-codes/pdf?floor_id={floor_id}
```

**Response — `200 OK`**
`Content-Type: application/pdf` (binary stream; not JSON)

```json
{
  "data": {
    "file_url": "https://cdn.odoocafepos.com/exports/table-qr-codes-20260620.pdf",
    "generated_at": "2026-06-20T09:55:00Z",
    "table_count": 16
  },
  "meta": null
}
```

---

## 10. Coupons

### 10.1 List Coupons

```
GET /coupons?active=true&page=1&page_size=20
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "70819203-0001-0001-0001-000000000001",
      "code": "WELCOME10",
      "discount_type": "percentage",
      "discount_value": "10.00",
      "active": true,
      "created_at": "2026-02-01T08:00:00Z"
    },
    {
      "id": "70819203-0002-0002-0002-000000000002",
      "code": "FLAT50",
      "discount_type": "fixed_amount",
      "discount_value": "50.00",
      "active": true,
      "created_at": "2026-03-10T08:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 10.2 Get Coupon by ID

```
GET /coupons/{coupon_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "70819203-0001-0001-0001-000000000001",
    "code": "WELCOME10",
    "discount_type": "percentage",
    "discount_value": "10.00",
    "active": true,
    "redemption_count": 38,
    "created_at": "2026-02-01T08:00:00Z",
    "updated_at": "2026-02-01T08:00:00Z"
  },
  "meta": null
}
```

### 10.3 Create Coupon

```
POST /coupons
```

**Request Body**
```json
{
  "code": "SUMMER25",
  "discount_type": "percentage",
  "discount_value": "25.00",
  "active": true
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "70819203-0003-0003-0003-000000000003",
    "code": "SUMMER25",
    "discount_type": "percentage",
    "discount_value": "25.00",
    "active": true,
    "created_at": "2026-06-20T10:00:00Z"
  },
  "meta": null
}
```

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "DUPLICATE_CODE",
    "message": "A coupon with code 'SUMMER25' already exists."
  }
}
```

### 10.4 Update Coupon

```
PUT /coupons/{coupon_id}
```

**Request Body**
```json
{
  "discount_value": "30.00",
  "active": true
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "70819203-0003-0003-0003-000000000003",
    "code": "SUMMER25",
    "discount_type": "percentage",
    "discount_value": "30.00",
    "active": true,
    "updated_at": "2026-06-20T10:05:00Z"
  },
  "meta": null
}
```

### 10.5 Delete Coupon

```
DELETE /coupons/{coupon_id}
```

**Response — `204 No Content`**

### 10.6 Validate / Redeem Coupon (POS action)

Called from the POS Discount popup when the employee enters a code.

```
POST /coupons/validate
```

**Request Body**
```json
{
  "code": "WELCOME10",
  "order_id": "9a1b2c3d-0001-0001-0001-000000002205"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "coupon": {
      "id": "70819203-0001-0001-0001-000000000001",
      "code": "WELCOME10",
      "discount_type": "percentage",
      "discount_value": "10.00"
    },
    "applied_discount_amount": "54.00",
    "order_totals": {
      "subtotal": "540.00",
      "tax": "27.00",
      "discount": "54.00",
      "total": "513.00"
    }
  },
  "meta": null
}
```

**Error — `404 Not Found`**
```json
{
  "error": {
    "code": "INVALID_COUPON",
    "message": "Coupon code 'WELCOME10' is invalid, expired, or inactive."
  }
}
```

---

## 11. Automated Promotions

### 11.1 List Automated Promotions

```
GET /promotions?scope=product&page=1&page_size=20
```

| Query Param | Description |
|---|---|
| `scope` | `product` or `order` |
| `active` | `true`/`false` |

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "81920314-0001-0001-0001-000000000001",
      "name": "Buy 3 Coffees Discount",
      "scope": "product",
      "product": {
        "id": "3c4d5e6f-0001-0001-0001-000000000001",
        "name": "Cappuccino"
      },
      "min_quantity": 3,
      "discount_type": "percentage",
      "discount_value": "10.00",
      "active": true
    },
    {
      "id": "81920314-0002-0002-0002-000000000002",
      "name": "Spend ₹1000 Get 5% Off",
      "scope": "order",
      "min_order_amount": "1000.00",
      "discount_type": "percentage",
      "discount_value": "5.00",
      "active": true
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 11.2 Get Automated Promotion by ID

```
GET /promotions/{promotion_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "81920314-0001-0001-0001-000000000001",
    "name": "Buy 3 Coffees Discount",
    "scope": "product",
    "product": {
      "id": "3c4d5e6f-0001-0001-0001-000000000001",
      "name": "Cappuccino"
    },
    "min_quantity": 3,
    "discount_type": "percentage",
    "discount_value": "10.00",
    "active": true,
    "created_at": "2026-04-01T08:00:00Z"
  },
  "meta": null
}
```

### 11.3 Create Automated Promotion — Product Scope

```
POST /promotions
```

**Request Body**
```json
{
  "name": "Buy 2 Sandwiches Discount",
  "scope": "product",
  "product_id": "3c4d5e6f-0004-0004-0004-000000000004",
  "min_quantity": 2,
  "discount_type": "fixed_amount",
  "discount_value": "40.00",
  "active": true
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "81920314-0003-0003-0003-000000000003",
    "name": "Buy 2 Sandwiches Discount",
    "scope": "product",
    "product": {
      "id": "3c4d5e6f-0004-0004-0004-000000000004",
      "name": "Club Sandwich"
    },
    "min_quantity": 2,
    "discount_type": "fixed_amount",
    "discount_value": "40.00",
    "active": true,
    "created_at": "2026-06-20T10:10:00Z"
  },
  "meta": null
}
```

### 11.4 Create Automated Promotion — Order Scope

**Request Body**
```json
{
  "name": "Spend ₹500 Get ₹50 Off",
  "scope": "order",
  "min_order_amount": "500.00",
  "discount_type": "fixed_amount",
  "discount_value": "50.00",
  "active": true
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "81920314-0004-0004-0004-000000000004",
    "name": "Spend ₹500 Get ₹50 Off",
    "scope": "order",
    "min_order_amount": "500.00",
    "discount_type": "fixed_amount",
    "discount_value": "50.00",
    "active": true,
    "created_at": "2026-06-20T10:12:00Z"
  },
  "meta": null
}
```

**Error — `422 Unprocessable Entity`**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "product_id", "message": "product_id is required when scope is 'product'." },
      { "field": "min_order_amount", "message": "min_order_amount must not be set when scope is 'product'." }
    ]
  }
}
```

### 11.5 Update Automated Promotion

```
PUT /promotions/{promotion_id}
```

**Request Body**
```json
{
  "discount_value": "15.00",
  "active": true
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "81920314-0001-0001-0001-000000000001",
    "discount_value": "15.00",
    "active": true,
    "updated_at": "2026-06-20T10:15:00Z"
  },
  "meta": null
}
```

### 11.6 Delete Automated Promotion

```
DELETE /promotions/{promotion_id}
```

**Response — `204 No Content`**

### 11.7 Evaluate Applicable Promotions (POS action)

Called automatically by the POS client whenever the cart changes, to determine which automated promotions currently apply. No code entry involved.

```
POST /promotions/evaluate
```

**Request Body**
```json
{
  "order_id": "9a1b2c3d-0001-0001-0001-000000002205"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "applied_promotions": [
      {
        "promotion_id": "81920314-0001-0001-0001-000000000001",
        "name": "Buy 3 Coffees Discount",
        "scope": "product",
        "applies_to_order_line_id": "ab1c2d3e-0001-0001-0001-000000000001",
        "discount_amount": "54.00"
      }
    ],
    "order_totals": {
      "subtotal": "540.00",
      "tax": "27.00",
      "discount": "54.00",
      "total": "513.00"
    }
  },
  "meta": null
}
```

---

## 12. Customers

### 12.1 List / Search Customers

```
GET /customers?search=eric&page=1&page_size=20
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "92031425-0001-0001-0001-000000000001",
      "name": "Eric Smith",
      "email": "eric@odoo.com",
      "phone": "+919898989898"
    },
    {
      "id": "92031425-0002-0002-0002-000000000002",
      "name": "Eric Fernandes",
      "email": "eric.f@odoo.com",
      "phone": "+919898989800"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 12.2 Get Customer by ID

```
GET /customers/{customer_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "92031425-0001-0001-0001-000000000001",
    "name": "Eric Smith",
    "email": "eric@odoo.com",
    "phone": "+919898989898",
    "created_at": "2026-03-05T08:00:00Z",
    "order_count": 14
  },
  "meta": null
}
```

### 12.3 Create Customer

```
POST /customers
```

**Request Body**
```json
{
  "name": "Eric Smith",
  "email": "eric@odoo.com",
  "phone": "+919898989898"
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "92031425-0001-0001-0001-000000000001",
    "name": "Eric Smith",
    "email": "eric@odoo.com",
    "phone": "+919898989898",
    "created_at": "2026-06-20T10:20:00Z"
  },
  "meta": null
}
```

### 12.4 Update Customer

```
PUT /customers/{customer_id}
```

**Request Body**
```json
{
  "name": "Eric Smith",
  "email": "eric.smith@odoo.com",
  "phone": "+919898989898"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "92031425-0001-0001-0001-000000000001",
    "name": "Eric Smith",
    "email": "eric.smith@odoo.com",
    "phone": "+919898989898",
    "updated_at": "2026-06-20T10:22:00Z"
  },
  "meta": null
}
```

### 12.5 Delete Customer

```
DELETE /customers/{customer_id}
```

**Response — `204 No Content`**

---

## 13. Sessions

### 13.1 Get Latest Session Summary (Login Card)

Powers the "Last open / Last sell" card shown right after login.

```
GET /sessions/latest
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "a3142536-0001-0001-0001-000000000001",
    "status": "closed",
    "opened_at": "2026-06-19T09:02:00Z",
    "closed_at": "2026-06-19T21:10:00Z",
    "opened_by": { "id": "1a2b3c4d-0001-0001-0001-000000000001", "name": "Arjun Mehta" },
    "closing_amount": "5000.00"
  },
  "meta": null
}
```

### 13.2 Open Session

```
POST /sessions/open
```

**Request Body:** _none_ (employee identity comes from the auth token)

**Response — `201 Created`**
```json
{
  "data": {
    "id": "a3142536-0002-0002-0002-000000000002",
    "status": "open",
    "opened_at": "2026-06-20T09:00:00Z",
    "opened_by": { "id": "1a2b3c4d-0001-0001-0001-000000000001", "name": "Arjun Mehta" }
  },
  "meta": null
}
```

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "SESSION_ALREADY_OPEN",
    "message": "A session is already open. Close it before opening a new one."
  }
}
```

### 13.3 Get Active Session

```
GET /sessions/active
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "a3142536-0002-0002-0002-000000000002",
    "status": "open",
    "opened_at": "2026-06-20T09:00:00Z",
    "opened_by": { "id": "1a2b3c4d-0001-0001-0001-000000000001", "name": "Arjun Mehta" },
    "order_count": 23,
    "running_total": "12450.00"
  },
  "meta": null
}
```

### 13.4 Close Session

```
POST /sessions/{session_id}/close
```

**Request Body:** _none_

**Response — `200 OK`**
```json
{
  "data": {
    "id": "a3142536-0002-0002-0002-000000000002",
    "status": "closed",
    "opened_at": "2026-06-20T09:00:00Z",
    "closed_at": "2026-06-20T21:05:00Z",
    "closing_summary": {
      "total_orders": 47,
      "total_revenue": "23150.00",
      "payment_breakdown": [
        { "method": "cash", "amount": "9200.00" },
        { "method": "card", "amount": "8450.00" },
        { "method": "upi", "amount": "5500.00" }
      ]
    }
  },
  "meta": null
}
```

### 13.5 List Sessions (for Reports filter)

```
GET /sessions?page=1&page_size=20&from=2026-06-01&to=2026-06-20
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "a3142536-0001-0001-0001-000000000001",
      "status": "closed",
      "opened_at": "2026-06-19T09:02:00Z",
      "closed_at": "2026-06-19T21:10:00Z",
      "opened_by": { "id": "1a2b3c4d-0001-0001-0001-000000000001", "name": "Arjun Mehta" },
      "closing_amount": "5000.00"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 1,
    "total_pages": 1
  }
}
```

---

## 14. Orders

### 14.1 List Orders (Current Session)

```
GET /orders?session_id={session_id}&status=draft&search=2205&page=1&page_size=20
```

| Query Param | Description |
|---|---|
| `session_id` | Defaults to the active session if omitted |
| `status` | `draft`, `paid`, or `cancelled` |
| `search` | Matches customer name, order number, or date |
| `table_id` | Filter by table |

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "9a1b2c3d-0001-0001-0001-000000002205",
      "order_number": "#2205",
      "status": "draft",
      "table": { "id": "6f708192-0002-0002-0002-000000000002", "table_number": 2 },
      "customer": { "id": "92031425-0001-0001-0001-000000000001", "name": "Eric Smith" },
      "subtotal": "540.00",
      "tax": "27.00",
      "discount": "54.00",
      "total": "513.00",
      "created_at": "2026-06-20T10:30:00Z"
    },
    {
      "id": "9a1b2c3d-0002-0002-0002-000000002206",
      "order_number": "#2206",
      "status": "paid",
      "table": { "id": "6f708192-0003-0003-0003-000000000003", "table_number": 3 },
      "customer": null,
      "subtotal": "350.00",
      "tax": "17.50",
      "discount": "0.00",
      "total": "367.50",
      "created_at": "2026-06-20T10:15:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 14.2 Get Order Detail

```
GET /orders/{order_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "9a1b2c3d-0001-0001-0001-000000002205",
    "order_number": "#2205",
    "status": "draft",
    "table": { "id": "6f708192-0002-0002-0002-000000000002", "table_number": 2, "floor": "Ground Floor" },
    "customer": { "id": "92031425-0001-0001-0001-000000000001", "name": "Eric Smith", "email": "eric@odoo.com" },
    "employee": { "id": "1a2b3c4d-0001-0001-0001-000000000001", "name": "Arjun Mehta" },
    "session_id": "a3142536-0002-0002-0002-000000000002",
    "lines": [
      {
        "id": "ab1c2d3e-0001-0001-0001-000000000001",
        "product": { "id": "3c4d5e6f-0001-0001-0001-000000000001", "name": "Cappuccino" },
        "quantity": 3,
        "unit_price": "180.00",
        "line_discount": "54.00",
        "applied_promotion": { "id": "81920314-0001-0001-0001-000000000001", "name": "Buy 3 Coffees Discount" },
        "line_total": "486.00"
      }
    ],
    "coupon": null,
    "subtotal": "540.00",
    "tax": "27.00",
    "discount": "54.00",
    "total": "513.00",
    "created_at": "2026-06-20T10:30:00Z",
    "updated_at": "2026-06-20T10:32:00Z"
  },
  "meta": null
}
```

**Error — `404 Not Found`**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Order not found."
  }
}
```

### 14.3 Create Order (Start New Order for a Table)

Called when an employee selects a table from the Floor pop-up.

```
POST /orders
```

**Request Body**
```json
{
  "table_id": "6f708192-0002-0002-0002-000000000002"
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "9a1b2c3d-0001-0001-0001-000000002205",
    "order_number": "#2205",
    "status": "draft",
    "table": { "id": "6f708192-0002-0002-0002-000000000002", "table_number": 2 },
    "customer": null,
    "lines": [],
    "subtotal": "0.00",
    "tax": "0.00",
    "discount": "0.00",
    "total": "0.00",
    "created_at": "2026-06-20T10:30:00Z"
  },
  "meta": null
}
```

### 14.4 Update Order (Assign Customer / Apply Coupon Reference)

```
PATCH /orders/{order_id}
```

**Request Body**
```json
{
  "customer_id": "92031425-0001-0001-0001-000000000001"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "9a1b2c3d-0001-0001-0001-000000002205",
    "customer": { "id": "92031425-0001-0001-0001-000000000001", "name": "Eric Smith" },
    "updated_at": "2026-06-20T10:33:00Z"
  },
  "meta": null
}
```

### 14.5 Delete Order (Draft only)

```
DELETE /orders/{order_id}
```

**Response — `204 No Content`**

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "Only Draft orders can be deleted. This order is Paid."
  }
}
```

### 14.6 Send Order to Kitchen

```
POST /orders/{order_id}/send-to-kitchen
```

**Request Body:** _none_

**Response — `200 OK`**
```json
{
  "data": {
    "order_id": "9a1b2c3d-0001-0001-0001-000000002205",
    "kds_ticket": {
      "id": "b1c2d3e4-0001-0001-0001-000000002205",
      "ticket_number": "#2205",
      "stage": "to_cook",
      "sent_at": "2026-06-20T10:34:00Z"
    }
  },
  "meta": null
}
```

### 14.7 Cancel Order

```
POST /orders/{order_id}/cancel
```

**Request Body**
```json
{
  "reason": "Customer left without paying."
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "9a1b2c3d-0001-0001-0001-000000002205",
    "status": "cancelled",
    "cancelled_at": "2026-06-20T10:40:00Z",
    "reason": "Customer left without paying."
  },
  "meta": null
}
```

### 14.8 Send Receipt by Email

```
POST /orders/{order_id}/send-receipt
```

**Request Body**
```json
{
  "email": "eric@odoo.com"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "message": "Receipt sent to eric@odoo.com.",
    "sent_at": "2026-06-20T10:55:00Z"
  },
  "meta": null
}
```

### 14.9 Get Printable Receipt

```
GET /orders/{order_id}/receipt
```

**Response — `200 OK`**
```json
{
  "data": {
    "order_number": "#2205",
    "date": "2026-06-20T10:55:00Z",
    "cafe_name": "Odoo Cafe",
    "items": [
      { "name": "Cappuccino", "quantity": 3, "unit_price": "180.00", "line_total": "486.00" }
    ],
    "subtotal": "540.00",
    "tax": "27.00",
    "discount": "54.00",
    "total": "513.00",
    "payment_method": "upi",
    "print_url": "https://cdn.odoocafepos.com/receipts/2205.pdf"
  },
  "meta": null
}
```

---

## 15. Order Lines

Order Lines are typically managed as a nested resource of Orders (added/edited as part of building the cart), exposed individually for direct cart manipulation from the POS terminal.

### 15.1 Add Item to Cart (Create Order Line)

```
POST /orders/{order_id}/lines
```

**Request Body**
```json
{
  "product_id": "3c4d5e6f-0001-0001-0001-000000000001",
  "quantity": 1
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "id": "ab1c2d3e-0001-0001-0001-000000000001",
    "product": { "id": "3c4d5e6f-0001-0001-0001-000000000001", "name": "Cappuccino" },
    "quantity": 1,
    "unit_price": "180.00",
    "line_discount": "0.00",
    "line_total": "180.00",
    "order_totals": {
      "subtotal": "180.00",
      "tax": "9.00",
      "discount": "0.00",
      "total": "189.00"
    }
  },
  "meta": null
}
```

### 15.2 Update Order Line (Adjust Quantity)

```
PATCH /orders/{order_id}/lines/{line_id}
```

**Request Body**
```json
{
  "quantity": 3
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "ab1c2d3e-0001-0001-0001-000000000001",
    "product": { "id": "3c4d5e6f-0001-0001-0001-000000000001", "name": "Cappuccino" },
    "quantity": 3,
    "unit_price": "180.00",
    "line_discount": "54.00",
    "applied_promotion": { "id": "81920314-0001-0001-0001-000000000001", "name": "Buy 3 Coffees Discount" },
    "line_total": "486.00",
    "order_totals": {
      "subtotal": "540.00",
      "tax": "27.00",
      "discount": "54.00",
      "total": "513.00"
    }
  },
  "meta": null
}
```

> Note: increasing quantity to the promotion's `min_quantity` threshold automatically attaches `applied_promotion` — no separate call needed; see [§11.7](#117-evaluate-applicable-promotions-pos-action).

### 15.3 Remove Order Line

```
DELETE /orders/{order_id}/lines/{line_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "order_totals": {
      "subtotal": "0.00",
      "tax": "0.00",
      "discount": "0.00",
      "total": "0.00"
    }
  },
  "meta": null
}
```

---

## 16. Payments

### 16.1 Initiate Payment

Locks in the chosen payment method and (for UPI) generates the QR code; pushes the Payment View to the Customer Facing Display.

```
POST /orders/{order_id}/payments/initiate
```

**Request Body (UPI)**
```json
{
  "payment_method": "upi"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "payment_method": "upi",
    "amount_due": "513.00",
    "qr_image_url": "https://cdn.odoocafepos.com/qr/upi/9b3f2e.png",
    "qr_string": "upi://pay?pa=cafe@ybl&am=513.00&cu=INR&tn=Order%20%232205",
    "status": "awaiting_confirmation"
  },
  "meta": null
}
```

**Request Body (Cash)**
```json
{
  "payment_method": "cash",
  "amount_received": "600.00"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "payment_method": "cash",
    "amount_due": "513.00",
    "amount_received": "600.00",
    "change_due": "87.00",
    "status": "awaiting_confirmation"
  },
  "meta": null
}
```

**Request Body (Card)**
```json
{
  "payment_method": "card",
  "transaction_reference": "TXN-88291203"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "payment_method": "card",
    "amount_due": "513.00",
    "transaction_reference": "TXN-88291203",
    "status": "awaiting_confirmation"
  },
  "meta": null
}
```

### 16.2 Confirm Payment

Marks the order as Paid. For UPI, this corresponds to the employee tapping **Confirmed** once the customer has paid.

```
POST /orders/{order_id}/payments/confirm
```

**Request Body**
```json
{
  "payment_method": "upi"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "order_id": "9a1b2c3d-0001-0001-0001-000000002205",
    "order_status": "paid",
    "payment": {
      "id": "c2d3e4f5-0001-0001-0001-000000000001",
      "method": "upi",
      "amount": "513.00",
      "confirmed_at": "2026-06-20T10:58:00Z"
    }
  },
  "meta": null
}
```

### 16.3 Cancel Payment (Back Out of Payment Screen)

Corresponds to the employee tapping **Cancel** on the UPI payment screen to go back.

```
POST /orders/{order_id}/payments/cancel
```

**Request Body:** _none_

**Response — `200 OK`**
```json
{
  "data": {
    "order_id": "9a1b2c3d-0001-0001-0001-000000002205",
    "order_status": "draft",
    "message": "Payment cancelled; returned to cart."
  },
  "meta": null
}
```

### 16.4 Get Payment by Order

```
GET /orders/{order_id}/payments
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "c2d3e4f5-0001-0001-0001-000000000001",
    "order_id": "9a1b2c3d-0001-0001-0001-000000002205",
    "method": "upi",
    "amount": "513.00",
    "confirmed_at": "2026-06-20T10:58:00Z"
  },
  "meta": null
}
```

---

## 17. KDS Tickets

### 17.1 List Tickets (Kitchen Display Board)

```
GET /kds/tickets?stage=to_cook&product_id={product_id}&category_id={category_id}&search=2205
```

| Query Param | Description |
|---|---|
| `stage` | `to_cook`, `preparing`, or `completed` |
| `product_id` | Filter tickets containing a specific product |
| `category_id` | Filter tickets containing a product in this category |
| `search` | Matches ticket/order number |

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "b1c2d3e4-0001-0001-0001-000000002205",
      "ticket_number": "#2205",
      "order_id": "9a1b2c3d-0001-0001-0001-000000002205",
      "table_number": 2,
      "stage": "to_cook",
      "items": [
        { "id": "d1e2f3a4-0001-0001-0001-000000000001", "product_name": "Cappuccino", "quantity": 3, "completed": false },
        { "id": "d1e2f3a4-0002-0002-0002-000000000002", "product_name": "Club Sandwich", "quantity": 1, "completed": false }
      ],
      "sent_at": "2026-06-20T10:34:00Z"
    },
    {
      "id": "b1c2d3e4-0002-0002-0002-000000002206",
      "ticket_number": "#2206",
      "order_id": "9a1b2c3d-0002-0002-0002-000000002206",
      "table_number": 5,
      "stage": "preparing",
      "items": [
        { "id": "d1e2f3a4-0003-0003-0003-000000000003", "product_name": "Masala Tea", "quantity": 2, "completed": true }
      ],
      "sent_at": "2026-06-20T10:20:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 50,
    "total_count": 2,
    "total_pages": 1
  }
}
```

### 17.2 Get Ticket by ID

```
GET /kds/tickets/{ticket_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "b1c2d3e4-0001-0001-0001-000000002205",
    "ticket_number": "#2205",
    "order_id": "9a1b2c3d-0001-0001-0001-000000002205",
    "table_number": 2,
    "stage": "to_cook",
    "items": [
      { "id": "d1e2f3a4-0001-0001-0001-000000000001", "product_name": "Cappuccino", "quantity": 3, "completed": false },
      { "id": "d1e2f3a4-0002-0002-0002-000000000002", "product_name": "Club Sandwich", "quantity": 1, "completed": false }
    ],
    "sent_at": "2026-06-20T10:34:00Z",
    "updated_at": "2026-06-20T10:34:00Z"
  },
  "meta": null
}
```

### 17.3 Advance Ticket Stage

Clicking the ticket card moves the entire order to the next stage (`to_cook` → `preparing` → `completed`).

```
POST /kds/tickets/{ticket_id}/advance
```

**Request Body:** _none_

**Response — `200 OK`**
```json
{
  "data": {
    "id": "b1c2d3e4-0001-0001-0001-000000002205",
    "ticket_number": "#2205",
    "stage": "preparing",
    "updated_at": "2026-06-20T10:36:00Z"
  },
  "meta": null
}
```

**Error — `409 Conflict`**
```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "Ticket is already in the 'completed' stage and cannot advance further."
  }
}
```

### 17.4 Mark Individual Item Complete

Clicking an individual item marks only that item complete (shown with a strikethrough on the client) without changing the overall ticket stage.

```
PATCH /kds/tickets/{ticket_id}/items/{item_id}
```

**Request Body**
```json
{
  "completed": true
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "id": "d1e2f3a4-0001-0001-0001-000000000001",
    "product_name": "Cappuccino",
    "quantity": 3,
    "completed": true,
    "completed_at": "2026-06-20T10:37:00Z"
  },
  "meta": null
}
```

---

## 18. Self Ordering

### 18.1 Get Self Ordering Settings

```
GET /self-ordering/settings
```

**Response — `200 OK`**
```json
{
  "data": {
    "enabled": true,
    "mode": "online_ordering",
    "background_color": "#FBF3E7",
    "background_image_url": "https://cdn.odoocafepos.com/backgrounds/cafe-pattern.png"
  },
  "meta": null
}
```

### 18.2 Update Self Ordering Settings

```
PUT /self-ordering/settings
```

**Request Body**
```json
{
  "enabled": true,
  "mode": "qr_menu",
  "background_color": "#FBF3E7",
  "background_image_url": "https://cdn.odoocafepos.com/backgrounds/cafe-pattern.png"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "enabled": true,
    "mode": "qr_menu",
    "background_color": "#FBF3E7",
    "background_image_url": "https://cdn.odoocafepos.com/backgrounds/cafe-pattern.png",
    "updated_at": "2026-06-20T11:00:00Z"
  },
  "meta": null
}
```

### 18.3 Resolve Table from QR Token

Called when the customer's browser loads `<domain>/s/<unique-token>`.

```
GET /self-ordering/resolve/{unique_token}
```

**Response — `200 OK`**
```json
{
  "data": {
    "table": { "id": "6f708192-0002-0002-0002-000000000002", "table_number": 2, "floor": "Ground Floor" },
    "mode": "online_ordering",
    "background_color": "#FBF3E7",
    "background_image_url": "https://cdn.odoocafepos.com/backgrounds/cafe-pattern.png",
    "menu_url": "/self-ordering/menu?table_id=6f708192-0002-0002-0002-000000000002"
  },
  "meta": null
}
```

**Error — `404 Not Found`**
```json
{
  "error": {
    "code": "INVALID_QR_TOKEN",
    "message": "This QR code is no longer valid."
  }
}
```

### 18.4 Get Digital Menu

```
GET /self-ordering/menu?table_id={table_id}
```

**Response — `200 OK`**
```json
{
  "data": {
    "categories": [
      {
        "id": "2b3c4d5e-0001-0001-0001-000000000001",
        "name": "Beverages",
        "color": "#F4A261",
        "products": [
          { "id": "3c4d5e6f-0001-0001-0001-000000000001", "name": "Cappuccino", "price": "180.00", "description": "Espresso topped with steamed milk foam." },
          { "id": "3c4d5e6f-0002-0002-0002-000000000002", "name": "Masala Tea", "price": "60.00", "description": "Traditional spiced Indian tea." }
        ]
      }
    ]
  },
  "meta": null
}
```

### 18.5 Place Self-Order

Only available when `mode = online_ordering`.

```
POST /self-ordering/orders
```

**Request Body**
```json
{
  "table_id": "6f708192-0002-0002-0002-000000000002",
  "customer": {
    "name": "Eric Smith",
    "phone": "+919898989898"
  },
  "items": [
    { "product_id": "3c4d5e6f-0001-0001-0001-000000000001", "quantity": 2 }
  ],
  "coupon_code": "WELCOME10"
}
```

**Response — `201 Created`**
```json
{
  "data": {
    "order_id": "9a1b2c3d-0003-0003-0003-000000002207",
    "order_number": "#2207",
    "status": "draft",
    "subtotal": "360.00",
    "tax": "18.00",
    "discount": "36.00",
    "total": "342.00",
    "sent_to_kitchen": true,
    "kds_ticket": {
      "id": "b1c2d3e4-0003-0003-0003-000000002207",
      "stage": "to_cook"
    },
    "created_at": "2026-06-20T11:05:00Z"
  },
  "meta": null
}
```

**Error — `403 Forbidden`**
```json
{
  "error": {
    "code": "ORDERING_DISABLED",
    "message": "Self ordering is currently set to QR Menu mode; placing orders is not available."
  }
}
```

### 18.6 Track Self-Order Status

```
GET /self-ordering/orders/{order_id}/status
```

**Response — `200 OK`**
```json
{
  "data": {
    "order_id": "9a1b2c3d-0003-0003-0003-000000002207",
    "order_number": "#2207",
    "stage": "preparing",
    "updated_at": "2026-06-20T11:08:00Z"
  },
  "meta": null
}
```

### 18.7 Get Self-Order History (for this table/session)

```
GET /self-ordering/orders/history?table_id={table_id}
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "order_id": "9a1b2c3d-0003-0003-0003-000000002207",
      "order_number": "#2207",
      "status": "paid",
      "total": "342.00",
      "created_at": "2026-06-20T11:05:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 1,
    "total_pages": 1
  }
}
```

---

## 19. Customer Display

Read-only, real-time mirror of the active order on the cashier's terminal. The client typically opens this via `<domain>/customer-display` and subscribes to live updates (see [§22](#22-webhooks--real-time-events)); the REST endpoint below provides the initial/fallback state.

### 19.1 Get Current Display State

```
GET /customer-display/state?table_id={table_id}
```

**Response — `200 OK` (Order View state)**
```json
{
  "data": {
    "view": "order",
    "order": {
      "order_number": "#2205",
      "lines": [
        { "product_name": "Cappuccino", "quantity": 3, "unit_price": "180.00", "line_total": "486.00" }
      ],
      "subtotal": "540.00",
      "tax": "27.00",
      "discount": "54.00",
      "total": "513.00"
    }
  },
  "meta": null
}
```

**Response — `200 OK` (Payment View state)**
```json
{
  "data": {
    "view": "payment",
    "payment": {
      "method": "upi",
      "amount_due": "513.00",
      "qr_image_url": "https://cdn.odoocafepos.com/qr/upi/9b3f2e.png"
    }
  },
  "meta": null
}
```

**Response — `200 OK` (Completion View state)**
```json
{
  "data": {
    "view": "completed",
    "message": "Thank you for shopping with us. See you again!"
  },
  "meta": null
}
```

---

## 20. Reports & Dashboard

### 20.1 Get Dashboard Summary

```
GET /reports/dashboard?period=this_week&employee_id={employee_id}&session_id={session_id}&product_id={product_id}
```

| Query Param | Description |
|---|---|
| `period` | `today`, `this_week`, `this_month`, or `custom` |
| `from` / `to` | Required when `period=custom` (ISO 8601 dates) |
| `employee_id` | Filter by employee |
| `session_id` | Filter by session |
| `product_id` | Filter by product |

**Response — `200 OK`**
```json
{
  "data": {
    "period": "this_week",
    "summary": {
      "total_orders": 312,
      "revenue": "148500.00",
      "average_order_value": "476.28"
    },
    "sales_trend": [
      { "date": "2026-06-15", "revenue": "19800.00", "order_count": 41 },
      { "date": "2026-06-16", "revenue": "21200.00", "order_count": 45 },
      { "date": "2026-06-17", "revenue": "18950.00", "order_count": 39 },
      { "date": "2026-06-18", "revenue": "23100.00", "order_count": 48 },
      { "date": "2026-06-19", "revenue": "24800.00", "order_count": 52 },
      { "date": "2026-06-20", "revenue": "20650.00", "order_count": 43 }
    ],
    "top_categories_chart": [
      { "category": "Beverages", "revenue": "62500.00", "percent": "42.1" },
      { "category": "Mains", "revenue": "48200.00", "percent": "32.5" },
      { "category": "Desserts", "revenue": "37800.00", "percent": "25.4" }
    ],
    "top_orders": [
      { "order_number": "#2188", "customer": "Eric Smith", "total": "2450.00", "date": "2026-06-18T19:30:00Z" },
      { "order_number": "#2155", "customer": "Priya Nair", "total": "2100.00", "date": "2026-06-17T20:10:00Z" }
    ],
    "top_products": [
      { "product_name": "Cappuccino", "quantity_sold": 412, "revenue": "74160.00" },
      { "product_name": "Club Sandwich", "quantity_sold": 198, "revenue": "49500.00" }
    ],
    "top_categories_table": [
      { "category": "Beverages", "revenue": "62500.00" },
      { "category": "Mains", "revenue": "48200.00" }
    ]
  },
  "meta": null
}
```

### 20.2 Export Report

```
POST /reports/export
```

**Request Body**
```json
{
  "format": "pdf",
  "period": "this_month",
  "employee_id": null,
  "session_id": null,
  "product_id": null
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "file_url": "https://cdn.odoocafepos.com/exports/sales-report-202606.pdf",
    "format": "pdf",
    "generated_at": "2026-06-20T11:15:00Z"
  },
  "meta": null
}
```

**Request Body (XLS)**
```json
{
  "format": "xls",
  "period": "custom",
  "from": "2026-06-01",
  "to": "2026-06-20"
}
```

**Response — `200 OK`**
```json
{
  "data": {
    "file_url": "https://cdn.odoocafepos.com/exports/sales-report-20260601-20260620.xlsx",
    "format": "xls",
    "generated_at": "2026-06-20T11:16:00Z"
  },
  "meta": null
}
```

---

## 21. Error Codes Reference

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 422 | One or more request fields failed validation. |
| `INVALID_CREDENTIALS` | 401 | Email/password combination is incorrect. |
| `UNAUTHORIZED` | 401 | Missing or expired access token. |
| `FORBIDDEN` | 403 | Authenticated user's role does not permit this action. |
| `NOT_FOUND` | 404 | The requested resource does not exist. |
| `DUPLICATE_CODE` | 409 | A coupon/category/etc. with this unique value already exists. |
| `RESOURCE_IN_USE` | 409 | Resource cannot be deleted due to existing references. |
| `INVALID_STATE` | 409 | Action not allowed given the resource's current status (e.g. editing a Paid order). |
| `SESSION_ALREADY_OPEN` | 409 | Attempted to open a session while one is already active. |
| `INVALID_COUPON` | 404 | Coupon code does not exist, is inactive, or has expired. |
| `INVALID_QR_TOKEN` | 404 | Self-ordering QR token does not map to an active table. |
| `ORDERING_DISABLED` | 403 | Self ordering is in QR Menu mode; order placement is blocked. |
| `RATE_LIMITED` | 429 | Too many requests; retry after the time in `Retry-After` header. |
| `INTERNAL_ERROR` | 500 | Unexpected server error. |

---

## 22. Webhooks / Real-Time Events

The system pushes real-time events over WebSocket (`wss://api.odoocafepos.com/v1/realtime`) so the POS Terminal, Customer Facing Display, KDS, and Self Ordering screens stay in sync without polling. Clients subscribe to channels scoped by `session_id`, `table_id`, or `kds` as needed.

### 22.1 Event Envelope

```json
{
  "event": "order.updated",
  "channel": "table:6f708192-0002-0002-0002-000000000002",
  "timestamp": "2026-06-20T10:34:00Z",
  "payload": { }
}
```

### 22.2 Event Types

| Event | Channel | Payload |
|---|---|---|
| `order.updated` | `table:{table_id}` | Full order object, same shape as [§14.2](#142-get-order-detail) |
| `order.paid` | `table:{table_id}`, `session:{session_id}` | `{ "order_id": "...", "total": "513.00" }` |
| `category.updated` | `global` | `{ "id": "...", "name": "...", "color": "#..." }` |
| `kds.ticket.created` | `kds` | Full ticket object, same shape as [§17.2](#172-get-ticket-by-id) |
| `kds.ticket.stage_changed` | `kds`, `table:{table_id}` | `{ "ticket_id": "...", "stage": "preparing" }` |
| `kds.ticket.item_completed` | `kds` | `{ "ticket_id": "...", "item_id": "...", "completed": true }` |
| `customer_display.view_changed` | `table:{table_id}` | `{ "view": "payment", "payment": { ... } }` |
| `table.status_changed` | `floor:{floor_id}` | `{ "table_id": "...", "status": "occupied" }` |

**Example — `kds.ticket.stage_changed`**
```json
{
  "event": "kds.ticket.stage_changed",
  "channel": "kds",
  "timestamp": "2026-06-20T10:36:00Z",
  "payload": {
    "ticket_id": "b1c2d3e4-0001-0001-0001-000000002205",
    "ticket_number": "#2205",
    "stage": "preparing"
  }
}
```

**Example — `customer_display.view_changed`**
```json
{
  "event": "customer_display.view_changed",
  "channel": "table:6f708192-0002-0002-0002-000000000002",
  "timestamp": "2026-06-20T10:57:00Z",
  "payload": {
    "view": "payment",
    "payment": {
      "method": "upi",
      "amount_due": "513.00",
      "qr_image_url": "https://cdn.odoocafepos.com/qr/upi/9b3f2e.png"
    }
  }
}
```