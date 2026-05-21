# KITERP — Full Implementation Plan

## Audit Summary: What Exists vs What's Needed

### Legend
- DONE = Fully implemented (backend + frontend)
- PARTIAL = Backend exists, frontend incomplete or vice versa
- TODO = Not yet started

---

## 1. Business Setup & Store Configuration

| Feature | Status | Notes |
|---------|--------|-------|
| Business name, logo, address | DONE | Vendor model has all fields, onboarding collects them |
| GSTIN field | TODO | Need to add `gstin` column to Vendor model |
| Business type (Product/Service/Hybrid) | DONE | `offering_type` field exists |
| Operating hours | PARTIAL | `business_hours` JSONB column exists, no UI to edit |
| Holidays | TODO | Need holidays JSONB or separate table |
| Serviceable locations (radius) | DONE | `latitude`, `longitude`, `service_radius_km` with LocationPicker |
| Custom store URL (subdomain) | DONE | `subdomain` + `custom_domain` fields, onboarding flow |
| Store theme (templates) | TODO | `theme_config` JSONB exists but no template system |
| Shareable store link | PARTIAL | URL generated, no WhatsApp share button |
| Multi-language | TODO | Phase 2 |

## 2. Product, Service & Inventory Management

| Feature | Status | Notes |
|---------|--------|-------|
| Product CRUD | DONE | Product model with full fields, API endpoints exist |
| Product categories & variants | DONE | `ProductVariant` model exists with attributes |
| Price, MRP, discount | DONE | `price`, `compare_at_price`, `cost_price` fields |
| SKU & barcode | DONE | Fields exist on Product + ProductVariant |
| Tax mapping (GST % per item) | TODO | Need `tax_rate`, `hsn_code`, `sac_code` fields |
| Product images | DONE | `ProductImage` model + upload API |
| Service CRUD | DONE | Service model with pricing types, API endpoints |
| Service types (hourly, daily, fixed, etc.) | PARTIAL | `price_type` exists, need UOM standardization |
| Time slot & availability | DONE | `ServiceAvailability` model exists |
| Location-based service | TODO | Need `service_mode` field (home_visit/in_store/both) |
| Inventory — stock in/out | TODO | Need `InventoryMovement` table for tracking |
| Auto stock deduction (POS/order/invoice) | TODO | Need to wire into order + future POS flow |
| Low-stock alerts | PARTIAL | `low_stock_threshold` field exists, no notification |
| Inventory history log | TODO | Need `InventoryMovement` table |
| Manual stock adjustment | TODO | Need adjustment API with reason + role check |
| Bulk upload (CSV) | TODO | Phase 2 |
| Product management UI | TODO | Dashboard Products page is placeholder |

## 3. POS (Point of Sale)

| Feature | Status | Notes |
|---------|--------|-------|
| Fast billing screen | TODO | Entire POS module needs to be built |
| Barcode scan / product search | TODO | |
| Cart-level discounts | TODO | |
| Tax auto-calculation | TODO | |
| Cash / UPI / Card split payment | TODO | |
| Invoice print / WhatsApp share | TODO | |
| POS + Inventory sync | TODO | |
| POS returns & refunds | TODO | |
| Day-end Z report | TODO | |

## 4. Payments, Orders & Escrow

| Feature | Status | Notes |
|---------|--------|-------|
| Order model | DONE | `Order` model with full fields |
| Order CRUD + status tracking | DONE | Vendor + customer endpoints exist |
| Payment model | DONE | `Payment` model exists |
| Payment modes (UPI, Card, Cash) | PARTIAL | `payment_method` field, no gateway integration |
| Cart system | DONE | `Cart` model + store cart API |
| Checkout flow | DONE | `/store/orders/checkout` endpoint |
| Partial payment / advance | TODO | Need advance/partial payment fields |
| Split payment (commission) | TODO | Need platform commission logic |
| Escrow | TODO | Phase 2 |
| Payment gateway integration | TODO | Need Razorpay/Stripe integration |

## 5. Billing, GST & Compliance

| Feature | Status | Notes |
|---------|--------|-------|
| Invoice model | TODO | Need `Invoice` table |
| GST & non-GST invoices | TODO | |
| Estimates → Invoice → Receipt | TODO | Need `Estimate`, `Invoice`, `Receipt` models |
| Credit notes & refunds | TODO | |
| Invoice numbering (FY-based) | TODO | |
| HSN/SAC codes | TODO | Need per-product/service fields |
| GST breakup (CGST/SGST/IGST) | TODO | Need tax calculation engine |
| Export PDF + Excel | TODO | |
| Tally-compatible export | TODO | Phase 2 |
| CA access (read-only role) | PARTIAL | Role system exists, need `accountant` role |

## 6. Fulfilment & Service Execution

| Feature | Status | Notes |
|---------|--------|-------|
| Order status tracking | DONE | `status` field with transitions |
| Delivery status tracking | PARTIAL | `tracking_number`, `tracking_url` fields exist |
| Self-delivery / assign staff | TODO | Need delivery assignment model |
| Third-party delivery | TODO | Phase 2 |
| Appointment scheduling | TODO | Need `Booking`/`Appointment` model |
| Technician assignment | TODO | Need assignment model |
| OTP-based job completion | TODO | |
| Service notes & photos | TODO | |
| Revisit / rework | TODO | |

## 7. Marketplace + Lead System

| Feature | Status | Notes |
|---------|--------|-------|
| Customer lead/requirement posting | TODO | Need `Lead` model |
| Category + location + budget | TODO | |
| Photo upload | TODO | |
| Nearby seller notification | TODO | |
| Quote submission | TODO | Need `Quote` model |
| Chat (controlled) | TODO | Phase 2 |
| Lead → Order conversion | TODO | |

## 8. Sales Insights

| Feature | Status | Notes |
|---------|--------|-------|
| Order statistics | DONE | `/vendors/me/orders/stats` endpoint |
| Revenue snapshot | TODO | Need aggregation queries |
| Best-selling product/service | TODO | |
| Repeat customers | TODO | |
| Peak hours | TODO | |
| Conversion funnel | TODO | |
| Demand heatmap | TODO | Phase 2 |

## 9. Employee & Role Management

| Feature | Status | Notes |
|---------|--------|-------|
| Add staff (team) | DONE | VendorUser + team API |
| Role system (owner/admin/manager/etc.) | DONE | VendorRole model + custom roles |
| Granular permissions | DONE | JSONB permissions, permission checks |
| Attendance tracking | TODO | |
| Shift timings | TODO | |
| Salary / commission mapping | TODO | |
| Invite flow | DONE | Team invite endpoint exists |

## 10. Automation & Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| WhatsApp order updates | TODO | Need WhatsApp Business API integration |
| Email notifications | TODO | |
| Low stock alerts | TODO | Threshold exists, need notification trigger |
| Payment reminders | TODO | |
| Booking reminders | TODO | |

## 11. Business Front (Customer-Facing)

| Feature | Status | Notes |
|---------|--------|-------|
| Public catalog API | DONE | Catalog endpoints for products/services |
| Store auth (customer login) | DONE | Customer register/login/profile |
| Cart + checkout | DONE | Cart API + checkout endpoint |
| Reviews | DONE | Review model + endpoints |
| Nearby vendors | DONE | Geo-based vendor discovery |
| Business Front UI pages | TODO | Need full business front React pages |
| Guest checkout | TODO | |
| WhatsApp order confirmation | TODO | |
| Verified seller badge | TODO | |

## 12. CMS & Marketing

| Feature | Status | Notes |
|---------|--------|-------|
| CMS pages (About, Policy, etc.) | TODO | Need `CmsPage` model |
| Coupons / promo codes | TODO | Need `Coupon` model |
| Cart-level offers | TODO | |
| Campaigns | TODO | Phase 2 |

## 13. Platform Admin

| Feature | Status | Notes |
|---------|--------|-------|
| Vendor onboarding & approval | DONE | Full admin flow |
| Plan management | DONE | Plans + feature flags |
| Vendor CRUD | DONE | Create/approve/reject |
| Commission rules | TODO | |
| Category control | TODO | Need platform-level categories |
| Dispute management | TODO | |
| Fraud monitoring | TODO | |

## 14. Multi-Store

| Feature | Status | Notes |
|---------|--------|-------|
| Multiple stores per owner | TODO | Phase 2 — need store hierarchy |
| Separate inventory per store | TODO | |
| Separate GSTIN per store | TODO | |
| Central reporting | TODO | |

## 15. Template System

| Feature | Status | Notes |
|---------|--------|-------|
| Prebuilt layouts | TODO | Need template engine |
| Color & font selection | PARTIAL | `theme_config` exists |
| Logo & banner upload | PARTIAL | Fields exist, upload works |
| Section toggles | TODO | |
| Custom templates | TODO | Phase 2+ |

---

## Implementation Phases

### Phase 1A — Store Configuration & GST Foundation (Week 1)
Priority: HIGH — Everything else depends on this

1. Add `gstin` to Vendor model
2. Build Operating Hours editor UI
3. Add `tax_rate`, `hsn_code`, `sac_code` to Product + Service models
4. Build standard Unit of Measurement system for services
5. Add `service_mode` (home_visit/in_store/both) to Service model
6. Build Product Management UI page (vendor dashboard)
7. Build Service Management UI page (vendor dashboard)

### Phase 1B — Inventory Management (Week 2)
Priority: HIGH — Core business requirement

1. Create `InventoryMovement` model (stock_in, stock_out, adjustment, sale, return)
2. Build inventory tracking API (stock in/out, adjustments with reason)
3. Wire inventory deduction into order checkout
4. Build low-stock alert system
5. Build Inventory Management UI page
6. Build Inventory History log UI

### Phase 1C — Billing & GST Compliance (Week 2-3)
Priority: HIGH — Legal requirement for Indian businesses

1. Create `Invoice` model (GST + non-GST, FY-based numbering)
2. Create `Estimate` model (estimate → invoice conversion)
3. Create `CreditNote` model
4. Build GST calculation engine (CGST/SGST/IGST based on state)
5. Build invoice PDF generator
6. Build billing UI pages (create invoice, list, view)
7. Add HSN/SAC code management

### Phase 1D — POS System (Week 3-4)
Priority: HIGH — Must-have per spec

1. Build POS billing screen (fast product search, barcode input)
2. Build POS cart with tax auto-calculation
3. Build split payment support (cash + UPI + card)
4. Wire POS sales to inventory deduction
5. Build receipt generation (print + WhatsApp share)
6. Build POS returns & refunds
7. Build day-end Z report

### Phase 1E — Public Business Front UI (Week 4-5)
Priority: HIGH — Customer-facing, revenue generating

1. Build business front layout (vendor-branded header, nav, footer)
2. Build home page (featured products/services, categories)
3. Build product listing + detail pages
4. Build service listing + detail + booking pages
5. Build cart page
6. Build checkout page with address + payment selection
7. Build order tracking page
8. Build store CMS pages (About, Policies, Contact)
9. Add coupon/promo code system

### Phase 1F — Order Fulfilment & Service Execution (Week 5-6)
Priority: MEDIUM — Needed for complete order lifecycle

1. Build delivery assignment (self-delivery, assign staff)
2. Build delivery tracking UI
3. Create `Booking`/`Appointment` model for services
4. Build appointment scheduling UI
5. Build technician assignment
6. Build OTP-based job completion
7. Build service notes & photo upload

### Phase 1G — Enhanced Roles & Employee Management (Week 6)
Priority: MEDIUM — Needed before POS goes live

1. Add `cashier`, `delivery_staff`, `technician`, `accountant` system roles
2. Build attendance tracking model + API
3. Build shift timing management
4. Build employee management UI in vendor dashboard
5. Wire POS permission checks to cashier role

### Phase 1H — Marketplace & Lead System (Week 7-8)
Priority: MEDIUM — Key differentiator

1. Create `Lead` model (requirement, category, location, budget, photos)
2. Create `Quote` model (price, time, conditions)
3. Build customer requirement posting flow
4. Build nearby seller notification system
5. Build quote submission + comparison UI
6. Build lead → order conversion

### Phase 2 — Future Enhancements
- Escrow payments
- Third-party delivery integration
- WhatsApp catalog sync + 'Order via WhatsApp"
- Multi-store hierarchy
- Advanced templates (HTML/CSS)
- Tally export
- Multi-language support
- Expense module & P&L
- Domain mapping + SSL automation
- Demand heatmap
- Chat system
- Bulk CSV upload
- Offline POS support
- Advanced analytics

---

## Database Models Needed (New)

| Model | Phase | Purpose |
|-------|-------|---------|
| `InventoryMovement` | 1B | Stock in/out/adjustment tracking |
| `Invoice` | 1C | GST invoices with FY numbering |
| `Estimate` | 1C | Quotes that convert to invoices |
| `CreditNote` | 1C | Refund/credit notes |
| `TaxConfig` | 1C | GST rates, HSN/SAC codes |
| `PosSession` | 1D | POS shift/session tracking |
| `PosTransaction` | 1D | POS sale records |
| `CmsPage` | 1E | Vendor CMS pages |
| `Coupon` | 1E | Discount codes |
| `Booking` | 1F | Service appointments |
| `DeliveryAssignment` | 1F | Delivery staff assignments |
| `Attendance` | 1G | Employee attendance |
| `Lead` | 1H | Customer requirements |
| `Quote` | 1H | Seller quotes on leads |

---

## Existing Models to Modify

| Model | Changes | Phase |
|-------|---------|-------|
| `Vendor` | Add `gstin`, `holidays` JSONB | 1A |
| `Product` | Add `tax_rate`, `hsn_code`, `is_taxable` | 1A |
| `Service` | Add `sac_code`, `tax_rate`, `service_mode`, `uom` | 1A |
| `Order` | Add `invoice_id`, `delivery_assignment_id` | 1C/1F |
| `VendorRole` | Add system roles: cashier, technician, accountant | 1G |
