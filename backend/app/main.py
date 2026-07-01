# app/main.py
import logging
import mimetypes
import traceback
from pathlib import Path
from fastapi import FastAPI, Request

mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.config import settings
from app.database import (
    connect_redis,
    close_redis,
    ensure_fiscal_year_schema,
    ensure_vendor_order_acceptance_columns,
    ensure_vendor_external_domain_columns,
    ensure_product_uom_column,
    ensure_variant_pricing_columns,
    ensure_goods_movement_codes,
    ensure_merchandising_tables,
    ensure_loyalty_tables,
    ensure_crm_tables,
    ensure_pos_transaction_accounting_columns,
    ensure_website_tables,
    ensure_pm_tables,
    ensure_restaurant_schema,
    ensure_modifier_schema,
    ensure_reservation_schema,
    ensure_restaurant_outlet_schema,
    ensure_restaurant_order_adjustments,
    ensure_purchase_requisition_schema,
    ensure_user_contact_not_globally_unique,
    ensure_user_platform_staff_role_column,
    ensure_txn_store_id_columns,
    ensure_store_hierarchy_columns,
    ensure_sales_area_tables,
    ensure_controlling_area_tables,
    ensure_production_materials_columns,
    ensure_production_routing_tables,
    ensure_user_contact_change_request_table,
)
from app.middleware.tenant import TenantMiddleware
from app.middleware.audit import CrmAuditMiddleware
from app.middleware.vendor_platform_staff_audit import VendorPlatformStaffMutationAuditMiddleware
from app.middleware.vendor_dashboard_context import VendorDashboardContextMiddleware
from app.api.v1.router import api_router

logger = logging.getLogger("uvicorn.error")

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://localhost:8081",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:5173",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_fiscal_year_schema()
    await ensure_vendor_order_acceptance_columns()
    await ensure_vendor_external_domain_columns()
    await ensure_product_uom_column()
    await ensure_variant_pricing_columns()
    await ensure_goods_movement_codes()
    await ensure_merchandising_tables()
    await ensure_loyalty_tables()
    await ensure_crm_tables()
    await ensure_pos_transaction_accounting_columns()
    await ensure_website_tables()
    await ensure_pm_tables()
    await ensure_restaurant_schema()
    await ensure_modifier_schema()
    await ensure_reservation_schema()
    await ensure_restaurant_outlet_schema()
    await ensure_restaurant_order_adjustments()
    await ensure_purchase_requisition_schema()
    await ensure_user_contact_not_globally_unique()
    await ensure_user_platform_staff_role_column()
    await ensure_txn_store_id_columns()
    await ensure_store_hierarchy_columns()
    await ensure_sales_area_tables()
    await ensure_controlling_area_tables()
    await ensure_production_materials_columns()
    await ensure_production_routing_tables()
    await ensure_user_contact_change_request_table()
    await connect_redis()
    from app.services.email_service import email_is_configured, sendgrid_api_key

    if email_is_configured():
        via = "SendGrid API" if sendgrid_api_key() else "SMTP"
        logger.info("Email delivery configured (%s). Order emails and OTP will send.", via)
    else:
        logger.warning(
            "Email delivery NOT configured — set SENDGRID_API_KEY or SMTP_HOST/SMTP_PASSWORD "
            "in backend/.env, then restart the backend. Until then, emails are logged only "
            "and OTP codes appear as dev_hint in the UI."
        )
    yield
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    description="KIT ERP API - Business Management Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS first so all responses (including errors) get CORS headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$|https?://.*\.kiterp\.com|https?://\d{1,3}(\.\d{1,3}){3}(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantMiddleware)
app.add_middleware(VendorDashboardContextMiddleware)
app.add_middleware(CrmAuditMiddleware)
app.add_middleware(VendorPlatformStaffMutationAuditMiddleware)

# API Routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serve uploaded files statically
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler
from fastapi import status
from sqlalchemy.exc import MultipleResultsFound, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException


def _cors_headers(origin: str) -> dict:
    if not origin:
        origin = "*"
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    origin = request.headers.get("origin", "") or "*"
    errors = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({"field": field_path, "message": error["msg"], "type": error["type"]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors, "message": "Validation error. Please check your input."},
        headers=_cors_headers(origin),
    )


@app.exception_handler(MultipleResultsFound)
async def multiple_results_found_handler(request: Request, exc: MultipleResultsFound):
    """ORM expected at most one row (e.g. duplicate vendor_user for same user+vendor). Not a DB outage."""
    logger.warning(
        "MultipleResultsFound on %s %s: %s",
        request.method,
        request.url.path,
        exc,
    )
    origin = request.headers.get("origin", "") or "*"
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": {
                "code": "ambiguous_vendor_resolution",
                "message": (
                    "More than one vendor-team row matched your account for this business "
                    "(duplicate membership). Remove the extra row in vendor_user for this user and vendor, "
                    "or contact support. Platform support should open the store via admin handoff so "
                    "X-Vendor-Id matches the correct business."
                ),
                "technical": str(exc),
            },
            "message": "Ambiguous vendor context — duplicate database rows for this user on this vendor.",
        },
        headers=_cors_headers(origin),
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """DB/schema errors must not be swallowed as generic 500 — subclass SQLAlchemyError before Exception."""
    if isinstance(exc, MultipleResultsFound):
        return await multiple_results_found_handler(request, exc)
    logger.error(
        "Database error on %s %s: %s\n%s",
        request.method,
        request.url.path,
        exc,
        traceback.format_exc(),
    )
    origin = request.headers.get("origin", "") or "*"
    orig = getattr(exc, "orig", None)
    detail = str(orig).strip() if orig is not None else str(exc).strip()
    return JSONResponse(
        status_code=503,
        content={
            "detail": detail or "Database error",
            "type": type(exc).__name__,
            "message": "Database/schema issue. Run: docker compose exec backend alembic upgrade heads",
        },
        headers=_cors_headers(origin),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Safety net: HTTPException must never become a misleading HTTP 500 JSON body.
    if isinstance(exc, StarletteHTTPException):
        return await http_exception_handler(request, exc)
    logger.error("Unhandled exception on %s %s: %s\n%s", request.method, request.url.path, exc, traceback.format_exc())
    origin = request.headers.get("origin", "") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "message": "Server error. Check backend logs."},
        headers=_cors_headers(origin),
    )


@app.get("/health")
async def health_check():
    from app.services.email_service import email_is_configured, sendgrid_api_key

    configured = email_is_configured()
    return {
        "status": "healthy",
        "email_otp_configured": configured,
        "email_provider": (
            "sendgrid" if sendgrid_api_key() else "smtp" if configured else "none"
        ),
    }


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
    }
