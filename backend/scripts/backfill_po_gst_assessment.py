"""
GST Backfill Assessment — Purchase Orders

Run BEFORE applying the full GST tax-split backfill.
Prints a summary of existing POs categorised by their tax situation:
  1. POs with a posted journal entry (cannot be silently recomputed)
  2. POs with non-zero tax that used a combined GST code (affected by split change)
  3. POs with zero tax (safe to recompute once correct codes are configured)
  4. POs already cancelled / closed (skip from backfill)

Usage:
    cd backend
    python scripts/backfill_po_gst_assessment.py [--vendor-id <uuid>]

Output is a plain-text report. No rows are modified.
"""

import asyncio
import argparse
import sys
from pathlib import Path

# Allow running from the backend/ directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import AsyncSessionLocal


ASSESSMENT_SQL = """
SELECT
    po.id,
    po.po_number,
    po.status,
    po.tax_amount,
    po.cgst_amount,
    po.sgst_amount,
    po.igst_amount,
    po.place_of_supply,
    po.created_at::date            AS po_date,
    s.gstin                        AS supplier_gstin,
    v.gstin                        AS vendor_gstin,
    -- Is there a posted GL journal entry linked to this PO?
    EXISTS (
        SELECT 1 FROM fin_journal_entry je
        WHERE je.source_type = 'purchase_order'
          AND je.source_id   = po.id
          AND je.status      = 'posted'
    )                              AS has_posted_je,
    -- Collect distinct tax types used on items
    ARRAY_AGG(DISTINCT ftc.tax_type) FILTER (WHERE ftc.tax_type IS NOT NULL)
                                   AS tax_types_used,
    -- Does any line use a GST-type code that would be affected by the split?
    BOOL_OR(UPPER(ftc.tax_type) = 'GST')
                                   AS uses_combined_gst_code
FROM purchase_order po
JOIN supplier       s  ON s.id = po.supplier_id
JOIN vendor         v  ON v.id = po.vendor_id
LEFT JOIN purchase_order_item poi ON poi.purchase_order_id = po.id
LEFT JOIN fin_tax_code ftc
       ON UPPER(ftc.code) = UPPER(poi.tax_code)
      AND ftc.vendor_id   = po.vendor_id
WHERE (:vendor_id IS NULL OR po.vendor_id = :vendor_id::uuid)
GROUP BY po.id, po.po_number, po.status, po.tax_amount,
         po.cgst_amount, po.sgst_amount, po.igst_amount,
         po.place_of_supply, po.created_at, s.gstin, v.gstin
ORDER BY po.created_at DESC;
"""


async def main(vendor_id: str | None = None) -> None:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(text(ASSESSMENT_SQL), {"vendor_id": vendor_id})).mappings().all()

    if not rows:
        print("No purchase orders found.")
        return

    posted_je: list = []
    affected_gst: list = []
    zero_tax: list = []
    skipped: list = []

    for row in rows:
        if row["status"] in ("cancelled", "closed"):
            skipped.append(row)
        elif row["has_posted_je"]:
            posted_je.append(row)
        elif row["uses_combined_gst_code"]:
            affected_gst.append(row)
        else:
            zero_tax.append(row)

    print("\n" + "=" * 70)
    print("  GST Backfill Assessment — Purchase Orders")
    print("=" * 70)
    print(f"\n  Total POs:                        {len(rows):>6}")
    print(f"  Cancelled / closed (skip):        {len(skipped):>6}")
    print(f"  With posted GL journal entry:     {len(posted_je):>6}  ← review manually")
    print(f"  Use combined GST code (affected): {len(affected_gst):>6}  ← recompute")
    print(f"  Zero-tax / non-GST lines:         {len(zero_tax):>6}  ← safe to skip")

    if posted_je:
        print("\n── POs with posted journal entries (manual GL adjustment needed) ──")
        for r in posted_je:
            vendor_match = (
                (r["supplier_gstin"] or "")[:2] == (r["vendor_gstin"] or "")[:2]
            )
            print(
                f"  {r['po_number']}  {r['po_date']}  status={r['status']}  "
                f"tax={r['tax_amount']}  cgst={r['cgst_amount']}  sgst={r['sgst_amount']}  "
                f"igst={r['igst_amount']}  intra={'YES' if vendor_match else 'NO'}  "
                f"supplier_gstin={r['supplier_gstin'] or 'N/A'}"
            )

    if affected_gst:
        print("\n── POs using combined GST codes (safe to recompute on draft/approved) ──")
        for r in affected_gst[:20]:
            vendor_match = (
                (r["supplier_gstin"] or "")[:2] == (r["vendor_gstin"] or "")[:2]
            )
            print(
                f"  {r['po_number']}  {r['po_date']}  status={r['status']}  "
                f"tax={r['tax_amount']}  intra={'YES' if vendor_match else 'NO'}  "
                f"types={r['tax_types_used']}"
            )
        if len(affected_gst) > 20:
            print(f"  … and {len(affected_gst) - 20} more")

    print("\nRun backfill_po_gst_recompute.py to apply corrections.")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Assess PO GST backfill scope")
    parser.add_argument("--vendor-id", default=None, help="Limit to a specific vendor UUID")
    args = parser.parse_args()
    asyncio.run(main(args.vendor_id))
