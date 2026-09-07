"""
GST Backfill — Purchase Order Tax Split Recompute

Recomputes CGST/SGST/IGST on existing POs using the correct intra/inter-state
split based on the supplier GSTIN vs. the vendor GSTIN.

Rules:
  - SKIP cancelled / closed POs.
  - SKIP POs with a posted journal entry (printed in the report — adjust GL manually).
  - For all other POs: recompute per-line and header GST using the live tax master.

Usage:
    cd backend
    python scripts/backfill_po_gst_recompute.py [--vendor-id <uuid>] [--dry-run]

--dry-run prints what would change without writing to the database.
"""

import asyncio
import argparse
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.procurement import PurchaseOrder, PurchaseOrderItem
from app.models.vendor import Vendor as VendorModel
from app.models.procurement import Supplier
from app.services.procurement_service import _load_tax_codes, _split_line_tax
from app.utils.gst_utils import is_intra_state, gstin_state_code


async def main(vendor_id_str: str | None, dry_run: bool) -> None:
    mode = "DRY-RUN" if dry_run else "LIVE"
    print(f"\n{'=' * 60}")
    print(f"  GST Backfill — PO recompute  [{mode}]")
    print(f"{'=' * 60}\n")

    async with AsyncSessionLocal() as db:
        # Build vendor GSTIN lookup
        vendor_query = select(VendorModel)
        if vendor_id_str:
            vendor_query = vendor_query.where(VendorModel.id == UUID(vendor_id_str))
        vendor_rows = (await db.execute(vendor_query)).scalars().all()
        vendor_gstin_map = {str(v.id): (v.gstin, v.state) for v in vendor_rows}

        # Load POs (excluding terminal states)
        po_query = (
            select(PurchaseOrder)
            .where(PurchaseOrder.status.notin_(["cancelled", "closed"]))
            .options(selectinload(PurchaseOrder.items))
        )
        if vendor_id_str:
            po_query = po_query.where(PurchaseOrder.vendor_id == UUID(vendor_id_str))
        pos = (await db.execute(po_query)).scalars().all()

        # Check which POs have a posted journal entry
        je_ids_result = await db.execute(
            text("""
                SELECT DISTINCT source_id::text
                FROM fin_journal_entry
                WHERE source_type = 'purchase_order'
                  AND status = 'posted'
            """)
        )
        posted_je_po_ids = {r[0] for r in je_ids_result}

        # Supplier GSTIN cache
        supplier_ids = list({str(po.supplier_id) for po in pos})
        supplier_rows = (
            await db.execute(select(Supplier).where(Supplier.id.in_([UUID(x) for x in supplier_ids])))
        ).scalars().all()
        supplier_gstin_map = {str(s.id): s.gstin for s in supplier_rows}

        skipped_je = 0
        updated = 0
        errors = 0

        for po in pos:
            vid = str(po.vendor_id)
            sid = str(po.supplier_id)

            if str(po.id) in posted_je_po_ids:
                print(f"  SKIP (posted GL)  {po.po_number}")
                skipped_je += 1
                continue

            vendor_gstin, vendor_state = vendor_gstin_map.get(vid, (None, None))
            supplier_gstin = supplier_gstin_map.get(sid)
            intra = is_intra_state(
                supplier_gstin=supplier_gstin,
                recipient_gstin=vendor_gstin,
                recipient_state_name=vendor_state if not vendor_gstin else None,
            )
            pos_code = gstin_state_code(supplier_gstin)

            try:
                tax_codes = await _load_tax_codes(db, po.vendor_id)
            except Exception as exc:
                print(f"  ERROR loading tax codes for {po.po_number}: {exc}")
                errors += 1
                continue

            subtotal = 0.0
            cgst_total = sgst_total = igst_total = 0.0

            changed_lines = []
            for item in po.items:
                qty = float(item.quantity_ordered or 0)
                cost = float(item.unit_cost or 0)
                line_total = round(qty * cost, 2)
                subtotal += line_total
                tax = _split_line_tax(line_total, item.tax_code, tax_codes, intra_state=intra)
                cgst_total += tax["cgst_amount"]
                sgst_total += tax["sgst_amount"]
                igst_total += tax["igst_amount"]

                old = (float(item.cgst_rate or 0), float(item.sgst_rate or 0), float(item.igst_rate or 0))
                new = (tax["cgst_rate"], tax["sgst_rate"], tax["igst_rate"])
                if old != new:
                    changed_lines.append((item.id, old, new, tax))

            new_tax = round(cgst_total + sgst_total + igst_total, 2)
            old_tax = float(po.tax_amount or 0)
            tax_changed = abs(new_tax - old_tax) > 0.001

            if not changed_lines and not tax_changed:
                continue

            print(
                f"  {'(dry) ' if dry_run else ''}UPDATE  {po.po_number}  status={po.status}  "
                f"intra={intra}  "
                f"old_tax={old_tax:.2f}  new_tax={new_tax:.2f}  "
                f"changed_lines={len(changed_lines)}"
            )

            if not dry_run:
                for item in po.items:
                    tax = _split_line_tax(
                        round(float(item.quantity_ordered or 0) * float(item.unit_cost or 0), 2),
                        item.tax_code, tax_codes, intra_state=intra,
                    )
                    item.cgst_rate = tax["cgst_rate"]
                    item.sgst_rate = tax["sgst_rate"]
                    item.igst_rate = tax["igst_rate"]
                    item.cgst_amount = tax["cgst_amount"]
                    item.sgst_amount = tax["sgst_amount"]
                    item.igst_amount = tax["igst_amount"]

                po.place_of_supply = pos_code
                po.cgst_amount = round(cgst_total, 2)
                po.sgst_amount = round(sgst_total, 2)
                po.igst_amount = round(igst_total, 2)
                po.tax_amount = new_tax
                po.total = round(float(po.subtotal or 0) + new_tax, 2)

            updated += 1

        if not dry_run:
            await db.commit()

    print(f"\n  Done.  Updated={updated}  Skipped(posted GL)={skipped_je}  Errors={errors}")
    if skipped_je:
        print("  POs with posted GL entries must be corrected manually (GL reversal + new entry).")
    if dry_run:
        print("  No changes written (--dry-run mode).")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recompute PO GST split")
    parser.add_argument("--vendor-id", default=None, help="Limit to a specific vendor UUID")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    args = parser.parse_args()
    asyncio.run(main(args.vendor_id, args.dry_run))
