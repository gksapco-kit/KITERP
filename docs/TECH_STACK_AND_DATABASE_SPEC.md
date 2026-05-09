# ArT (Ask r Task) – Tech Stack & Database Specification

## 1. Overview

This document defines the technology stack and database schema for ArT, aligning with the Architecture and Technical Spec. It covers backend, frontend, database design, caching, messaging, storage, and infrastructure.

---

## 2. Technology Stack

### 2.1 Backend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | Node.js (TypeScript) or Python (FastAPI) or Go | TypeScript for full-stack consistency; Python for rapid prototyping; Go for performance. |
| **Framework** | NestJS (Node) / FastAPI (Python) / Gin (Go) | Structured, scalable, good ecosystem. |
| **API Style** | REST (primary), WebSocket (real-time tracking) | REST for CRUD; WebSocket for cab tracking and notifications. |
| **API Documentation** | OpenAPI 3.0 (Swagger) | Auto-generated docs, client SDK generation. |

### 2.2 Database

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Primary DB** | PostgreSQL 15+ | ACID, JSON support, full-text search, mature ecosystem. |
| **ORM** | Prisma (Node) / SQLAlchemy (Python) / GORM (Go) | Type-safe queries, migrations, schema management. |
| **Search** | PostgreSQL full-text (v1), Elasticsearch/OpenSearch (scale) | Start simple; add dedicated search engine as data grows. |
| **Cache** | Redis | Session cache, rate limiting, real-time pub/sub. |

### 2.3 Message Queue & Background Jobs

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Queue** | Redis (BullMQ) or RabbitMQ or AWS SQS | Async jobs: notifications, escrow release, reports. |
| **Scheduler** | node-cron / Celery Beat / Go cron | Recurring jobs: subscription renewals, feedback reminders. |

### 2.4 Storage

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Blob Storage** | AWS S3 / Google Cloud Storage / MinIO | Verification docs, attachments, store assets. |
| **CDN** | CloudFront / Cloudflare | Fast asset delivery for storefront images. |

### 2.5 Authentication & Authorization

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Auth** | JWT (access + refresh tokens) | Stateless, mobile-friendly. |
| **OAuth** | Google, Apple Sign-In (optional) | Social login for faster onboarding. |
| **RBAC** | Custom middleware or Casbin/CASL | Role-based access: Asker, Tasker, Store Admin, Platform Admin. |

### 2.6 Payments & Escrow

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Payment Gateway** | Stripe / Razorpay / PayPal | Payment intents, holds, captures, refunds. |
| **Escrow** | Custom logic + payment provider holds | Hold on order acceptance; release on completion. |

### 2.7 Notifications

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Push (Mobile)** | Firebase Cloud Messaging (FCM) + APNs | Cross-platform push notifications. |
| **Email** | SendGrid / AWS SES / Postmark | Transactional emails: quotes, orders, verification. |
| **SMS (optional)** | Twilio / AWS SNS | OTP, critical alerts. |
| **In-App** | WebSocket + DB storage | Real-time + persistent notification center. |

### 2.8 Infrastructure & DevOps

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Cloud** | AWS / GCP / Azure | Managed services, global availability. |
| **Containers** | Docker | Consistent environments. |
| **Orchestration** | Kubernetes (EKS/GKE) or ECS / Cloud Run | Scalable deployments. |
| **CI/CD** | GitHub Actions / GitLab CI / CircleCI | Automated build, test, deploy. |
| **Secrets** | AWS Secrets Manager / HashiCorp Vault | Secure credential storage. |
| **Monitoring** | Prometheus + Grafana / Datadog / New Relic | Metrics, alerting. |
| **Logging** | ELK Stack / CloudWatch / Datadog Logs | Centralized logs. |
| **APM** | Sentry / Datadog APM | Error tracking, performance. |

### 2.9 Recommended Stack Summary

| Layer | Recommendation |
|-------|----------------|
| Backend | **NestJS (TypeScript)** on Node.js |
| Database | **PostgreSQL 15** |
| Cache | **Redis** |
| Queue | **BullMQ** (Redis-backed) |
| Storage | **AWS S3** + CloudFront |
| Auth | **JWT** + optional OAuth |
| Payments | **Stripe** (or Razorpay for India) |
| Push | **FCM** + APNs |
| Email | **SendGrid** |
| Infra | **AWS** (ECS or EKS), Docker |

---

## 3. Database Schema Design

### 3.1 Schema Overview (ERD Summary)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │───────│ AskerProfile │       │TaskerProfile │
└──────────────┘       └──────────────┘       └──────────────┘
       │                                              │
       │                                              │
       ▼                                              ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     Ask      │◄──────│    Quote     │───────│  QuoteVersion│
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │
       │                      │
       ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Order     │───────│  Agreement   │       │ EscrowRecord │
└──────────────┘       └──────────────┘       └──────────────┘
       │
       ├───────────────┬───────────────┐
       ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ServiceOrder  │ │ ProductOrder │ │    Trip      │
│  Extension   │ │   LineItem   │ │  (Cab/Track) │
└──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Store     │───────│   Product    │───────│  Inventory   │
└──────────────┘       └──────────────┘       └──────────────┘
       │
       ▼
┌──────────────┐       ┌──────────────┐
│   Employee   │       │  StoreOrder  │
└──────────────┘       └──────────────┘
```

---

### 3.2 Core Tables

#### 3.2.1 User

```sql
CREATE TABLE "user" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_phone ON "user"(phone);
```

#### 3.2.2 AskerProfile

```sql
CREATE TABLE asker_profile (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    default_location GEOGRAPHY(POINT, 4326),
    address         TEXT,
    preferences     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asker_profile_user_id ON asker_profile(user_id);
```

#### 3.2.3 TaskerProfile

```sql
CREATE TABLE tasker_profile (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    bio                 TEXT,
    skills              TEXT[],
    verification_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected
    verification_docs   JSONB DEFAULT '[]',
    rating_avg          DECIMAL(3,2) DEFAULT 0.00,
    rating_count        INTEGER DEFAULT 0,
    is_available        BOOLEAN DEFAULT TRUE,
    location            GEOGRAPHY(POINT, 4326),
    service_radius_km   INTEGER DEFAULT 10,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasker_profile_user_id ON tasker_profile(user_id);
CREATE INDEX idx_tasker_profile_verification ON tasker_profile(verification_status);
CREATE INDEX idx_tasker_profile_skills ON tasker_profile USING GIN(skills);
CREATE INDEX idx_tasker_profile_location ON tasker_profile USING GIST(location);
```

#### 3.2.4 Category

```sql
CREATE TABLE category (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    parent_id       UUID REFERENCES category(id),
    module_type     VARCHAR(20) NOT NULL, -- service, product, cab
    icon_url        TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_category_slug ON category(slug);
CREATE INDEX idx_category_parent ON category(parent_id);
CREATE INDEX idx_category_module ON category(module_type);
```

---

### 3.3 Ask & Quote Tables

#### 3.3.1 Ask

```sql
CREATE TABLE ask (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asker_id        UUID NOT NULL REFERENCES "user"(id),
    category_id     UUID NOT NULL REFERENCES category(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    location        GEOGRAPHY(POINT, 4326),
    address         TEXT,
    attachments     JSONB DEFAULT '[]',
    materials_provided JSONB DEFAULT '[]', -- if asker provides materials
    budget_min      DECIMAL(12,2),
    budget_max      DECIMAL(12,2),
    deadline        TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'open', -- open, in_progress, completed, cancelled
    is_urgent       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ask_asker ON ask(asker_id);
CREATE INDEX idx_ask_category ON ask(category_id);
CREATE INDEX idx_ask_status ON ask(status);
CREATE INDEX idx_ask_location ON ask USING GIST(location);
CREATE INDEX idx_ask_created ON ask(created_at DESC);
```

#### 3.3.2 Quote

```sql
CREATE TABLE quote (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ask_id              UUID NOT NULL REFERENCES ask(id),
    tasker_id           UUID NOT NULL REFERENCES "user"(id),
    current_version_id  UUID, -- points to latest QuoteVersion
    negotiation_status  VARCHAR(30) DEFAULT 'submitted', 
        -- submitted, revision_requested, counter_offered, accepted, rejected, frozen
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(ask_id, tasker_id) -- one quote per tasker per ask
);

CREATE INDEX idx_quote_ask ON quote(ask_id);
CREATE INDEX idx_quote_tasker ON quote(tasker_id);
CREATE INDEX idx_quote_status ON quote(negotiation_status);
```

#### 3.3.3 QuoteVersion

```sql
CREATE TABLE quote_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    description     TEXT,
    deliverables    JSONB DEFAULT '[]',
    estimated_duration_hours INTEGER,
    valid_until     TIMESTAMPTZ,
    terms           TEXT,
    created_by      VARCHAR(10) NOT NULL, -- asker, tasker
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(quote_id, version_number)
);

CREATE INDEX idx_quote_version_quote ON quote_version(quote_id);
```

#### 3.3.4 NegotiationEvent

```sql
CREATE TABLE negotiation_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
    actor_id        UUID NOT NULL REFERENCES "user"(id),
    event_type      VARCHAR(30) NOT NULL,
        -- submitted, revision_requested, counter_offered, accepted, rejected, frozen
    quote_version_id UUID REFERENCES quote_version(id),
    message         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_negotiation_quote ON negotiation_event(quote_id);
CREATE INDEX idx_negotiation_created ON negotiation_event(created_at);
```

---

### 3.4 Order & Agreement Tables

#### 3.4.1 Order

```sql
CREATE TABLE "order" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        VARCHAR(20) UNIQUE NOT NULL,
    ask_id              UUID REFERENCES ask(id),
    quote_id            UUID REFERENCES quote(id),
    quote_version_id    UUID REFERENCES quote_version(id),
    asker_id            UUID NOT NULL REFERENCES "user"(id),
    tasker_id           UUID NOT NULL REFERENCES "user"(id),
    store_id            UUID REFERENCES store(id), -- if store order
    category_id         UUID NOT NULL REFERENCES category(id),
    module_type         VARCHAR(20) NOT NULL, -- service, product, cab
    status              VARCHAR(30) DEFAULT 'created',
        -- created, escrow_hold, in_progress, completed, disputed, cancelled, closed
    subtotal            DECIMAL(12,2) NOT NULL,
    platform_fee        DECIMAL(12,2) DEFAULT 0,
    tax                 DECIMAL(12,2) DEFAULT 0,
    total               DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(3) DEFAULT 'INR',
    payment_status      VARCHAR(20) DEFAULT 'pending',
        -- pending, escrow_held, released, refunded
    scheduled_at        TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_number ON "order"(order_number);
CREATE INDEX idx_order_asker ON "order"(asker_id);
CREATE INDEX idx_order_tasker ON "order"(tasker_id);
CREATE INDEX idx_order_store ON "order"(store_id);
CREATE INDEX idx_order_status ON "order"(status);
CREATE INDEX idx_order_created ON "order"(created_at DESC);
```

#### 3.4.2 Agreement

```sql
CREATE TABLE agreement (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID UNIQUE NOT NULL REFERENCES "order"(id),
    quote_version_id    UUID NOT NULL REFERENCES quote_version(id),
    terms_snapshot      JSONB NOT NULL, -- full quote version snapshot
    agreed_amount       DECIMAL(12,2) NOT NULL,
    agreed_at           TIMESTAMPTZ DEFAULT NOW(),
    asker_accepted_at   TIMESTAMPTZ,
    tasker_accepted_at  TIMESTAMPTZ
);

CREATE INDEX idx_agreement_order ON agreement(order_id);
```

#### 3.4.3 EscrowRecord

```sql
CREATE TABLE escrow_record (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES "order"(id),
    payment_intent_id       VARCHAR(255), -- Stripe/Razorpay payment intent
    amount                  DECIMAL(12,2) NOT NULL,
    currency                VARCHAR(3) DEFAULT 'INR',
    status                  VARCHAR(20) DEFAULT 'pending',
        -- pending, held, released, refunded, failed
    held_at                 TIMESTAMPTZ,
    released_at             TIMESTAMPTZ,
    refunded_at             TIMESTAMPTZ,
    release_to_tasker_amount DECIMAL(12,2),
    platform_fee_amount     DECIMAL(12,2),
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_escrow_order ON escrow_record(order_id);
CREATE INDEX idx_escrow_status ON escrow_record(status);
CREATE INDEX idx_escrow_payment_intent ON escrow_record(payment_intent_id);
```

---

### 3.5 Module Extension Tables

#### 3.5.1 ServiceOrderExtension (Service Module)

```sql
CREATE TABLE service_order_extension (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID UNIQUE NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    execution_status    VARCHAR(30) DEFAULT 'not_started',
        -- not_started, in_progress, milestone_reached, completed
    milestones          JSONB DEFAULT '[]',
    required_materials  JSONB DEFAULT '[]',
    materials_provided_by VARCHAR(10), -- asker, tasker, none
    work_notes          TEXT,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_service_ext_order ON service_order_extension(order_id);
```

#### 3.5.2 ProductOrderLineItem (Product Module)

```sql
CREATE TABLE product_order_line_item (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES product(id),
    variant_id      UUID REFERENCES product_variant(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      DECIMAL(12,2) NOT NULL,
    total_price     DECIMAL(12,2) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_line_item_order ON product_order_line_item(order_id);
CREATE INDEX idx_line_item_product ON product_order_line_item(product_id);
```

#### 3.5.3 Trip (Cab/Tracking Module)

```sql
CREATE TABLE trip (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID UNIQUE NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    driver_id           UUID REFERENCES "user"(id), -- tasker driving
    vehicle_info        JSONB DEFAULT '{}',
    pickup_location     GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address      TEXT,
    dropoff_location    GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_address     TEXT,
    current_location    GEOGRAPHY(POINT, 4326),
    status              VARCHAR(20) DEFAULT 'pending',
        -- pending, assigned, picked_up, in_transit, delivered, cancelled
    estimated_arrival   TIMESTAMPTZ,
    distance_km         DECIMAL(10,2),
    picked_up_at        TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trip_order ON trip(order_id);
CREATE INDEX idx_trip_driver ON trip(driver_id);
CREATE INDEX idx_trip_status ON trip(status);
CREATE INDEX idx_trip_current_location ON trip USING GIST(current_location);
```

#### 3.5.4 TrackingEvent

```sql
CREATE TABLE tracking_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
    location        GEOGRAPHY(POINT, 4326),
    status          VARCHAR(30),
    notes           TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_trip ON tracking_event(trip_id);
CREATE INDEX idx_tracking_recorded ON tracking_event(recorded_at);
```

---

### 3.6 Feedback Table

```sql
CREATE TABLE feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID UNIQUE NOT NULL REFERENCES "order"(id),
    asker_id        UUID NOT NULL REFERENCES "user"(id),
    tasker_id       UUID NOT NULL REFERENCES "user"(id),
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review          TEXT,
    is_public       BOOLEAN DEFAULT TRUE,
    tasker_response TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_order ON feedback(order_id);
CREATE INDEX idx_feedback_tasker ON feedback(tasker_id);
CREATE INDEX idx_feedback_rating ON feedback(rating);
```

---

### 3.7 Store Tables

#### 3.7.1 Store

```sql
CREATE TABLE store (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES "user"(id),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    description         TEXT,
    logo_url            TEXT,
    banner_url          TEXT,
    theme               VARCHAR(50) DEFAULT 'default',
    contact_email       VARCHAR(255),
    contact_phone       VARCHAR(20),
    address             TEXT,
    location            GEOGRAPHY(POINT, 4326),
    business_hours      JSONB DEFAULT '{}',
    social_links        JSONB DEFAULT '{}',
    settings            JSONB DEFAULT '{}',
    is_verified         BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    published_web       BOOLEAN DEFAULT FALSE,
    published_android   BOOLEAN DEFAULT FALSE,
    published_ios       BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_store_owner ON store(owner_id);
CREATE INDEX idx_store_slug ON store(slug);
CREATE INDEX idx_store_location ON store USING GIST(location);
```

#### 3.7.2 Product

```sql
CREATE TABLE product (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES store(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES category(id),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    description     TEXT,
    images          JSONB DEFAULT '[]',
    base_price      DECIMAL(12,2) NOT NULL,
    sale_price      DECIMAL(12,2),
    currency        VARCHAR(3) DEFAULT 'INR',
    sku             VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    is_featured     BOOLEAN DEFAULT FALSE,
    attributes      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(store_id, slug)
);

CREATE INDEX idx_product_store ON product(store_id);
CREATE INDEX idx_product_category ON product(category_id);
CREATE INDEX idx_product_sku ON product(sku);
```

#### 3.7.3 ProductVariant

```sql
CREATE TABLE product_variant (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    sku             VARCHAR(100),
    price           DECIMAL(12,2) NOT NULL,
    attributes      JSONB DEFAULT '{}', -- e.g., {"size": "M", "color": "Red"}
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variant_product ON product_variant(product_id);
CREATE INDEX idx_variant_sku ON product_variant(sku);
```

#### 3.7.4 Inventory

```sql
CREATE TABLE inventory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    variant_id      UUID REFERENCES product_variant(id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL DEFAULT 0,
    reserved        INTEGER NOT NULL DEFAULT 0, -- reserved for pending orders
    low_stock_threshold INTEGER DEFAULT 5,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id, variant_id)
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
```

#### 3.7.5 Employee

```sql
CREATE TABLE employee (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES store(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES "user"(id),
    role            VARCHAR(50) NOT NULL, -- admin, manager, staff
    permissions     JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT TRUE,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(store_id, user_id)
);

CREATE INDEX idx_employee_store ON employee(store_id);
CREATE INDEX idx_employee_user ON employee(user_id);
```

---

### 3.8 Subscription Tables (Service Module)

```sql
CREATE TABLE subscription_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tasker_id       UUID NOT NULL REFERENCES "user"(id),
    store_id        UUID REFERENCES store(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category_id     UUID REFERENCES category(id),
    frequency       VARCHAR(20) NOT NULL, -- daily, weekly, monthly, yearly
    price           DECIMAL(12,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscription (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES subscription_template(id),
    asker_id            UUID NOT NULL REFERENCES "user"(id),
    tasker_id           UUID NOT NULL REFERENCES "user"(id),
    status              VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled
    current_period_start TIMESTAMPTZ,
    current_period_end  TIMESTAMPTZ,
    next_billing_date   TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_asker ON subscription(asker_id);
CREATE INDEX idx_subscription_tasker ON subscription(tasker_id);
CREATE INDEX idx_subscription_status ON subscription(status);
```

---

### 3.9 Notification Table

```sql
CREATE TABLE notification (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES "user"(id),
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    data            JSONB DEFAULT '{}',
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_user ON notification(user_id);
CREATE INDEX idx_notification_read ON notification(user_id, is_read);
CREATE INDEX idx_notification_created ON notification(created_at DESC);
```

---

### 3.10 Audit Log Table

```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(50) NOT NULL, -- order, quote, escrow, etc.
    entity_id       UUID NOT NULL,
    action          VARCHAR(50) NOT NULL, -- created, updated, status_changed, etc.
    actor_id        UUID REFERENCES "user"(id),
    actor_type      VARCHAR(20), -- user, system, webhook
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
```

---

## 4. Database Relationships Summary

| Relationship | Type | Description |
|--------------|------|-------------|
| User → AskerProfile | 1:1 | User can have one asker profile |
| User → TaskerProfile | 1:1 | User can have one tasker profile |
| User → Ask | 1:N | Asker creates many asks |
| Ask → Quote | 1:N | Ask receives many quotes |
| Quote → QuoteVersion | 1:N | Quote has many versions |
| Quote → Order | 1:1 | Accepted quote creates one order |
| Order → Agreement | 1:1 | Order has one agreement |
| Order → EscrowRecord | 1:N | Order can have multiple escrow records |
| Order → ServiceOrderExtension | 1:1 | Service order extension |
| Order → ProductOrderLineItem | 1:N | Product order line items |
| Order → Trip | 1:1 | Cab order has one trip |
| Order → Feedback | 1:1 | Order has one feedback |
| User → Store | 1:N | Tasker can own multiple stores |
| Store → Product | 1:N | Store has many products |
| Product → ProductVariant | 1:N | Product has many variants |
| Product → Inventory | 1:1 or 1:N | Product/variant has inventory |
| Store → Employee | 1:N | Store has many employees |

---

## 5. Indexing Strategy

### 5.1 Primary Indexes
- All primary keys (UUID) are indexed by default.
- Unique constraints create indexes automatically.

### 5.2 Foreign Key Indexes
- All foreign keys should have indexes for JOIN performance.

### 5.3 Query-Specific Indexes
| Query Pattern | Index |
|---------------|-------|
| Find asks by location | GiST index on `ask.location` |
| Find taskers by skills | GIN index on `tasker_profile.skills` |
| Find taskers by location | GiST index on `tasker_profile.location` |
| Orders by status | B-tree on `order.status` |
| Orders by date | B-tree DESC on `order.created_at` |
| Search products | Full-text on `product.name`, `product.description` |

### 5.4 Composite Indexes
```sql
-- Orders for a specific user by status
CREATE INDEX idx_order_asker_status ON "order"(asker_id, status);
CREATE INDEX idx_order_tasker_status ON "order"(tasker_id, status);

-- Quotes for an ask by status
CREATE INDEX idx_quote_ask_status ON quote(ask_id, negotiation_status);

-- Notifications unread for user
CREATE INDEX idx_notification_user_unread ON notification(user_id, is_read) WHERE is_read = FALSE;
```

---

## 6. Data Migration Strategy

1. **Version control**: Use migrations (Prisma Migrate, Alembic, golang-migrate).
2. **Naming**: `YYYYMMDDHHMMSS_description.sql` or framework convention.
3. **Rollback**: Every migration should have a down/rollback script.
4. **Zero-downtime**: Use expand-contract pattern for breaking changes.
5. **Seed data**: Categories, default settings loaded via seed scripts.

---

## 7. Backup and Recovery

| Strategy | Implementation |
|----------|----------------|
| **Automated backups** | Daily full backup, hourly incremental (AWS RDS, Cloud SQL) |
| **Point-in-time recovery** | Enable PITR (up to 35 days) |
| **Cross-region replication** | For disaster recovery |
| **Backup testing** | Monthly restore tests |

---

## 8. Performance Considerations

- **Connection pooling**: PgBouncer or built-in pooling.
- **Read replicas**: For reports and analytics queries.
- **Query optimization**: Use EXPLAIN ANALYZE; avoid N+1.
- **Caching**: Redis for frequently accessed data (categories, store info).
- **Partitioning**: Consider for `audit_log`, `tracking_event` by date.

---

## 9. Security

- **Encryption at rest**: Enable on database (AWS RDS, GCP Cloud SQL).
- **Encryption in transit**: TLS for all connections.
- **Row-level security**: Optional for multi-tenant data isolation.
- **Sensitive data**: Hash passwords (bcrypt/argon2); encrypt PII if required.
- **Audit**: Log all state changes to `audit_log`.

---

## 10. Environment-Specific Configurations

| Environment | Database | Notes |
|-------------|----------|-------|
| Local | PostgreSQL (Docker) | `docker-compose` for local dev |
| Dev | Shared instance | Seed data, frequent resets |
| Staging | Production-like | Real backups, same schema |
| Production | Managed (RDS/Cloud SQL) | HA, backups, monitoring |
