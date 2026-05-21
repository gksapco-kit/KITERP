# KITERP - Multi-Vendor SaaS Platform

A full-stack multi-vendor SaaS platform with vendor admin, customer business fronts, and mobile apps. **One deployment serves all vendors** — each vendor gets their own branded store via URL slug or subdomain.

## Architecture (SaaS Model)

| App | URL | Purpose |
|-----|-----|---------|
| **Backend API** | `http://localhost:8000` | FastAPI backend serving all vendors |
| **Super Admin** | `http://localhost:3000` | Platform admin — manage/approve vendors |
| **Vendor Admin** | `http://localhost:3001` | Vendor dashboard — products, orders, customers |
| **Customer Business Front** | `http://localhost:3002/store/:slug` | Customer shopping per vendor |
| **Mobile App** | Expo (Android/iOS/Web) | Vendor admin + customer shopping |

### Multi-Tenant Resolution

Vendor context is resolved in this priority:
1. **Subdomain** (production): `vendor-slug.kiterp.com` via `TenantMiddleware`
2. **X-Vendor-Slug header** (SaaS web): business front sends slug from URL path
3. **X-Vendor-Id header** (mobile/fallback): direct vendor ID

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 15+ (primary), MongoDB 7+ (flexible schemas)
- **ORM**: SQLAlchemy 2.0 + Pydantic v2
- **Cache**: Redis (tenant caching, sessions)
- **Authentication**: JWT + OAuth2 (vendor users + customers)

### Frontend Apps
- **Framework**: React 18 + Vite 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod

### Mobile App
- **Framework**: React Native + Expo SDK 51
- **Navigation**: Expo Router
- **Styling**: NativeWind v2 (Tailwind for RN)

## Project Structure

```
kiterp/
├── backend/              # FastAPI backend (all vendors)
│   ├── app/
│   │   ├── api/v1/       # REST endpoints
│   │   ├── middleware/    # TenantMiddleware (subdomain/slug/ID)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── repositories/ # Data access layer
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic
│   └── alembic/          # Database migrations
├── frontend/             # Super Admin (port 3000)
├── vendor-web/           # Vendor Admin Panel (port 3001)
├── storefront-web/       # Customer Business Front app (port 3002)
│   └── src/contexts/     # VendorContext — resolves vendor from URL
├── mobile/               # React Native / Expo app
│   └── app/              # Expo Router screens
└── README.md
```

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- MongoDB 7+
- Redis 7+

### Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Super Admin (port 3000)

```bash
cd frontend
npm install && npm run dev
```

### Vendor Admin (port 3001)

```bash
cd vendor-web
npm install && npm run dev
```

### Customer Business Front (port 3002)

```bash
cd storefront-web
npm install && npm run dev
```

Visit `http://localhost:3002/store/{vendor-slug}` to see a vendor's business front.

### All three web apps at once (recommended)

From the **repository root** (not inside `frontend/` alone):

```bash
npm install
npm run dev
```

Wait until the terminal shows **Local:** URLs for **3000**, **3001**, and **3002**, then open:

| App | URL |
|-----|-----|
| Super Admin | http://localhost:3000 |
| Vendor Admin | http://localhost:3001 |
| Business Front | http://localhost:3002 |

**Windows:** If `http://localhost:3000` (or 3001/3002) spins forever, use **`http://127.0.0.1:3000`** (same for 3001 and 3002). The first page load can take **10–30+ seconds** when the project lives on **OneDrive** — keep the dev terminal open.

In Cursor: **Terminal → Run Task → Dev: ALL web apps (3000 + 3001 + 3002)**.

### Mobile App

```bash
cd mobile
npm install
npx expo start --web --clear    # Web preview
npx expo start --android        # Android emulator
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Key Features

- **SaaS Multi-Tenancy**: One deployment, all vendors — resolved by subdomain, slug, or header
- **Vendor Registration & Onboarding**: Multi-step registration with document verification
- **Super Admin Dashboard**: Vendor approval/rejection workflow with detail pages
- **Vendor Admin Panel**: Products, services, orders, customers management
- **Customer Business Front**: Per-vendor branded shopping experience
- **Mobile App**: Vendor admin + customer shopping (Android/iOS via Expo)
- **Product & Service Management**: Full CRUD with variants, images, categories
- **Shopping Cart & Checkout**: Customer cart, order placement, order tracking
- **JWT Authentication**: Separate auth for platform users, vendors, and customers

## API Endpoints

### Platform Auth
- `POST /api/v1/auth/register` — Register platform user
- `POST /api/v1/auth/login` — Login
- `GET /api/v1/auth/me` — Current user

### Vendor Management
- `POST /api/v1/vendors/register` — Register vendor
- `GET /api/v1/vendors/me` — Get my vendor
- `PUT /api/v1/vendors/me` — Update vendor
- `GET/POST /api/v1/vendors/me/products` — Products CRUD
- `GET/POST /api/v1/vendors/me/services` — Services CRUD
- `GET /api/v1/vendors/me/orders` — Vendor orders
- `GET /api/v1/vendors/me/customers` — Vendor customers

### Public Catalog (tenant-aware)
- `GET /api/v1/catalog/vendor/{slug}` — Resolve vendor by slug (SaaS)
- `GET /api/v1/catalog/info` — Vendor info (via header)
- `GET /api/v1/catalog/products` — Browse products
- `GET /api/v1/catalog/services` — Browse services

### Customer Business Front (tenant-aware)
- `POST /api/v1/store/auth/register` — Customer registration
- `POST /api/v1/store/auth/login` — Customer login
- `GET/POST /api/v1/store/cart` — Cart management
- `POST /api/v1/store/orders/checkout` — Place order
- `GET /api/v1/store/orders` — Order history

### Admin
- `GET /api/v1/admin/vendors` — List all vendors
- `GET /api/v1/admin/vendors/{id}` — Vendor details
- `PUT /api/v1/admin/vendors/{id}/approve` — Approve vendor
- `PUT /api/v1/admin/vendors/{id}/reject` — Reject vendor

## License

MIT
