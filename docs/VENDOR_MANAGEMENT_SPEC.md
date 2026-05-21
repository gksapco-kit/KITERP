# ArT (Ask r Task) – Vendor Management & Multi-Tenancy Specification

## 1. Overview

This document defines the architecture for vendor onboarding, subdomain-based multi-tenancy, product/service management, and role-based access control within each vendor tenant.

---

## 2. Core Concepts

### 2.1 Terminology

| Term | Description |
|------|-------------|
| **Vendor** | A business entity that sells products or services through the platform |
| **Tenant** | A vendor-specific isolated environment with its own subdomain |
| **Vendor Admin** | User with full administrative access to a vendor's tenant |
| **Vendor User** | User with limited access (e.g., staff, cashier, manager) within a vendor |
| **Subdomain** | Unique URL pattern: `<vendor-slug>.<domain>.com` |

### 2.2 Key Features

1. **Vendor Onboarding** – Registration, verification, and activation workflow
2. **Subdomain Routing** – Each vendor gets `<vendor>.<domain>.com`
3. **Product/Service Management** – Vendors add and manage their catalog
4. **Role-Based Access** – Admin and User roles per vendor
5. **Tenant Isolation** – Data isolation per vendor

---

## 3. Vendor Onboarding Flow

### 3.1 Registration Steps

```
┌──────────────────┐
│  1. REGISTRATION │
│  (Basic Info)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  2. VERIFICATION │
│  (Documents/KYC) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  3. REVIEW       │
│  (Platform Admin)│
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│APPROVED│ │REJECTED│
└───┬────┘ └────────┘
    │
    ▼
┌──────────────────┐
│  4. ACTIVATION   │
│  (Subdomain Live)│
└──────────────────┘
```

### 3.2 Registration Fields

#### Step 1: Basic Information
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| business_name | VARCHAR(255) | Yes | Legal business name |
| display_name | VARCHAR(255) | Yes | Name shown to customers |
| vendor_slug | VARCHAR(100) | Yes | URL-safe identifier (e.g., `acme-store`) |
| business_type | ENUM | Yes | individual, partnership, llc, corporation |
| industry | VARCHAR(100) | Yes | Category/industry of business |
| primary_email | VARCHAR(255) | Yes | Main contact email |
| primary_phone | VARCHAR(20) | Yes | Main contact phone |
| owner_name | VARCHAR(255) | Yes | Owner/representative name |

#### Step 2: Address & Location
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| street_address | TEXT | Yes | Street address |
| city | VARCHAR(100) | Yes | City |
| state | VARCHAR(100) | Yes | State/Province |
| postal_code | VARCHAR(20) | Yes | Postal/ZIP code |
| country | VARCHAR(100) | Yes | Country |
| location | GEOGRAPHY | No | Geo-coordinates for discovery |

#### Step 3: Verification Documents
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| business_registration | FILE | Yes | Business registration certificate |
| tax_id_document | FILE | Yes | GST/Tax ID document |
| id_proof | FILE | Yes | Owner ID proof (Aadhaar/PAN/Passport) |
| address_proof | FILE | No | Utility bill or bank statement |

#### Step 4: Banking & Payments
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| bank_name | VARCHAR(255) | Yes | Bank name |
| account_number | VARCHAR(50) | Yes | Bank account number |
| ifsc_code | VARCHAR(20) | Yes | IFSC/Routing code |
| account_holder_name | VARCHAR(255) | Yes | Account holder name |

---

## 4. Database Schema

### 4.1 Vendor Table

```sql
CREATE TABLE vendor (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Info
    business_name           VARCHAR(255) NOT NULL,
    display_name            VARCHAR(255) NOT NULL,
    slug                    VARCHAR(100) UNIQUE NOT NULL,
    business_type           VARCHAR(50) NOT NULL,
    industry                VARCHAR(100),
    description             TEXT,
    
    -- Contact
    primary_email           VARCHAR(255) NOT NULL,
    primary_phone           VARCHAR(20) NOT NULL,
    support_email           VARCHAR(255),
    support_phone           VARCHAR(20),
    
    -- Address
    street_address          TEXT,
    city                    VARCHAR(100),
    state                   VARCHAR(100),
    postal_code             VARCHAR(20),
    country                 VARCHAR(100) DEFAULT 'India',
    location                GEOGRAPHY(POINT, 4326),
    
    -- Branding
    logo_url                TEXT,
    banner_url              TEXT,
    theme_config            JSONB DEFAULT '{}',
    custom_css              TEXT,
    
    -- Subdomain/Domain
    subdomain               VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'acme'
    custom_domain           VARCHAR(255) UNIQUE,           -- e.g., 'www.acmestore.com'
    domain_verified         BOOLEAN DEFAULT FALSE,
    
    -- Status & Verification
    status                  VARCHAR(30) DEFAULT 'pending',
        -- pending, under_review, approved, rejected, suspended, deactivated
    verification_status     VARCHAR(30) DEFAULT 'pending',
        -- pending, documents_submitted, verified, rejected
    verified_at             TIMESTAMPTZ,
    rejection_reason        TEXT,
    
    -- Settings
    settings                JSONB DEFAULT '{
        "timezone": "Asia/Kolkata",
        "currency": "INR",
        "language": "en",
        "notifications": {
            "email": true,
            "sms": true,
            "push": true
        },
        "features": {
            "products": true,
            "services": true,
            "appointments": false,
            "subscriptions": false
        }
    }',
    
    -- Business Hours
    business_hours          JSONB DEFAULT '{
        "monday": {"open": "09:00", "close": "18:00", "is_open": true},
        "tuesday": {"open": "09:00", "close": "18:00", "is_open": true},
        "wednesday": {"open": "09:00", "close": "18:00", "is_open": true},
        "thursday": {"open": "09:00", "close": "18:00", "is_open": true},
        "friday": {"open": "09:00", "close": "18:00", "is_open": true},
        "saturday": {"open": "10:00", "close": "16:00", "is_open": true},
        "sunday": {"open": null, "close": null, "is_open": false}
    }',
    
    -- Social Links
    social_links            JSONB DEFAULT '{}',
    
    -- Subscription/Plan
    plan_id                 UUID REFERENCES vendor_plan(id),
    plan_expires_at         TIMESTAMPTZ,
    
    -- Audit
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    activated_at            TIMESTAMPTZ,
    deactivated_at          TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_vendor_slug ON vendor(slug);
CREATE INDEX idx_vendor_subdomain ON vendor(subdomain);
CREATE INDEX idx_vendor_status ON vendor(status);
CREATE INDEX idx_vendor_location ON vendor USING GIST(location);
CREATE INDEX idx_vendor_created ON vendor(created_at DESC);
```

### 4.2 Vendor Verification Documents

```sql
CREATE TABLE vendor_document (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    document_type       VARCHAR(50) NOT NULL,
        -- business_registration, tax_id, id_proof, address_proof, bank_proof
    file_url            TEXT NOT NULL,
    file_name           VARCHAR(255),
    file_size           INTEGER,
    mime_type           VARCHAR(100),
    status              VARCHAR(30) DEFAULT 'pending',
        -- pending, approved, rejected
    rejection_reason    TEXT,
    reviewed_by         UUID REFERENCES "user"(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_document_vendor ON vendor_document(vendor_id);
CREATE INDEX idx_vendor_document_type ON vendor_document(document_type);
CREATE INDEX idx_vendor_document_status ON vendor_document(status);
```

### 4.3 Vendor Banking Details

```sql
CREATE TABLE vendor_bank_account (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    bank_name           VARCHAR(255) NOT NULL,
    account_number      VARCHAR(50) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    ifsc_code           VARCHAR(20) NOT NULL,
    account_type        VARCHAR(30) DEFAULT 'savings',
        -- savings, current
    is_primary          BOOLEAN DEFAULT TRUE,
    is_verified         BOOLEAN DEFAULT FALSE,
    verified_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_bank_vendor ON vendor_bank_account(vendor_id);
CREATE UNIQUE INDEX idx_vendor_bank_primary ON vendor_bank_account(vendor_id) WHERE is_primary = TRUE;
```

### 4.4 Vendor Owner (Primary Admin)

```sql
CREATE TABLE vendor_owner (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES "user"(id),
    full_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(20),
    id_type             VARCHAR(50),
        -- aadhaar, pan, passport, driving_license
    id_number           VARCHAR(100),
    designation         VARCHAR(100) DEFAULT 'Owner',
    is_primary          BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, user_id)
);

CREATE INDEX idx_vendor_owner_vendor ON vendor_owner(vendor_id);
CREATE INDEX idx_vendor_owner_user ON vendor_owner(user_id);
```

---
About 83,800 search results

## 5. Vendor User & Role Management

### 5.1 Role Definitions

| Role | Code | Description | Permissions |
|------|------|-------------|-------------|
| **Super Admin** | `super_admin` | Platform-level admin | Full access to all vendors |
| **Vendor Owner** | `vendor_owner` | Business owner | Full access to own vendor |
| **Vendor Admin** | `vendor_admin` | Delegated admin | Near-full access (no billing/delete) |
| **Manager** | `manager` | Store/branch manager | Manage products, orders, staff |
| **Staff** | `staff` | Regular employee | Process orders, view products |
| **Cashier** | `cashier` | POS operations | Process payments, refunds |
| **Viewer** | `viewer` | Read-only access | View reports only |

### 5.2 Vendor Role Table

```sql
CREATE TABLE vendor_role (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID REFERENCES vendor(id) ON DELETE CASCADE,
        -- NULL for system-defined roles
    code                VARCHAR(50) NOT NULL,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    is_system           BOOLEAN DEFAULT FALSE,
        -- TRUE for pre-defined roles, FALSE for custom
    permissions         JSONB NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, code)
);

-- Insert system roles
INSERT INTO vendor_role (id, vendor_id, code, name, description, is_system, permissions) VALUES
(gen_random_uuid(), NULL, 'vendor_owner', 'Vendor Owner', 'Full access to vendor', TRUE, 
 '["*"]'),
(gen_random_uuid(), NULL, 'vendor_admin', 'Vendor Admin', 'Administrative access', TRUE,
 '["vendor:read", "vendor:update", "products:*", "orders:*", "users:*", "reports:*"]'),
(gen_random_uuid(), NULL, 'manager', 'Manager', 'Manager access', TRUE,
 '["vendor:read", "products:*", "orders:*", "users:read", "reports:read"]'),
(gen_random_uuid(), NULL, 'staff', 'Staff', 'Staff access', TRUE,
 '["vendor:read", "products:read", "orders:read", "orders:update"]'),
(gen_random_uuid(), NULL, 'cashier', 'Cashier', 'Cashier access', TRUE,
 '["vendor:read", "orders:create", "orders:update", "payments:create"]'),
(gen_random_uuid(), NULL, 'viewer', 'Viewer', 'Read-only access', TRUE,
 '["vendor:read", "products:read", "orders:read", "reports:read"]');

CREATE INDEX idx_vendor_role_vendor ON vendor_role(vendor_id);
CREATE INDEX idx_vendor_role_code ON vendor_role(code);
```

### 5.3 Vendor User Membership

```sql
CREATE TABLE vendor_user (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role_id             UUID NOT NULL REFERENCES vendor_role(id),
    
    -- Status
    status              VARCHAR(30) DEFAULT 'invited',
        -- invited, active, suspended, removed
    invited_by          UUID REFERENCES "user"(id),
    invited_at          TIMESTAMPTZ DEFAULT NOW(),
    joined_at           TIMESTAMPTZ,
    suspended_at        TIMESTAMPTZ,
    suspension_reason   TEXT,
    
    -- Optional metadata
    department          VARCHAR(100),
    employee_id         VARCHAR(50),
    notes               TEXT,
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, user_id)
);

CREATE INDEX idx_vendor_user_vendor ON vendor_user(vendor_id);
CREATE INDEX idx_vendor_user_user ON vendor_user(user_id);
CREATE INDEX idx_vendor_user_role ON vendor_user(role_id);
CREATE INDEX idx_vendor_user_status ON vendor_user(status);
```

### 5.4 Permission Definitions

```sql
CREATE TABLE permission (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(100) UNIQUE NOT NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    category            VARCHAR(50) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Insert permissions
INSERT INTO permission (id, code, name, description, category) VALUES
-- Vendor Management
(gen_random_uuid(), 'vendor:read', 'View Vendor Info', 'View vendor details', 'vendor'),
(gen_random_uuid(), 'vendor:update', 'Update Vendor Info', 'Edit vendor details', 'vendor'),
(gen_random_uuid(), 'vendor:delete', 'Delete Vendor', 'Delete vendor account', 'vendor'),
(gen_random_uuid(), 'vendor:settings', 'Manage Settings', 'Configure vendor settings', 'vendor'),

-- Products
(gen_random_uuid(), 'products:read', 'View Products', 'View product catalog', 'products'),
(gen_random_uuid(), 'products:create', 'Create Products', 'Add new products', 'products'),
(gen_random_uuid(), 'products:update', 'Update Products', 'Edit product details', 'products'),
(gen_random_uuid(), 'products:delete', 'Delete Products', 'Remove products', 'products'),
(gen_random_uuid(), 'products:*', 'Full Product Access', 'All product operations', 'products'),

-- Orders
(gen_random_uuid(), 'orders:read', 'View Orders', 'View order list', 'orders'),
(gen_random_uuid(), 'orders:create', 'Create Orders', 'Create new orders', 'orders'),
(gen_random_uuid(), 'orders:update', 'Update Orders', 'Modify order status', 'orders'),
(gen_random_uuid(), 'orders:cancel', 'Cancel Orders', 'Cancel orders', 'orders'),
(gen_random_uuid(), 'orders:refund', 'Refund Orders', 'Process refunds', 'orders'),
(gen_random_uuid(), 'orders:*', 'Full Order Access', 'All order operations', 'orders'),

-- Users
(gen_random_uuid(), 'users:read', 'View Users', 'View team members', 'users'),
(gen_random_uuid(), 'users:create', 'Invite Users', 'Add team members', 'users'),
(gen_random_uuid(), 'users:update', 'Update Users', 'Edit team members', 'users'),
(gen_random_uuid(), 'users:delete', 'Remove Users', 'Remove team members', 'users'),
(gen_random_uuid(), 'users:*', 'Full User Access', 'All user operations', 'users'),

-- Reports
(gen_random_uuid(), 'reports:read', 'View Reports', 'View analytics', 'reports'),
(gen_random_uuid(), 'reports:export', 'Export Reports', 'Download reports', 'reports'),
(gen_random_uuid(), 'reports:*', 'Full Report Access', 'All report operations', 'reports'),

-- Payments
(gen_random_uuid(), 'payments:read', 'View Payments', 'View payment history', 'payments'),
(gen_random_uuid(), 'payments:create', 'Accept Payments', 'Process payments', 'payments'),
(gen_random_uuid(), 'payments:refund', 'Process Refunds', 'Issue refunds', 'payments'),
(gen_random_uuid(), 'payments:*', 'Full Payment Access', 'All payment operations', 'payments'),

-- Billing
(gen_random_uuid(), 'billing:read', 'View Billing', 'View invoices/billing', 'billing'),
(gen_random_uuid(), 'billing:manage', 'Manage Billing', 'Update payment methods', 'billing'),
(gen_random_uuid(), 'billing:*', 'Full Billing Access', 'All billing operations', 'billing');
```

---

## 6. Subdomain & Multi-Tenancy Architecture

### 6.1 Domain Structure

| Type | Pattern | Example |
|------|---------|---------|
| Platform Main | `<domain>.com` | `kiterp.com` |
| Vendor Subdomain | `<vendor>.<domain>.com` | `acme.kiterp.com` |
| Custom Domain | User's own domain | `www.acmestore.com` |
| API | `api.<domain>.com` | `api.kiterp.com` |
| Admin Portal | `admin.<domain>.com` | `admin.kiterp.com` |

### 6.2 Subdomain Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Request: acme.kiterp.com                                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. DNS: *.kiterp.com → Load Balancer                              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Load Balancer / Reverse Proxy (Nginx/Caddy/Traefik)             │
│     - Extract subdomain from Host header                            │
│     - Route to appropriate backend                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Backend Middleware                                              │
│     - Parse subdomain from request                                  │
│     - Lookup vendor by subdomain/custom_domain                      │
│     - Inject vendor_id into request context                         │
│     - Verify vendor status (approved, active)                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Vendor-Scoped Response                                          │
│     - All queries filtered by vendor_id                             │
│     - Vendor branding/theme applied                                 │
│     - Tenant-specific data returned                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Backend Implementation (NestJS Example)

```typescript
// middleware/tenant.middleware.ts
import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { VendorService } from '../vendor/vendor.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private vendorService: VendorService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.headers.host || '';
    const subdomain = this.extractSubdomain(host);
    
    if (subdomain && !this.isReservedSubdomain(subdomain)) {
      const vendor = await this.vendorService.findBySubdomainOrDomain(
        subdomain, 
        host
      );
      
      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }
      
      if (vendor.status !== 'approved') {
        throw new NotFoundException('Vendor is not active');
      }
      
      // Inject vendor context into request
      req['vendor'] = vendor;
      req['vendorId'] = vendor.id;
    }
    
    next();
  }

  private extractSubdomain(host: string): string | null {
    const baseDomain = process.env.BASE_DOMAIN; // e.g., 'kiterp.com'
    const parts = host.replace(`:${process.env.PORT}`, '').split('.');
    
    if (parts.length > 2 && host.endsWith(baseDomain)) {
      return parts[0];
    }
    
    return null;
  }

  private isReservedSubdomain(subdomain: string): boolean {
    const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'cdn'];
    return reserved.includes(subdomain.toLowerCase());
  }
}
```

### 6.4 DNS Configuration

```
# Wildcard DNS Record (Cloudflare/Route53/etc.)
*.kiterp.com    A      <load-balancer-ip>
*.kiterp.com    AAAA   <load-balancer-ipv6>

# Alternatively with CNAME
*.kiterp.com    CNAME  lb.kiterp.com
```

### 6.5 Nginx Configuration (Wildcard SSL)

```nginx
server {
    listen 443 ssl http2;
    server_name ~^(?<subdomain>.+)\.kiterp\.com$;
    
    ssl_certificate     /etc/ssl/wildcard.kiterp.com.crt;
    ssl_certificate_key /etc/ssl/wildcard.kiterp.com.key;
    
    location / {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Subdomain $subdomain;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Custom domain handling
server {
    listen 443 ssl http2;
    server_name ~^(?<custom_domain>.+)$;
    
    # Dynamic SSL via Let's Encrypt or Cloudflare
    ssl_certificate     /etc/ssl/certs/custom/$custom_domain.crt;
    ssl_certificate_key /etc/ssl/private/custom/$custom_domain.key;
    
    location / {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Custom-Domain $custom_domain;
    }
}
```

---

## 7. Product & Service Management

### 7.1 Vendor Product Table (Extension of existing Product)

```sql
-- Modify existing product table to be vendor-scoped
ALTER TABLE product ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendor(id);

-- Or create a new vendor-specific product table
CREATE TABLE vendor_product (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    category_id         UUID REFERENCES category(id),
    
    -- Basic Info
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) NOT NULL,
    description         TEXT,
    short_description   VARCHAR(500),
    
    -- Media
    images              JSONB DEFAULT '[]',
    videos              JSONB DEFAULT '[]',
    
    -- Pricing
    base_price          DECIMAL(12,2) NOT NULL,
    sale_price          DECIMAL(12,2),
    cost_price          DECIMAL(12,2),
    currency            VARCHAR(3) DEFAULT 'INR',
    tax_rate            DECIMAL(5,2) DEFAULT 0,
    tax_inclusive       BOOLEAN DEFAULT TRUE,
    
    -- Inventory
    sku                 VARCHAR(100),
    barcode             VARCHAR(100),
    track_inventory     BOOLEAN DEFAULT TRUE,
    quantity            INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    
    -- Type & Status
    product_type        VARCHAR(30) DEFAULT 'physical',
        -- physical, digital, service
    status              VARCHAR(30) DEFAULT 'draft',
        -- draft, active, inactive, archived
    is_featured         BOOLEAN DEFAULT FALSE,
    
    -- Attributes
    attributes          JSONB DEFAULT '{}',
    specifications      JSONB DEFAULT '[]',
    tags                TEXT[],
    
    -- SEO
    meta_title          VARCHAR(255),
    meta_description    TEXT,
    
    -- Audit
    created_by          UUID REFERENCES "user"(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    published_at        TIMESTAMPTZ,
    
    UNIQUE(vendor_id, slug),
    UNIQUE(vendor_id, sku)
);

CREATE INDEX idx_vendor_product_vendor ON vendor_product(vendor_id);
CREATE INDEX idx_vendor_product_category ON vendor_product(category_id);
CREATE INDEX idx_vendor_product_status ON vendor_product(status);
CREATE INDEX idx_vendor_product_type ON vendor_product(product_type);
CREATE INDEX idx_vendor_product_sku ON vendor_product(sku);
CREATE INDEX idx_vendor_product_tags ON vendor_product USING GIN(tags);
```

### 7.2 Vendor Service Table

```sql
CREATE TABLE vendor_service (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    category_id         UUID REFERENCES category(id),
    
    -- Basic Info
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) NOT NULL,
    description         TEXT,
    short_description   VARCHAR(500),
    
    -- Media
    images              JSONB DEFAULT '[]',
    
    -- Pricing
    price_type          VARCHAR(30) DEFAULT 'fixed',
        -- fixed, hourly, quote_based, starting_from
    base_price          DECIMAL(12,2),
    hourly_rate         DECIMAL(12,2),
    minimum_price       DECIMAL(12,2),
    currency            VARCHAR(3) DEFAULT 'INR',
    
    -- Duration
    duration_minutes    INTEGER,
    duration_range      JSONB, -- {"min": 30, "max": 60}
    
    -- Availability
    available_days      JSONB DEFAULT '["mon","tue","wed","thu","fri"]',
    available_hours     JSONB DEFAULT '{"start": "09:00", "end": "18:00"}',
    buffer_time_minutes INTEGER DEFAULT 15,
    max_bookings_per_day INTEGER,
    
    -- Status
    status              VARCHAR(30) DEFAULT 'draft',
        -- draft, active, inactive
    is_featured         BOOLEAN DEFAULT FALSE,
    requires_deposit    BOOLEAN DEFAULT FALSE,
    deposit_amount      DECIMAL(12,2),
    
    -- Location
    service_location    VARCHAR(30) DEFAULT 'vendor',
        -- vendor, customer, remote
    service_radius_km   INTEGER,
    
    -- Audit
    created_by          UUID REFERENCES "user"(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, slug)
);

CREATE INDEX idx_vendor_service_vendor ON vendor_service(vendor_id);
CREATE INDEX idx_vendor_service_category ON vendor_service(category_id);
CREATE INDEX idx_vendor_service_status ON vendor_service(status);
```

---

## 8. API Endpoints

### 8.1 Vendor Onboarding APIs

```
# Public (Unauthenticated)
POST   /api/v1/vendors/register           # Start registration
POST   /api/v1/vendors/check-slug         # Check slug availability

# Vendor Owner (Authenticated)
GET    /api/v1/vendors/me                 # Get my vendor profile
PUT    /api/v1/vendors/me                 # Update vendor profile
POST   /api/v1/vendors/me/documents       # Upload verification documents
GET    /api/v1/vendors/me/documents       # List uploaded documents
POST   /api/v1/vendors/me/bank-account    # Add bank account
PUT    /api/v1/vendors/me/bank-account/:id # Update bank account
POST   /api/v1/vendors/me/submit-review   # Submit for review

# Platform Admin
GET    /api/v1/admin/vendors              # List all vendors
GET    /api/v1/admin/vendors/:id          # Get vendor details
PUT    /api/v1/admin/vendors/:id/status   # Approve/reject vendor
GET    /api/v1/admin/vendors/:id/documents # Get vendor documents
PUT    /api/v1/admin/vendors/:id/documents/:docId # Approve/reject document
```

### 8.2 Vendor User Management APIs

```
# Vendor Admin
GET    /api/v1/vendors/me/users           # List vendor users
POST   /api/v1/vendors/me/users/invite    # Invite new user
GET    /api/v1/vendors/me/users/:id       # Get user details
PUT    /api/v1/vendors/me/users/:id       # Update user role/status
DELETE /api/v1/vendors/me/users/:id       # Remove user

# Roles
GET    /api/v1/vendors/me/roles           # List available roles
POST   /api/v1/vendors/me/roles           # Create custom role
PUT    /api/v1/vendors/me/roles/:id       # Update custom role
DELETE /api/v1/vendors/me/roles/:id       # Delete custom role

# User Self
POST   /api/v1/vendors/accept-invite/:token # Accept invitation
GET    /api/v1/me/vendor-memberships      # Get my vendor memberships
```

### 8.3 Product/Service Management APIs

```
# Products
GET    /api/v1/vendors/me/products        # List products
POST   /api/v1/vendors/me/products        # Create product
GET    /api/v1/vendors/me/products/:id    # Get product
PUT    /api/v1/vendors/me/products/:id    # Update product
DELETE /api/v1/vendors/me/products/:id    # Delete product
POST   /api/v1/vendors/me/products/bulk   # Bulk import

# Services
GET    /api/v1/vendors/me/services        # List services
POST   /api/v1/vendors/me/services        # Create service
GET    /api/v1/vendors/me/services/:id    # Get service
PUT    /api/v1/vendors/me/services/:id    # Update service
DELETE /api/v1/vendors/me/services/:id    # Delete service

# Public Business Front (vendor subdomain)
GET    /api/v1/catalog/products           # List vendor products (filtered by tenant)
GET    /api/v1/catalog/products/:slug     # Get product by slug
GET    /api/v1/catalog/services           # List vendor services
GET    /api/v1/catalog/services/:slug     # Get service by slug
```

---

## 9. Vendor Onboarding UI Screens

### 9.1 Registration Flow Screens

1. **Welcome/Get Started**
   - Value proposition
   - CTA: "Start Your Store"

2. **Basic Information**
   - Business name, display name
   - Business type, industry
   - Contact details

3. **Choose Your Subdomain**
   - Slug input with live preview: `yourname.kiterp.com`
   - Availability check

4. **Business Address**
   - Full address form
   - Map picker for location

5. **Verification Documents**
   - Document upload with preview
   - Status indicators

6. **Banking Details**
   - Bank account form
   - Account verification (micro-deposits or instant)

7. **Review & Submit**
   - Summary of all information
   - Terms acceptance
   - Submit for review

8. **Pending Approval**
   - Status page with timeline
   - Estimated review time
   - Support contact

### 9.2 Vendor Dashboard Screens

1. **Dashboard Home**
   - Sales overview, orders today
   - Quick actions
   - Alerts/notifications

2. **Products/Services**
   - List with filters
   - Add/edit forms
   - Bulk actions

3. **Orders**
   - Order list
   - Order details
   - Status management

4. **Team/Users**
   - User list
   - Invite flow
   - Role management

5. **Settings**
   - Store settings
   - Branding/theme
   - Domain settings
   - Notifications

---

## 10. Vendor Plans & Billing (Optional)

### 10.1 Plan Table

```sql
CREATE TABLE vendor_plan (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    code                VARCHAR(50) UNIQUE NOT NULL,
    description         TEXT,
    
    -- Pricing
    price_monthly       DECIMAL(12,2) NOT NULL DEFAULT 0,
    price_yearly        DECIMAL(12,2),
    currency            VARCHAR(3) DEFAULT 'INR',
    
    -- Limits
    max_products        INTEGER DEFAULT 100,
    max_services        INTEGER DEFAULT 50,
    max_users           INTEGER DEFAULT 5,
    max_storage_gb      INTEGER DEFAULT 5,
    
    -- Features
    features            JSONB DEFAULT '{
        "custom_domain": false,
        "remove_branding": false,
        "priority_support": false,
        "api_access": false,
        "advanced_analytics": false
    }',
    
    -- Commission
    commission_rate     DECIMAL(5,2) DEFAULT 5.00, -- percentage
    
    is_active           BOOLEAN DEFAULT TRUE,
    sort_order          INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO vendor_plan (id, name, code, price_monthly, max_products, max_users, features) VALUES
(gen_random_uuid(), 'Free', 'free', 0, 25, 2, 
 '{"custom_domain": false, "remove_branding": false}'),
(gen_random_uuid(), 'Starter', 'starter', 499, 100, 5, 
 '{"custom_domain": false, "remove_branding": true}'),
(gen_random_uuid(), 'Professional', 'professional', 1499, 500, 15, 
 '{"custom_domain": true, "remove_branding": true, "priority_support": true}'),
(gen_random_uuid(), 'Enterprise', 'enterprise', 4999, -1, -1, 
 '{"custom_domain": true, "remove_branding": true, "priority_support": true, "api_access": true, "advanced_analytics": true}');
```

---

## 11. Security Considerations

### 11.1 Data Isolation

- **Row-Level Security (RLS)**: Enable PostgreSQL RLS for vendor-scoped tables
- **Middleware Enforcement**: Always inject `vendor_id` filter in queries
- **API Validation**: Verify user belongs to vendor before any operation

### 11.2 RLS Example

```sql
-- Enable RLS
ALTER TABLE vendor_product ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see products from their vendor
CREATE POLICY vendor_product_isolation ON vendor_product
    FOR ALL
    USING (vendor_id = current_setting('app.current_vendor_id')::UUID);

-- Set vendor context in application
SET app.current_vendor_id = 'vendor-uuid-here';
```

### 11.3 Authentication Flow

```
1. User logs in → receives JWT with user_id
2. User accesses vendor subdomain
3. Middleware resolves vendor from subdomain
4. Middleware checks vendor_user table for membership
5. If member → inject vendor_id + role into request context
6. If not member → return 403 Forbidden
```

---

## 12. Implementation Checklist

### Phase 1: Foundation
- [ ] Create vendor, vendor_document, vendor_bank_account tables
- [ ] Create vendor_role, vendor_user tables
- [ ] Implement vendor registration API
- [ ] Implement document upload API
- [ ] Build registration UI (web)

### Phase 2: Multi-Tenancy
- [ ] Configure wildcard DNS
- [ ] Implement tenant middleware
- [ ] Add subdomain extraction logic
- [ ] Configure Nginx/reverse proxy
- [ ] Test subdomain routing

### Phase 3: Admin & Verification
- [ ] Build platform admin vendor review UI
- [ ] Implement approve/reject workflow
- [ ] Add email notifications for status changes
- [ ] Create vendor verification status page

### Phase 4: Vendor Dashboard
- [ ] Build vendor dashboard UI
- [ ] Implement product CRUD
- [ ] Implement service CRUD
- [ ] Build team management UI
- [ ] Add role-based access control

### Phase 5: Storefront
- [ ] Build customer-facing storefront
- [ ] Apply vendor branding/theme
- [ ] Integrate with order system
- [ ] Add cart/checkout flow

---

## 13. Relationship to Existing Schema

This vendor management system integrates with the existing ArT schema:

| Existing Entity | Relationship | Notes |
|-----------------|--------------|-------|
| `user` | Vendor owners and users reference `user` table | Single user can be in multiple vendors |
| `store` | Vendor can optionally have a `store` for marketplace visibility | Vendor is the business entity, store is the marketplace presence |
| `product` | `vendor_product` is vendor-specific; can sync to `product` for marketplace | Dual-write or sync job |
| `order` | Orders reference `vendor_id` for vendor-specific orders | Extends existing order system |
| `category` | Shared categories across platform and vendors | Vendor can create custom categories |

---

## 14. Future Enhancements

1. **Multi-Branch Support**: Allow vendors to have multiple locations/branches
2. **Franchise Model**: Parent-child vendor relationships
3. **White-Label Apps**: Generate vendor-specific mobile apps
4. **Advanced Analytics**: Revenue forecasting, customer insights
5. **Marketplace Integration**: Publish products to main marketplace
6. **API Access**: Allow vendors to integrate with external systems
