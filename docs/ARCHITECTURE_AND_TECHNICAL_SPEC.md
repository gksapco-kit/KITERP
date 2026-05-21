# ArT (Ask r Task) – Architecture & Technical Specification

## 1. Document Purpose and Scope

This document defines the system architecture and technical specification for ArT: a two-sided marketplace where **Askers** post requests and **Taskers** respond with quotes, with negotiation, escrow, stores, and pluggable behavioral modules (Service, Product, Cab).

---

## 2. Architectural Principles

| Principle | Description |
|-----------|-------------|
| **Single Order Engine** | One core order/quote/negotiation model. Category determines which behavioral module(s) apply, not separate silos. |
| **Pluggable Behavioral Modules** | Service, Product, Cab (and future) are modules that plug into the core; they add workflows and UIs, not separate order systems. |
| **Store as Tenant** | Each Tasker/Store is a logical tenant: storefront, inventory, employees, payments, and reports are scoped per store. |
| **Category-Driven Behavior** | Order/Ask category (e.g. `service`, `product`, `cab`) drives which module(s) activate (execution, inventory, tracking). |
| **Trust by Design** | Verification, escrow, and mandatory feedback are first-class in the core and APIs. |

---

## 3. High-Level Architecture

### 3.1 Layered View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Presentation Layer                                                          │
│  Web App (Asker/Tasker/Storefront) │ Native Apps (Store/Consumer) │ Admin    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Gateway / BFF (optional)                                                 │
│  Auth, rate limit, routing, API versioning                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│  Core Domain Layer                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Ask & Order Core                                                    │   │
│  │  Asks, Quotes, Negotiation, Orders, Agreements, Escrow state          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ Service      │ │ Product      │ │ Cab/Tracking │ │ Store        │      │
│  │ Module       │ │ Module       │ │ Module       │ │ Module       │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shared Services                                                             │
│  Identity & Verification │ Payments & Escrow │ Notifications │ Search       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│  Data Layer                                                                  │
│  Primary DB (orders, users, stores) │ Search/analytics │ Blob (docs, media) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core vs Modules

- **Core**: User/Asker/Tasker, Ask, Quote (versions), Negotiation events, Order, Agreement, Escrow state, Categories, Mandatory feedback.
- **Modules** (category-driven):
  - **Service**: Execution workflow, required materials (if asker provides), quote/project, subscription.
  - **Product**: Catalog, inventory, sales (linked to same order engine).
  - **Cab/Tracking**: Parcel/dispatch tracking, status updates.
  - **Store**: Storefront, catalog, inventory, employees/roles (light HR), payments/finance, reports; share links and publish to Play/App/Web.

---

## 4. Domain Model (Core)

### 4.1 Core Entities

| Entity | Purpose |
|--------|--------|
| **User** | Identity; can act as Asker and/or Tasker (and Store owner). |
| **AskerProfile** | Consumer-facing profile, preferences. |
| **TaskerProfile** | Skills, verification status, documents, linked stores. |
| **Category** | e.g. `service`, `product`, `cab`; determines active module(s). |
| **Ask** | Request from Asker: title, description, category, location, attachments, optional materials. |
| **Quote** | Tasker response to Ask; versioned; amount, validity, terms. |
| **Negotiation** | Sequence of events: revision request, counter-offer, accept, decline, freeze. |
| **Order** | Result of accepted quote; single source of truth for fulfillment and payment. |
| **Agreement** | Final agreed terms (snapshot at acceptance). |
| **EscrowRecord** | Hold/release/refund state per order. |
| **Feedback** | Asker → Tasker; mandatory after completion (timing/dependency rules from Tasker). |
| **Store** | Tasker-owned; storefront, catalog, employees, finance; share link and app publish. |

### 4.2 Quote and Negotiation State Machine

```
                    ┌─────────────┐
                    │   SUBMITTED │
                    └──────┬──────┘
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   REVISION_REQUESTED   ACCEPTED        REJECTED
         │                 │
         │    ┌────────────┴────────────┐
         │    │                         │
         ▼    ▼                         ▼
   COUNTER_OFFER              FROZEN / NEGOTIATION_ENDED
         │
         └──────► (cycle until ACCEPTED / REJECTED / FROZEN)
```

- **Freeze / Reject (negotiation)**: Any party can set negotiation to `FROZEN` or terminal `REJECTED`; no further quote versions or counter-offers allowed.
- **Quote versions**: Each revision/counter creates a new version; order references the accepted version.

### 4.3 Order Lifecycle (Core Engine)

- **Created** (from accepted quote).
- **Escrow_hold** (payment held).
- **In_progress** (Tasker fulfilling; module-specific sub-states).
- **Completed** (fulfillment done; triggers mandatory feedback).
- **Disputed** (optional).
- **Closed** (released/refunded; feedback given).

Category determines which module drives "In_progress" (e.g. Service execution, Product dispatch, Cab tracking).

---

## 5. Behavioral Modules (Technical)

### 5.1 Service Module

- **Activated when**: Ask/Order category = service (or equivalent).
- **Responsibilities**:
  - Quote/project details (deliverables, milestones).
  - Optional "required materials" (if asker provides): capture and attach to order.
  - Execution states: e.g. Not started, In progress, Milestone reached, Completed.
  - Subscription: recurring orders linked to same Ask or template.
- **Data**: `ServiceOrderExtension`, `RequiredMaterials`, `SubscriptionTemplate`, `SubscriptionInstance`.

### 5.2 Product Module

- **Activated when**: Category = product (or store product sale).
- **Responsibilities**: Catalog, inventory (reserve on order, release on cancel), pricing, variants.
- **Integration**: Same Order from core; line items reference product/SKU; inventory service called on order state changes.

### 5.3 Cab / Tracking Module

- **Activated when**: Category = cab or parcel/dispatch.
- **Responsibilities**: Trip/dispatch creation, live/estimated location, status (e.g. assigned, picked up, in transit, delivered).
- **Data**: `Trip`, `TrackingEvent`; optional external provider webhooks for GPS/status.

### 5.4 Store Module

- **Scope**: Per Tasker (or per Store entity).
- **Components**:
  - **Business Front**: Themed customer view; product/service catalog; cart/checkout producing Orders in core.
  - **Admin**: Store CRUD, catalog, inventory, employees/roles (light HR), payments/finance, reports.
  - **Share & publish**: Short links, embed, PWA/App/Play Store/App Store; same backend, different entry URLs/apps.
- **Multi-tenancy**: StoreId on all store-scoped data; optional subdomain or path-based routing.

---

## 6. Shared Services

### 6.1 Identity and Verification

- **Auth**: JWT or session-based; roles: Asker, Tasker, Store admin, Platform admin.
- **Tasker verification**: Document upload (ID, business proof); workflow: Pending → Verified/Rejected; verified flag on TaskerProfile used in discovery and trust UI.

### 6.2 Payments and Escrow

- **Escrow flow**: On order acceptance → create payment hold (amount from agreement); on completion → release to Tasker; on cancel/dispute → refund per policy.
- **Integrations**: Stripe, Razorpay, or similar (payment intents, captures, refunds); webhooks for async status.
- **Records**: PaymentIntent/Charge ids stored in EscrowRecord; idempotency for release/refund.

### 6.3 Notifications

- In-app and optionally email/push: quote received, revision requested, accepted, order status, feedback due.

### 6.4 Search and Discovery

- Asks (by category, location, date); Taskers (by skill, verified); Store products. Use search engine (e.g. Elasticsearch/OpenSearch) or DB full-text with clear indexing rules.

---

## 7. Security and Trust

- **AuthZ**: Asker can only manage own Asks and orders; Tasker only own quotes and orders; Store admin only own store data.
- **Escrow**: Funds held by platform/payment provider until completion or refund policy.
- **Verification**: Only verified Taskers (and stores) shown as "verified" in UI; optional filters.
- **Mandatory feedback**: Order cannot move to "Closed" until Asker has submitted feedback (or grace period/timeout defined by Tasker); enforcement in state machine and API.

---

## 8. API Design (Conventions)

- **REST** for CRUD and actions; **versioning** (e.g. `/v1/asks`, `/v1/quotes`).
- **Idempotency**: Key on payment and order state changes.
- **Pagination**: Cursor or offset for lists (asks, quotes, orders, store orders).
- **Filtering**: By category, status, date range, Tasker/Asker.

Example resource groups:

- `/v1/asks`, `/v1/asks/:id/quotes`, `/v1/quotes/:id/negotiate`, `/v1/orders`, `/v1/orders/:id/feedback`
- `/v1/stores`, `/v1/stores/:id/catalog`, `/v1/stores/:id/orders`, `/v1/stores/:id/employees`
- `/v1/tracking/orders/:orderId` (Cab module)

---

## 9. Data Storage (Recommendations)

- **Primary DB**: Relational (e.g. PostgreSQL) for users, asks, quotes, orders, agreements, escrow, stores, catalog, inventory.
- **Documents/files**: Blob store (S3-compatible) for verification docs, attachments, store assets.
- **Search**: Elasticsearch/OpenSearch for asks, taskers, store products.
- **Analytics/reports**: Same DB + read replicas or data warehouse for Store/Tasker reports.

---

## 10. Non-Functional Requirements

- **Availability**: Target 99.5% or higher for core order and payment flows.
- **Latency**: API p95 < 500 ms for read paths; payment webhooks processed with retries.
- **Audit**: Log order state changes, quote versions, negotiation events, and payment actions for dispute and compliance.
- **Scalability**: Stateless API; horizontal scaling; queue for notifications and heavy reporting.

---

## 11. Deployment and Environments

- **Environments**: Dev, Staging, Production.
- **Secrets**: API keys (payments, storage) in secret manager; no secrets in code.
- **CI/CD**: Build, test, deploy API and frontends; run migrations before deploy.

---

## 12. Out of Scope for This Spec

- Detailed UI wireframes and theme system implementation.
- Exact payment provider and fee structure.
- App Store/Play Store submission process (handled as release process, not architecture).
- Full HR/payroll (only "light HR" under Store: roles and basic employee linkage).
