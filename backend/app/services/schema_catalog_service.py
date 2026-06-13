"""SQLAlchemy schema catalog for vendor-facing Models explorer."""
from __future__ import annotations

import inspect
from typing import Any

import app.models as models_pkg
from app.database import Base
from sqlalchemy import inspect as sa_inspect

# Human-readable business domain tags for feasibility / logic planning.
TABLE_DOMAIN: dict[str, str] = {
    "vendor": "Core · Vendor account",
    "store": "Business units & outlets",
    "customer": "Customers",
    "product": "Product catalog",
    "service": "Service catalog",
    "order": "Orders & fulfilment",
    "invoice": "Invoices & quotations",
    "coupon": "Coupons & promotions",
    "booking": "Bookings",
    "payment": "Payments",
    "crm_": "CRM",
    "hr_": "Human resources",
    "finance_": "Finance",
    "commission_": "Commission",
    "controlling_": "Controlling / CO",
    "project": "Projects",
    "website": "Website builder",
    "notification": "Notifications",
    "pos_": "Point of sale",
    "restaurant_": "Restaurant",
    "purchase_order": "Procurement",
    "supplier": "Suppliers",
    "inventory": "Inventory",
    "storage_location": "Storage locations",
    "production_": "Production",
    "rental_": "Rentals",
    "lead": "Leads & quotes",
    "review": "Reviews",
    "blog": "Blog CMS",
    "loyalty_": "Loyalty",
    "bundle": "Merchandising",
    "user": "Platform users",
}


def _infer_domain(table: str, module: str) -> str:
    for prefix, label in TABLE_DOMAIN.items():
        if table.startswith(prefix) or prefix.rstrip("_") in table:
            return label
    if module.startswith("hr"):
        return "Human resources"
    if module.startswith("crm"):
        return "CRM"
    if module.startswith("finance"):
        return "Finance"
    if module.startswith("controlling"):
        return "Controlling / CO"
    if module.startswith("commission"):
        return "Commission"
    return "General"


def _column_dict(col) -> dict[str, Any]:
    fks = []
    for fk in col.foreign_keys:
        target = fk.target_fullname if fk.target_fullname else str(fk.column)
        fks.append(target)
    return {
        "name": col.name,
        "type": str(col.type),
        "nullable": bool(col.nullable),
        "primary_key": bool(col.primary_key),
        "unique": bool(getattr(col, "unique", False)),
        "foreign_keys": fks,
    }


def build_schema_catalog() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_tables: set[str] = set()

    for _, obj in inspect.getmembers(models_pkg):
        if not inspect.isclass(obj):
            continue
        if obj is Base:
            continue
        tablename = getattr(obj, "__tablename__", None)
        if not tablename:
            continue
        try:
            if not issubclass(obj, Base):
                continue
        except TypeError:
            continue
        if tablename in seen_tables:
            continue
        seen_tables.add(tablename)

        try:
            mapper = sa_inspect(obj)
        except Exception:
            continue

        module = getattr(obj, "__module__", "").replace("app.models.", "")
        columns = [_column_dict(c) for c in mapper.columns]
        columns.sort(key=lambda c: (not c["primary_key"], c["name"]))

        rows.append(
            {
                "model": obj.__name__,
                "table": tablename,
                "module": module,
                "domain": _infer_domain(tablename, module),
                "column_count": len(columns),
                "columns": columns,
            }
        )

    rows.sort(key=lambda r: (r["domain"], r["table"]))
    return rows
