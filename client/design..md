# Odoo Café POS — UI Design System

**Version:** 1.0
**Purpose:** This file is the single source of truth for visual design across the project. Any agent (human or AI) building or editing UI in this codebase must follow these rules. If a screen needs something not covered here, extend this document first, then build — don't invent ad hoc styles inline.

**Applies to:** Backend/Admin Console, POS Terminal, Kitchen Display, Customer Display, Self Ordering (mobile).

---

## 1. Design Principles

1. **Touch-first, glance-fast.** The POS Terminal and KDS are operated on tablets in a busy room. Targets are large, contrast is high, and status is readable from arm's length — not just up close.
2. **Color carries meaning, not decoration.** Category colors, status colors, and accent colors are functional signals (see §3.2, §3.3). Never introduce a new color for purely aesthetic reasons.
3. **One accent, used sparingly.** The coral/salmon accent marks the single primary action on a screen. If everything is accented, nothing is.
4. **Calm surfaces, busy data.** Backgrounds stay neutral (white/cream/grey) so dense data — product grids, order lines, tickets — stays legible. Decoration never competes with content.
5. **Consistency over novelty.** Every screen reuses the same button, card, input, and badge components defined here. Don't design a new button style for a new screen.

---

## 2. Layout & Spacing

### 2.1 Spacing Scale

Use this 4px-based scale for all padding, margin, and gap values. Never use arbitrary pixel values outside this scale.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Icon-to-label gap, tight inline spacing |
| `space-2` | 8px | Default gap between small elements (badge + text) |
| `space-3` | 12px | Input internal padding, compact card padding |
| `space-4` | 16px | Default card padding, gap between form fields |
| `space-5` | 24px | Section spacing, gap between cards in a grid |
| `space-6` | 32px | Gap between major page sections |
| `space-8` | 48px | Page-level top/bottom padding (desktop) |
| `space-10` | 64px | Large hero/empty-state spacing |

### 2.2 Grid & Containers

| Surface | Max width | Grid |
|---|---|---|
| Backend / Admin Console | 1280px, centered | 12-column, 24px gutter |
| POS Terminal | Full viewport, no max-width | 2-pane: Product+Cart (left, ~65%) / Payment (right, ~35%) on tablet landscape |
| Kitchen Display | Full viewport | Responsive ticket grid, `auto-fill`, `minmax(280px, 1fr)` |
| Customer Display | Full viewport | Single centered column, max 480px |
| Self Ordering (mobile) | Full viewport | Single column, 16px side padding |

### 2.3 Border Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Inputs, badges, small chips |
| `radius-md` | 8px | Cards, buttons, popups |
| `radius-lg` | 12px | Modals, product cards in POS grid |
| `radius-full` | 999px | Pills (category tabs, status badges, the floor-number circles) |

### 2.4 Elevation (Shadow)

Use shadows only to lift interactive/floating surfaces off the page — never decoratively on static content.

| Token | Value | Use |
|---|---|---|
| `shadow-none` | none | Default cards, table rows |
| `shadow-sm` | `0 1px 2px rgba(15, 23, 42, 0.06)` | Resting cards (product cards, list rows) |
| `shadow-md` | `0 4px 12px rgba(15, 23, 42, 0.10)` | Popups, dropdowns, the active/selected product card |
| `shadow-lg` | `0 12px 32px rgba(15, 23, 42, 0.16)` | Modals (Discount popup, Customer edit popup, Coupon popup) |

---

## 3. Color System

### 3.1 Core Palette

These are the only base colors in the system. Every other color (category colors, status colors) is layered on top of this neutral foundation — never replaces it.

| Token | Hex | Use |
|---|---|---|
| `color-bg-app` | `#FFFFFF` | Default page/app background |
| `color-bg-cream` | `#FBF3E7` | Cart panel background, Self Ordering default background, warm secondary surfaces |
| `color-bg-subtle` | `#F7F5F2` | Card hover state, table row stripe, disabled input background |
| `color-border` | `#E5E0D8` | Default border on cards, inputs, dividers (warm-toned grey, not cold grey) |
| `color-border-strong` | `#D8CFC0` | Emphasized borders (selected table card outline, focused input) |
| `color-text-primary` | `#2B2520` | Headings, primary body text |
| `color-text-secondary` | `#6B6258` | Helper text, labels, timestamps, secondary metadata |
| `color-text-disabled` | `#A8A096` | Disabled labels, placeholder text |

### 3.2 Accent / Action Colors

The coral accent is the system's **one** signature color. It marks the primary action on every screen — never a secondary or tertiary action.

| Token | Hex | Use |
|---|---|---|
| `color-accent` | `#E8998D` | Primary buttons (Login, Sign Up, Open Session, Send to Kitchen, Confirm Payment), active nav indicator |
| `color-accent-hover` | `#DC8073` | Hover/pressed state of primary buttons |
| `color-accent-soft` | `#F7DAD3` | Primary button disabled state, accent-tinted backgrounds (e.g. selected payment method row) |
| `color-accent-on` | `#FFFFFF` | Text/icon color on top of `color-accent` |

> **Rule:** Never use `color-accent` for more than one primary action per screen. If a screen has both a "Save" and a "Delete," only one (the non-destructive, forward-moving action) gets the accent — Delete uses `color-danger` (§3.3) instead.

### 3.3 Semantic / Status Colors

| Token | Hex | Use |
|---|---|---|
| `color-success` | `#4F9D6E` | Paid status badge, Completed KDS stage, "Active" table status, success toasts |
| `color-success-bg` | `#E5F2E9` | Background fill behind success badges |
| `color-warning` | `#D9A23B` | Preparing KDS stage, Draft order badge, pending/awaiting states |
| `color-warning-bg` | `#FBF0DD` | Background fill behind warning badges |
| `color-danger` | `#D1564B` | Cancelled status, Delete buttons, validation errors, "To Cook" urgency marker if a ticket ages out |
| `color-danger-bg` | `#FAE2DE` | Background fill behind danger badges, error banners |
| `color-info` | `#5B8AB8` | Informational badges, neutral notices (not used for status — only for hints/tips) |

### 3.4 Category Colors (Admin-Configurable)

Category color is **data**, not a fixed design token — the admin picks it per category (PRD §2.3 / §3.3). The design system constrains the picker to a fixed palette so categories stay visually distinct and accessible, rather than allowing arbitrary hex input.

**Allowed category swatch palette (pick exactly one per category):**

```
#E76F51  #F4A261  #E9C46A  #2A9D8F  #287271
#5B8AB8  #8E7DBE  #C9667B  #6B9080  #B5838D
```

Rules:
- Render the category's color as a small **dot/chip** (8px circle) to the left of the category name everywhere it appears: filter tabs, product cards, order lines.
- Never use the category color as a full-bleed card background — it stays a small accent marker so it doesn't compete with `color-accent` or status colors.
- The same hex value renders identically across Backend, POS, KDS, and Self Ordering — never re-themed per surface.

### 3.5 Color Usage Don'ts

- Don't introduce a new accent color for a "fun" feature (e.g. a different color for promotions) — promotions and discounts use `color-success` (savings = positive) consistently.
- Don't use pure black (`#000000`) or pure grey (`#888888`) anywhere — every neutral in this system has a warm undertone (see §3.1 hex values) to match the café aesthetic.
- Don't apply category colors to buttons or navigation — those are reserved for `color-accent` and neutrals.

---

## 4. Typography

### 4.1 Typefaces

| Role | Typeface | Fallback stack |
|---|---|---|
| UI / body / data (default for everything) | **Inter** | `Inter, "Segoe UI", system-ui, sans-serif` |
| Numeric displays (prices, totals, table numbers, order numbers) | **Inter** with `font-feature-settings: "tnum"` (tabular numerals) | same as above |

Only one typeface family is used across the entire product. Do not introduce a second display/serif font — the café branding lives in color and the logo, not in typography. This keeps dense data screens (Orders list, Reports tables) legible at speed.

### 4.2 Type Scale

| Token | Size / Line-height | Weight | Use |
|---|---|---|---|
| `text-display` | 28px / 36px | 700 | Page titles in Backend (e.g. "Products"), session total on Customer Display |
| `text-h1` | 22px / 28px | 700 | Modal/popup titles, section headers |
| `text-h2` | 18px / 24px | 600 | Card titles, table column group headers |
| `text-body` | 14px / 20px | 400 | Default body text, table cell content, form labels |
| `text-body-strong` | 14px / 20px | 600 | Emphasized body text, product names in cart |
| `text-caption` | 12px / 16px | 400 | Helper text, timestamps, "per kg" unit labels |
| `text-price` | 16px / 20px | 600, tabular numerals | Line totals, cart totals |
| `text-price-lg` | 24px / 28px | 700, tabular numerals | Order total, Customer Display amount, KDS ticket number |

### 4.3 Typography Rules

- Never set body text below 12px anywhere — the POS and KDS are read at a distance.
- Headings are always `color-text-primary`; never use the accent color for heading text (accent is reserved for interactive elements per §3.2).
- All currency values use tabular numerals so columns of prices align.
- Truncate long product/customer names with ellipsis rather than wrapping inside fixed-width cards (product cards, ticket cards) — wrapping breaks the grid rhythm.

---

## 5. Components

Every component below is the **only** version of that component in the system. Don't create one-off variants.

### 5.1 Buttons

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `color-accent` | `color-accent-on` | none | The one primary action per screen (Login, Open Session, Send to Kitchen, Save) |
| Secondary | `color-bg-app` | `color-text-primary` | `1px solid color-border-strong` | Cancel, Discard, Back |
| Danger | `color-danger` | `#FFFFFF` | none | Delete, Cancel Order |
| Ghost / Icon-only | transparent | `color-text-secondary` | none | Hamburger menu, search icon, kebab (⋮) menus |
| Disabled (any variant) | `color-accent-soft` (primary) / `color-bg-subtle` (others) | `color-text-disabled` | matches variant | Any button whose action isn't currently valid |

**Sizing:**
- Minimum tap target: 44×44px on POS/KDS/Self Ordering. Backend (mouse-driven) can go to 36px height.
- Button label is always sentence case (`Send to kitchen`, not `Send To Kitchen` or `SEND TO KITCHEN`), per the writing standard in §7.
- Border radius: `radius-md`.

### 5.2 Cards

**Product Card** (POS Order View, Self Ordering menu)
- Background `color-bg-app`, border `1px solid color-border`, radius `radius-lg`, shadow `shadow-sm`.
- Category color dot (8px) + product name (`text-body-strong`) top-left.
- Price bottom-right (`text-price`).
- Selected/active state: border becomes `2px solid color-accent`, shadow upgrades to `shadow-md`. Never change the background fill to indicate selection — only border + shadow.

**Table Card** (Floor pop-up, Table View)
- Circular (`radius-full`), fixed size (e.g. 64×64px), table number centered (`text-h2`).
- Available: `color-bg-app` background, `1px solid color-border`.
- Occupied (active order): `color-accent-soft` background, `1px solid color-accent` border.
- Selected (current table indicator elsewhere in the UI): `color-accent` background, white text.

**Generic Content Card** (Backend list rows, Reports panels)
- Background `color-bg-app`, border `1px solid color-border`, radius `radius-md`, padding `space-4`.

### 5.3 Status Badges

Pill-shaped (`radius-full`), `text-caption`, weight 600, `space-1` vertical / `space-2` horizontal padding.

| Status | Background | Text color |
|---|---|---|
| Draft | `color-warning-bg` | `color-warning` |
| Paid | `color-success-bg` | `color-success` |
| Cancelled | `color-danger-bg` | `color-danger` |
| To Cook (KDS) | `color-danger-bg` | `color-danger` |
| Preparing (KDS) | `color-warning-bg` | `color-warning` |
| Completed (KDS) | `color-success-bg` | `color-success` |

> Rule: status badges always pair a `-bg` token with its matching foreground token. Never mix (e.g. never `color-success-bg` with `color-danger` text).

### 5.4 Forms & Inputs

- Default state: `1px solid color-border`, `radius-sm`, `color-bg-app` background, `space-3` internal padding, `text-body`.
- Focus state: border becomes `1px solid color-accent`, plus a `0 0 0 3px color-accent-soft` focus ring (visible keyboard focus is mandatory — see §8).
- Error state: border `1px solid color-danger`, helper text below in `text-caption`/`color-danger`.
- Labels: `text-body-strong`, `color-text-primary`, always above the input (never placeholder-as-label).
- Password fields always include the show/hide toggle icon (per the mockup's eye icon) — this is a **required** pattern, not optional polish.

### 5.5 Popups / Modals

Used for: Discount popup, Coupon Code entry, Customer create/edit, Receipt email entry, Floor pop-up.

- Centered overlay, backdrop `rgba(43, 37, 32, 0.4)`.
- Modal surface: `color-bg-app`, `radius-lg`, `shadow-lg`, `space-5` padding.
- Always include an explicit close affordance (✕ top-right) — never rely on backdrop-click alone, since POS/KDS are touch devices where mis-taps happen.
- Title uses `text-h1`. Primary action button bottom-right, Secondary/Cancel to its left.

### 5.6 Navigation

**Backend hamburger menu / sidebar:** list items in `text-body`, `color-text-secondary` default, `color-text-primary` + `color-accent` left-border indicator (3px) when active.

**POS top bar:** fixed height 56px, `color-bg-app` background, `1px solid color-border` bottom border. Logo left, search center, action icons + employee avatar right.

### 5.7 Cart / Order Summary Panel

- Background `color-bg-cream` (this is the one place the cream surface token is used at full-panel scale — it visually separates "what's being ordered" from "what's being browsed").
- Line items: product name (`text-body-strong`) + quantity stepper + unit price (`text-caption`, `color-text-secondary`) + line total (`text-price`).
- Discount lines (coupon or automated promotion): `color-success` text, prefixed with a minus sign, e.g. `– ₹54.00`.
- Order summary (Subtotal/Tax/Discount/Total): right-aligned numbers, `Total` row gets `text-price-lg` and a `1px solid color-border` top divider to separate it from the lines above.

---

## 6. Iconography

- Icon set: **Lucide** (outline style, 1.5px stroke) — consistent stroke weight across the whole product, no mixing filled and outline icons.
- Default icon size: 20px inline with `text-body`, 24px for standalone tap targets (nav bar, kebab menus).
- Icons are always paired with a visible text label in the Backend (accessibility + clarity for less-frequent admin actions). Icon-only buttons are permitted only in the POS/KDS top bars where space is constrained and the icon is universally understood (search, print, email, settings).

---

## 7. Content & Writing Standards

These rules apply to every button label, status name, empty state, and error message in the product.

1. **Sentence case everywhere** — buttons, headings, badges. Never Title Case, never ALL CAPS (except the system's own short codes like "UPI" or "GST" which are acronyms, not stylistic choices).
2. **Name actions by what the user controls**, not backend terms: "Send to kitchen," not "Submit order to KDS queue." "Open session," not "Initialize POS session."
3. **A button's label matches the confirmation that follows it.** A button labeled "Send to kitchen" produces a toast/state that says "Sent to kitchen" — never "Success" or "Done."
4. **Errors state what happened and what to do**, without apologizing: "Coupon code is invalid or expired." not "Oops! Something went wrong with your coupon."
5. **Empty states invite the next action**, e.g. an empty Products list reads "No products yet" with a primary "Add product" button directly beneath — not just a blank table.
6. **Currency is always shown with the ₹ symbol and two decimal places**: `₹450.00`, never `Rs. 450` or `450 INR`.

---

## 8. Accessibility Baseline

Non-negotiable for every screen, regardless of surface:

- All interactive elements have a visible keyboard focus state (the focus ring defined in §5.4) — this applies even on touch-primary surfaces like POS/KDS, since they may be navigated by keyboard for accessibility or hardware scanner input.
- Color is never the only signal for status — every status badge (§5.3) pairs color with a text label. Never render a bare colored dot as the sole indicator of Draft/Paid/Cancelled.
- Minimum contrast ratio: 4.5:1 for body text against its background, 3:1 for large text (`text-h1` and above). Verify `color-text-secondary` (#6B6258) against `color-bg-cream` (#FBF3E7) specifically, since this is the system's most common low-contrast pairing — if a redesign changes either token, re-check this pair.
- Respect `prefers-reduced-motion`: transitions (button press, modal open, KDS card stage transitions) drop to instant/near-instant when the user has this preference set.
- Touch targets on POS/KDS/Self Ordering never go below 44×44px, including the spacing around small controls like quantity steppers and the password-reveal icon.

---

## 9. Motion

Motion is used only to clarify state change, never for decoration.

| Interaction | Motion |
|---|---|
| Button press | Scale to 98%, 100ms ease-out |
| Modal open/close | Fade + slight scale (0.96→1.0), 150ms ease-out |
| KDS ticket stage change | Card slides to its new column, 200ms ease-in-out — this is the **one** place a slightly more noticeable animation is justified, since it's the visual confirmation kitchen staff rely on |
| Toast / confirmation | Slide up + fade in, 150ms; auto-dismiss after 3s |
| Real-time data update (price/cart change pushed from server) | No animation — update instantly. Animating every WebSocket-driven update would make the busy screens (Customer Display, KDS) feel jittery |

All durations respect `prefers-reduced-motion` per §8.

---

## 10. Surface-Specific Notes

### 10.1 Backend / Admin Console
Mouse/keyboard optimized. Denser spacing permitted (`space-3`/`space-4` instead of `space-4`/`space-5`). Tables use zebra striping (`color-bg-subtle` on alternate rows) for scanability across long product/order lists.

### 10.2 POS Terminal
Touch-first. Three-pane Order View (Product / Cart / Payment) never collapses below tablet width — this is not a responsive-down-to-mobile surface; assume a minimum 1024px touchscreen.

### 10.3 Kitchen Display
Highest-contrast surface in the system — kitchen environments are bright and staff glance quickly. Ticket cards use `shadow-sm` minimum (never borderless/flat) so cards are unambiguously separated from the background at a glance. Strikethrough for completed items uses `color-text-disabled` plus a literal line-through — never opacity alone.

### 10.4 Customer Display
The most minimal surface — it's read-only and meant to feel calm and trustworthy while a customer is paying. Generous whitespace (`space-6`+ between sections), large `text-price-lg` total, no navigation chrome at all.

### 10.5 Self Ordering (Mobile)
Single-column, thumb-reachable primary actions pinned to the bottom of the viewport (Add to cart, Place order) rather than top — standard mobile ergonomics. Background respects the admin-configured `background_color`/`background_image` (API spec §18.1) layered *under* this design system's components, never replacing card/text tokens.

---

## 11. Implementation Notes for Agents

- Define every token in §2–§4 as actual design tokens in code (CSS variables, Tailwind theme config, or equivalent) — never hardcode a hex value or pixel size inline once a token exists for it.
- If a new screen needs a value not covered here (a new spacing case, a new status), add it to this document in the same pull request that introduces it. This file must stay the single accurate source — don't let implementation drift ahead of it.
- When in doubt between two existing components, reuse the closer match rather than creating a third variant. This document is intentionally small; that's a feature, not a gap.