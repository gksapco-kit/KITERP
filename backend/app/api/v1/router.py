# app/api/v1/router.py
from fastapi import APIRouter

from app.api.v1 import (
    auth, vendors, vendor_relationship_manager, vendor_contact_change, vendor_products, vendor_services, vendor_categories,
    vendor_orders, vendor_customers, vendor_reviews,
    vendor_team, vendor_roles, vendor_inventory, vendor_storage_locations, vendor_procurement,
    vendor_pos, vendor_invoices, vendor_invoice_templates, vendor_coupons,
    vendor_reports, vendor_template,
    vendor_bookings, vendor_projects, vendor_notifications, vendor_merchandising, vendor_loyalty,
    vendor_mrp, vendor_hr, vendor_hr_extra, vendor_stores, vendor_message_config, vendor_production,
    catalog, admin, app_builds,
    store_auth, store_hr, store_cart, store_checkout, store_orders, store_notifications, store_reviews, store_coupons,
    store_bookings, store_wishlist, store_marketplace, store_subscriptions, store_rentals,
    uploads,
    vendor_crm_core, vendor_crm_support, vendor_crm_marketing, vendor_crm_advanced,
    vendor_finance,
    vendor_controlling,
    vendor_commission,
    vendor_schema_catalog,
    vendor_websites,
    public_sites,
    vendor_blog,
    catalog_blog,
    vendor_restaurant,
    public_restaurant,
    vendor_marketplace,
    vendor_subscriptions,
    vendor_rentals,
    admin_schema_catalog,
)

api_router = APIRouter()

# ── Platform Auth & Admin ────────────────────────────────────────
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(admin_schema_catalog.router, prefix="/admin/schema", tags=["Admin Schema"])

# ── Vendor Management ────────────────────────────────────────────
api_router.include_router(vendors.router, prefix="/vendors", tags=["Vendors"])
api_router.include_router(
    vendor_relationship_manager.router,
    prefix="/vendors/me",
    tags=["Vendor Relationship Manager"],
)
api_router.include_router(
    vendor_contact_change.router,
    prefix="/vendors/me",
    tags=["Vendor Contact Change"],
)
api_router.include_router(vendor_products.router, prefix="/vendors/me/products", tags=["Vendor Products"])
api_router.include_router(vendor_services.router, prefix="/vendors/me/services", tags=["Vendor Services"])
api_router.include_router(vendor_categories.router, prefix="/vendors/me/categories", tags=["Vendor Categories"])
api_router.include_router(vendor_orders.router, prefix="/vendors/me/orders", tags=["Vendor Orders"])
api_router.include_router(vendor_customers.router, prefix="/vendors/me/customers", tags=["Vendor Customers"])
api_router.include_router(vendor_reviews.router, prefix="/vendors/me/reviews", tags=["Vendor Reviews"])
api_router.include_router(vendor_team.router, prefix="/vendors/me/team", tags=["Vendor Team"])
api_router.include_router(vendor_roles.router, prefix="/vendors/me/roles", tags=["Vendor Roles"])
api_router.include_router(vendor_inventory.router, prefix="/vendors/me/inventory", tags=["Vendor Inventory"])
api_router.include_router(vendor_storage_locations.router, prefix="/vendors/me/storage-locations", tags=["Storage Locations"])
api_router.include_router(vendor_procurement.router, prefix="/vendors/me", tags=["Vendor Procurement"])
api_router.include_router(vendor_pos.router, prefix="/vendors/me/pos", tags=["Vendor POS"])
api_router.include_router(vendor_restaurant.router, prefix="/vendors/me/restaurant", tags=["Restaurant"])
api_router.include_router(public_restaurant.router, prefix="/public/restaurant", tags=["Public Restaurant"])
api_router.include_router(vendor_invoices.router, prefix="/vendors/me/invoices", tags=["Vendor Invoices"])
api_router.include_router(vendor_invoice_templates.router, prefix="/vendors/me/invoice-templates", tags=["Vendor Invoice Templates"])
api_router.include_router(vendor_coupons.router, prefix="/vendors/me/coupons", tags=["Vendor Coupons"])
api_router.include_router(vendor_reports.router, prefix="/vendors/me/reports", tags=["Vendor Reports"])
api_router.include_router(vendor_template.router, prefix="/vendors/me/template", tags=["Vendor Template"])
api_router.include_router(vendor_bookings.router, prefix="/vendors/me/bookings", tags=["Vendor Bookings"])
api_router.include_router(vendor_projects.router, prefix="/vendors/me/projects", tags=["Vendor Projects"])
api_router.include_router(vendor_notifications.router, prefix="/vendors/me/notifications", tags=["Vendor Notifications"])
api_router.include_router(vendor_merchandising.router, prefix="/vendors/me/merchandising", tags=["Vendor Merchandising"])
api_router.include_router(vendor_loyalty.router, prefix="/vendors/me/loyalty", tags=["Vendor Loyalty"])
api_router.include_router(vendor_mrp.router, prefix="/vendors/me", tags=["Vendor MRP"])
api_router.include_router(vendor_hr.router, prefix="/vendors/me/hr", tags=["Vendor HR"])
api_router.include_router(vendor_hr_extra.router, prefix="/vendors/me/hr", tags=["Vendor HR Extra"])
api_router.include_router(vendor_stores.router, prefix="/vendors/me", tags=["Vendor Stores"])
api_router.include_router(vendor_message_config.router, prefix="/vendors/me", tags=["Vendor Message Config"])
api_router.include_router(vendor_production.router, prefix="/vendors/me", tags=["Production Orders"])
api_router.include_router(vendor_marketplace.router, prefix="/vendors/me/marketplace", tags=["Vendor Marketplace"])
api_router.include_router(vendor_subscriptions.router, prefix="/vendors/me/subscriptions", tags=["Customer Subscriptions"])
api_router.include_router(vendor_rentals.router, prefix="/vendors/me/rentals", tags=["Rentals"])

# ── CRM ──────────────────────────────────────────────────────────
api_router.include_router(vendor_crm_core.router, prefix="/vendors/me/crm", tags=["CRM Core"])
api_router.include_router(vendor_crm_support.router, prefix="/vendors/me/crm", tags=["CRM Support"])
api_router.include_router(vendor_crm_marketing.router, prefix="/vendors/me/crm", tags=["CRM Marketing"])
api_router.include_router(vendor_crm_advanced.router, prefix="/vendors/me/crm", tags=["CRM Advanced"])
api_router.include_router(vendor_crm_advanced.public_router, prefix="/public/crm", tags=["CRM Public"])

# ── Finance ───────────────────────────────────────────────────────
api_router.include_router(vendor_finance.router, prefix="/vendors/me/finance", tags=["Finance"])
api_router.include_router(vendor_controlling.router, prefix="/vendors/me/controlling", tags=["Controlling"])
api_router.include_router(vendor_commission.router, prefix="/vendors/me/commission", tags=["Commission"])
api_router.include_router(vendor_schema_catalog.router, prefix="/vendors/me/schema", tags=["Schema Catalog"])

# ── App Builds (branded apps) ─────────────────────────────────────
api_router.include_router(app_builds.router, tags=["App Builds"])

# ── Public Catalog (tenant-aware) ────────────────────────────────
api_router.include_router(catalog.router, prefix="/catalog", tags=["Public Catalog"])
api_router.include_router(catalog_blog.router, prefix="/catalog/blog", tags=["Public Blog"])

# ── Business Front (customer-facing, tenant-aware) ───────────────────
api_router.include_router(store_auth.router, prefix="/store/auth", tags=["Store Auth"])
api_router.include_router(store_hr.router, prefix="/store/hr", tags=["Store HR"])
api_router.include_router(store_cart.router, prefix="/store/cart", tags=["Store Cart"])
api_router.include_router(store_checkout.router, prefix="/store/checkout", tags=["Store Checkout"])
api_router.include_router(store_orders.router, prefix="/store/orders", tags=["Store Orders"])
api_router.include_router(store_notifications.router, prefix="/store/notifications", tags=["Store Notifications"])
api_router.include_router(store_reviews.router, prefix="/store/reviews", tags=["Store Reviews"])
api_router.include_router(store_coupons.router, prefix="/store/coupons", tags=["Store Coupons"])
api_router.include_router(store_bookings.router, prefix="/store/bookings", tags=["Store Bookings"])
api_router.include_router(store_wishlist.router, prefix="/store/wishlist", tags=["Store Wishlist"])
api_router.include_router(store_marketplace.router, prefix="/store/marketplace", tags=["Store Marketplace"])
api_router.include_router(store_subscriptions.router, prefix="/store/subscriptions", tags=["Store Subscriptions"])
api_router.include_router(store_rentals.router, prefix="/store/rentals", tags=["Store Rentals"])

# ── Blog CMS ──────────────────────────────────────────────────────
api_router.include_router(vendor_blog.router, prefix="/vendors/me/blog", tags=["Vendor Blog"])

# ── Website Builder ───────────────────────────────────────────────
api_router.include_router(vendor_websites.router, prefix="/vendors/me/websites", tags=["Website Builder"])

# ── Public Sites (business front renderer, no auth) ───────────────────
api_router.include_router(public_sites.router, prefix="/public/sites", tags=["Public Sites"])

# ── Uploads ───────────────────────────────────────────────────────
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
