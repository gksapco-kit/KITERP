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
    ensure_product_uom_column,
    ensure_variant_pricing_columns,
    ensure_merchandising_tables,
    ensure_loyalty_tables,
    ensure_crm_tables,
    ensure_pos_transaction_accounting_columns,
    ensure_website_tables,
    ensure_restaurant_schema,
    ensure_user_contact_not_globally_unique,
)
from app.middleware.tenant import TenantMiddleware
from app.middleware.audit import CrmAuditMiddleware
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
    await ensure_product_uom_column()
    await ensure_variant_pricing_columns()
    await ensure_merchandising_tables()
    await ensure_loyalty_tables()
    await ensure_crm_tables()
    await ensure_pos_transaction_accounting_columns()
    await ensure_website_tables()
    await ensure_restaurant_schema()
    await ensure_user_contact_not_globally_unique()
    await connect_redis()
    yield
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    description="ArT (Ask r Task) API - Vendor Management Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS first so all responses (including errors) get CORS headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$|https?://.*\.kiterp\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantMiddleware)
app.add_middleware(CrmAuditMiddleware)

# API Routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serve uploaded files statically
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


from fastapi.exceptions import RequestValidationError
from fastapi import status


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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s\n%s", request.method, request.url.path, exc, traceback.format_exc())
    origin = request.headers.get("origin", "") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "message": "Server error. Check backend logs."},
        headers=_cors_headers(origin),
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
    }
