from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from uuid import UUID
import math

from app.database import get_db
from app.api.deps import (
    get_current_active_user,
    get_current_vendor_user,
    normalized_vendor_role,
    require_permission,
)
from app.models.vendor_user import VendorUser
from app.services.store_resolver import get_default_store_id

# Vendor-wide ("all stores") roles fall back to the default business unit when
# they have no explicit store assignment, instead of being blocked from the POS.
_ALL_STORE_ROLES = ("owner", "admin")
from app.models.user import User
from app.services.vendor_service import VendorService
from app.services.pos_service import POSService
from app.schemas.pos import (
    POSSessionOpen,
    POSSessionClose,
    POSTransactionCreate,
    POSTransactionVoid,
    POSTransactionMemoUpdate,
)


def _friendly_db_error(exc: Exception) -> str:
    """Convert a raw SQLAlchemy / asyncpg exception into a short user-facing message."""
    msg = str(exc).lower()
    if "not-null constraint" in msg or "notnullviolation" in msg or "null value in column" in msg:
        import re
        col = re.search(r'null value in column "(\w+)"', str(exc))
        field = col.group(1).replace("_", " ") if col else "a required field"
        return f"Missing required value: {field} cannot be empty"
    if "unique constraint" in msg or "uniqueviolation" in msg or "already exists" in msg:
        return "A record with this information already exists"
    if "foreign key constraint" in msg or "foreignkeyviolation" in msg:
        return "The referenced record does not exist — please check the linked data"
    if "check constraint" in msg or "checkviolation" in msg:
        return "One or more values are outside the allowed range"
    if "deadlock" in msg:
        return "A database conflict occurred — please try again"
    return "A database error occurred — please check your input and try again"

router = APIRouter()


async def _vendor_id(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


async def _compute_locked_store_id(vu: VendorUser, db: AsyncSession) -> UUID:
    """The business unit the current cashier is locked to.

    Staff are locked to their assigned store. Owners/admins (vendor-wide roles)
    with no explicit assignment fall back to the vendor's default business unit.
    Everyone else is blocked until an admin assigns them to a store."""
    store_id = getattr(vu, "store_id", None)
    if store_id:
        return store_id

    if normalized_vendor_role(vu) in _ALL_STORE_ROLES:
        default_store = await get_default_store_id(db, vu.vendor_id)
        if default_store:
            return default_store
        raise HTTPException(
            404,
            "No business unit found. Create a business unit before using the POS.",
        )

    raise HTTPException(
        403,
        "You are not assigned to a business unit. Ask an admin to assign you "
        "to a store before using the POS.",
    )


async def _locked_store_id(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    return await _compute_locked_store_id(vu, db)


async def _resolve_request_store_id(
    vu: VendorUser, db: AsyncSession, requested: Optional[UUID | str],
) -> UUID:
    """Resolve the store for a request, allowing privileged roles to override.

    Owners/admins may target any active store of the vendor (used by the
    memo BU selector). Staff stay locked to their assigned store.
    """
    locked = await _compute_locked_store_id(vu, db)
    if not requested:
        return locked
    try:
        requested_uuid = requested if isinstance(requested, UUID) else UUID(str(requested))
    except (ValueError, TypeError):
        return locked
    if requested_uuid == locked:
        return locked
    if normalized_vendor_role(vu) in _ALL_STORE_ROLES:
        from sqlalchemy import select
        from app.models.store import Store
        row = await db.execute(
            select(Store.id).where(Store.id == requested_uuid, Store.vendor_id == vu.vendor_id)
        )
        if row.scalars().first():
            return requested_uuid
    return locked


def _session_dict(s) -> dict:
    return {
        "id": str(s.id), "vendor_id": str(s.vendor_id),
        "store_id": str(s.store_id) if getattr(s, "store_id", None) else None,
        "opened_by": str(s.opened_by),
        "closed_by": str(s.closed_by) if s.closed_by else None,
        "session_date": str(s.session_date), "opening_cash": float(s.opening_cash or 0),
        "closing_cash": float(s.closing_cash) if s.closing_cash is not None else None,
        "total_sales": float(s.total_sales or 0), "total_returns": float(s.total_returns or 0),
        "total_discount": float(s.total_discount or 0), "total_tax": float(s.total_tax or 0),
        "transaction_count": s.transaction_count or 0,
        "cash_total": float(s.cash_total or 0), "upi_total": float(s.upi_total or 0),
        "card_total": float(s.card_total or 0), "status": s.status,
        "notes": s.notes,
        "opened_at": s.opened_at.isoformat() if s.opened_at else None,
        "closed_at": s.closed_at.isoformat() if s.closed_at else None,
    }


def _txn_dict(t, *, order_number: str = None, invoice_number: str = None, invoice_id: str = None) -> dict:
    d = {
        "id": str(t.id), "vendor_id": str(t.vendor_id), "session_id": str(t.session_id),
        "store_id": str(t.store_id) if getattr(t, "store_id", None) else None,
        "cashier_id": str(t.cashier_id),
        "customer_id": str(t.customer_id) if t.customer_id else None,
        "transaction_number": t.transaction_number, "transaction_type": t.transaction_type,
        "items": t.items or [], "item_count": t.item_count or 0,
        "subtotal": float(t.subtotal or 0), "discount_amount": float(t.discount_amount or 0),
        "discount_type": t.discount_type, "discount_value": float(t.discount_value or 0),
        "tax_amount": float(t.tax_amount or 0), "total": float(t.total or 0),
        "payment_methods": t.payment_methods or [],
        "cash_received": float(t.cash_received or 0), "change_due": float(t.change_due or 0),
        "coupon_code": getattr(t, 'coupon_code', None),
        "coupon_discount": float(getattr(t, 'coupon_discount', 0) or 0),
        "loyalty_points_redeemed": getattr(t, 'loyalty_points_redeemed', 0) or 0,
        "loyalty_points_earned": getattr(t, 'loyalty_points_earned', 0) or 0,
        "loyalty_discount": float(getattr(t, 'loyalty_discount', 0) or 0),
        "status": t.status, "return_of": str(t.return_of) if t.return_of else None,
        "invoice_id": invoice_id or (str(t.invoice_id) if t.invoice_id else None),
        "invoice_number": invoice_number,
        "order_number": order_number,
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "restaurant_table_id": str(t.restaurant_table_id) if getattr(t, "restaurant_table_id", None) else None,
        "kitchen_ticket_status": getattr(t, "kitchen_ticket_status", None),
        "tip_amount": float(getattr(t, "tip_amount", 0) or 0),
        "service_charge_amount": float(getattr(t, "service_charge_amount", 0) or 0),
        "sales_person_vendor_user_id": (
            str(t.sales_person_vendor_user_id)
            if getattr(t, "sales_person_vendor_user_id", None)
            else None
        ),
    }
    return d


# ── Sessions ──────────────────────────────────────────────────────

@router.post("/sessions/open", status_code=201)
async def open_session(
    data: POSSessionOpen,
    user: User = Depends(get_current_active_user),
    _perm: VendorUser = Depends(require_permission("pos.manage")),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    store_id = await _resolve_request_store_id(_perm, db, data.store_id)
    try:
        s = await svc.open_session(vid, user.id, store_id, data.opening_cash, data.notes)
        return JSONResponse(content=_session_dict(s), status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/sessions/{session_id}/close")
async def close_session(
    session_id: str,
    data: POSSessionClose,
    user: User = Depends(get_current_active_user),
    _perm: VendorUser = Depends(require_permission("pos.manage")),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    try:
        s = await svc.close_session(UUID(session_id), vid, user.id, data.closing_cash, data.notes)
        # Finance GL: post POS session totals
        try:
            from app.services.finance.posting import post_event
            await post_event(db, vid, "pos", UUID(session_id), {
                "cash_total": float(data.closing_cash or 0),
                "card_total": 0,
                "upi_total": 0,
                "tax_total": 0,
                "narration": f"POS Session {session_id[:8]}",
            })
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Finance GL: failed to post POS session %s", session_id)
        return JSONResponse(content=_session_dict(s))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/sessions/current")
async def get_current_session(
    store_id: Optional[str] = Query(None),
    vu: VendorUser = Depends(get_current_vendor_user),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    resolved_store = await _resolve_request_store_id(vu, db, store_id)
    s = await svc.get_open_session(vid, resolved_store)
    if not s:
        return JSONResponse(content={"session": None})
    return JSONResponse(content={"session": _session_dict(s)})


@router.get("/sessions")
async def list_sessions(
    status: str = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vid: UUID = Depends(_vendor_id),
    store_id: UUID = Depends(_locked_store_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    items, total = await svc.get_sessions(vid, status, page, size, store_id=store_id)
    return JSONResponse(content={"items": [_session_dict(s) for s in items], "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 0})


# ── Transactions ──────────────────────────────────────────────────

@router.post("/transactions", status_code=201)
async def create_transaction(
    data: POSTransactionCreate,
    user: User = Depends(get_current_active_user),
    _perm: VendorUser = Depends(require_permission("pos.manage")),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    store_id = await _resolve_request_store_id(_perm, db, data.store_id)
    try:
        items = [i.model_dump() for i in data.items]
        payments = [p.model_dump() for p in data.payment_methods]
        result = await svc.create_transaction(
            vendor_id=vid, session_id=UUID(data.session_id), cashier_id=user.id,
            store_id=store_id,
            items=items, payment_methods=payments,
            customer_id=UUID(data.customer_id) if data.customer_id else None,
            transaction_type=data.transaction_type.value,
            discount_type=data.discount_type, discount_value=data.discount_value,
            cash_received=data.cash_received, notes=data.notes,
            return_of=UUID(data.return_of) if data.return_of else None,
            coupon_code=data.coupon_code,
            loyalty_points_redeem=data.loyalty_points_redeem,
            restaurant_table_id=UUID(data.restaurant_table_id) if getattr(data, "restaurant_table_id", None) else None,
            sales_person_vendor_user_id=(
                UUID(data.sales_person_vendor_user_id)
                if getattr(data, "sales_person_vendor_user_id", None)
                else None
            ),
            tip_amount=getattr(data, "tip_amount", 0) or 0,
            service_charge_amount=getattr(data, "service_charge_amount", 0) or 0,
        )
        txn = result["txn"]
        resp = _txn_dict(
            txn,
            order_number=result.get("order_number"),
            invoice_number=result.get("invoice_number"),
            invoice_id=result.get("invoice_id"),
        )
        resp["booking_numbers"] = result.get("booking_numbers", [])
        resp["coupon_discount"] = result.get("coupon_discount", 0)
        resp["loyalty_points_earned"] = result.get("loyalty_points_earned", 0)
        resp["loyalty_points_redeemed"] = result.get("loyalty_points_redeemed", 0)
        resp["loyalty_discount"] = result.get("loyalty_discount", 0)
        return JSONResponse(content=resp, status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except (IntegrityError, SQLAlchemyError) as e:
        await db.rollback()
        raise HTTPException(422, _friendly_db_error(e))
    except Exception as e:
        await db.rollback()
        msg = str(e)
        if "Session's transaction has been rolled back" in msg or "IntegrityError" in msg:
            raise HTTPException(422, _friendly_db_error(e))
        raise HTTPException(500, "An unexpected error occurred — please try again")


def _txn_history_row(t, customer_name, order_number, invoice_number) -> dict:
    pms = t.payment_methods or []
    primary = pms[0].get("method") if pms else None
    return {
        "id": str(t.id),
        "store_id": str(t.store_id) if getattr(t, "store_id", None) else None,
        "transaction_number": t.transaction_number,
        "order_number": order_number or t.transaction_number,
        "transaction_type": t.transaction_type or "sale",
        "customer_name": customer_name,
        "customer_id": str(t.customer_id) if t.customer_id else None,
        "item_count": t.item_count or 0,
        "items": t.items or [],
        "subtotal": float(t.subtotal or 0),
        "discount_amount": float(t.discount_amount or 0),
        "tax_amount": float(t.tax_amount or 0),
        "total": float(t.total or 0),
        "payment_method": primary,
        "payment_methods": pms,
        "status": t.status or "completed",
        "invoice_id": str(t.invoice_id) if t.invoice_id else None,
        "invoice_number": invoice_number,
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "restaurant_table_id": str(t.restaurant_table_id) if getattr(t, "restaurant_table_id", None) else None,
        "kitchen_ticket_status": getattr(t, "kitchen_ticket_status", None),
        "sales_person_vendor_user_id": (
            str(t.sales_person_vendor_user_id)
            if getattr(t, "sales_person_vendor_user_id", None)
            else None
        ),
    }


@router.get("/transactions")
async def list_vendor_transactions(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    include_voided: bool = Query(False),
    store_id: Optional[str] = Query(None),
    vu: VendorUser = Depends(get_current_vendor_user),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    store_id = await _resolve_request_store_id(vu, db, store_id)
    skip = (page - 1) * size
    rows, total = await svc.list_vendor_transactions(
        vid, skip=skip, limit=size, search=search,
        transaction_type=transaction_type, include_voided=include_voided,
        store_id=store_id,
    )
    items = [_txn_history_row(t, cname, onum, inum) for t, cname, onum, inum in rows]
    return JSONResponse(
        content={
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": math.ceil(total / size) if total else 0,
        }
    )


@router.get("/transactions/lookup")
async def lookup_transaction(
    q: str = Query(..., alias="txn_number", description="Transaction or order number"),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    txn = await svc.find_transaction_by_number(vid, q)
    if not txn and q.upper().startswith("ORD-"):
        txn = await svc.find_by_order_number(vid, q)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return JSONResponse(content=_txn_dict(txn))


@router.get("/transactions/{txn_id}")
async def get_transaction(txn_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = POSService(db)
    txn = await svc.get_transaction(vid, UUID(txn_id))
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return JSONResponse(content=_txn_dict(txn))


@router.post("/transactions/{txn_id}/void", status_code=200)
async def void_memo_transaction(
    txn_id: str,
    data: Optional[POSTransactionVoid] = Body(default=None),
    user: User = Depends(get_current_active_user),
    _perm: VendorUser = Depends(require_permission("pos.manage")),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    try:
        reason = (data.reason if data else None) or None
        txn = await svc.void_memo_transaction(
            vendor_id=vid, txn_id=UUID(txn_id), user_id=user.id, reason=reason,
        )
        return JSONResponse(content=_txn_dict(txn))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        await db.rollback()
        raise


@router.patch("/transactions/{txn_id}/memo", status_code=200)
async def update_memo_transaction(
    txn_id: str,
    data: POSTransactionMemoUpdate,
    user: User = Depends(get_current_active_user),
    _perm: VendorUser = Depends(require_permission("pos.manage")),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = POSService(db)
    try:
        items = [i.model_dump() for i in data.items]
        payments = [p.model_dump() for p in data.payment_methods]
        txn = await svc.update_memo_transaction(
            vendor_id=vid,
            txn_id=UUID(txn_id),
            cashier_id=user.id,
            customer_id=UUID(data.customer_id) if data.customer_id else None,
            items=items,
            payment_methods=payments,
            discount_type=data.discount_type,
            discount_value=data.discount_value,
            cash_received=data.cash_received,
            notes=data.notes,
        )
        return JSONResponse(content=_txn_dict(txn))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        await db.rollback()
        raise


@router.get("/sessions/{session_id}/transactions")
async def get_session_transactions(session_id: str, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=100), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = POSService(db)
    items, total = await svc.get_session_transactions(UUID(session_id), vid, page, size)
    return JSONResponse(content={"items": [_txn_dict(t) for t in items], "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 0})


@router.get("/sessions/{session_id}/z-report")
async def z_report(session_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = POSService(db)
    try:
        data = await svc.get_z_report(UUID(session_id), vid)
        session = data["session"]
        txns = data["transactions"]
        return JSONResponse(content={
            "session": _session_dict(session),
            "transactions": [_txn_dict(t) for t in txns],
            "summary": {
                "total_sales": float(session.total_sales or 0),
                "total_returns": float(session.total_returns or 0),
                "net_sales": float(session.total_sales or 0) - float(session.total_returns or 0),
                "total_tax": float(session.total_tax or 0),
                "total_discount": float(session.total_discount or 0),
                "cash": float(session.cash_total or 0),
                "upi": float(session.upi_total or 0),
                "card": float(session.card_total or 0),
                "transaction_count": session.transaction_count or 0,
                "opening_cash": float(session.opening_cash or 0),
                "closing_cash": float(session.closing_cash or 0) if session.closing_cash is not None else None,
            },
        })
    except ValueError as e:
        raise HTTPException(400, str(e))
