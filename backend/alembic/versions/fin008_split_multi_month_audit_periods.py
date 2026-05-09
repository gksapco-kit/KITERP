"""
Split existing audit fin_period rows that span more than one calendar month
into one row per month (same behavior as add_audit_periods + expand).

Revision ID: fin008_split_multi_month_audit_periods
Revises: fin007_fiscal_schema_repair
"""
from __future__ import annotations

import calendar
import uuid
from datetime import date
from typing import List, Optional, Tuple

from alembic import op
from sqlalchemy import text

revision = "fin008_split_multi_month_audit_periods"
down_revision = "fin007_fiscal_schema_repair"
branch_labels = None
depends_on = None


def _iter_month_segs(
    r_start: date, r_end: date
) -> List[Tuple[date, date, int, str]]:
    out: List[Tuple[date, date, int, str]] = []
    y, m = r_start.year, r_start.month
    n = 0
    while True:
        first = date(y, m, 1)
        last_d = calendar.monthrange(y, m)[1]
        last = date(y, m, last_d)
        if first > r_end:
            break
        seg_a = max(first, r_start)
        seg_b = min(last, r_end)
        if seg_a <= seg_b:
            n += 1
            mlab = first.strftime("%b %Y")
            out.append((seg_a, seg_b, n, mlab))
        if last > r_end:
            break
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
    return out


def _short_name(base: str, month_label: str) -> str:
    b = (base or "Audit").strip()
    s = f"{b} {month_label}"
    if len(s) <= 30:
        return s
    keep = 30 - 1 - len(month_label)
    if keep < 1:
        return month_label[:30]
    return f"{b[:keep].rstrip()} {month_label}"[:30]


def upgrade() -> None:
    conn = op.get_bind()
    discover = text(
        """
        SELECT id, vendor_id, fiscal_year_id, name, start_date, end_date,
               period_number, status, closed_at, closed_by_id
        FROM fin_period
        WHERE period_kind = 'audit'
        """
    )
    rows = list(conn.execute(discover).mappings().all())
    job_rows: list = []
    for r in rows:
        sd, ed = r["start_date"], r["end_date"]
        if sd is None or ed is None or ed < sd:
            continue
        if (sd.year, sd.month) == (ed.year, ed.month):
            continue
        segs = _iter_month_segs(sd, ed)
        if len(segs) <= 1:
            continue
        job_rows.append(
            {
                "id": r["id"],
                "name": (r["name"] or "Audit").strip(),
                "status": (r["status"] or "open").strip(),
                "vendor_id": r["vendor_id"],
                "fiscal_year_id": r["fiscal_year_id"],
                "p0": int(r["period_number"] or 0),
                "ca": r["closed_at"],
                "cby": r["closed_by_id"],
            }
        )
    if not job_rows:
        return
    job_rows.sort(key=lambda r: (str(r["fiscal_year_id"]), r["p0"]))

    for job in job_rows:
        cur = conn.execute(
            text(
                "SELECT id, period_number, start_date, end_date, name, status, closed_at, closed_by_id, "
                "vendor_id, fiscal_year_id, period_kind "
                "FROM fin_period WHERE id = :id"
            ),
            {"id": job["id"]},
        ).mappings().first()
        if not cur or (cur.get("period_kind") or "standard") != "audit":
            continue
        sd, ed = cur["start_date"], cur["end_date"]
        segs = _iter_month_segs(sd, ed)
        if len(segs) <= 1:
            continue
        pnum = int(cur["period_number"] or 0)
        off = len(segs) - 1
        name_base = (cur["name"] or job["name"] or "Audit").strip()
        st = (cur["status"] or job["status"] or "open").strip()
        ca = cur["closed_at"] if cur["closed_at"] is not None else job.get("ca")
        cby: Optional[object] = cur["closed_by_id"] if cur["closed_by_id"] is not None else job.get("cby")
        vendor_id = cur["vendor_id"]
        fy_id = cur["fiscal_year_id"]
        pid = cur["id"]

        conn.execute(
            text(
                "UPDATE fin_period SET period_number = period_number + :off "
                "WHERE fiscal_year_id = :fy AND period_number > :pnum"
            ),
            {"off": off, "fy": fy_id, "pnum": pnum},
        )

        s0, e0, _n0, lab0 = segs[0]
        nm0 = _short_name(name_base, lab0)
        conn.execute(
            text(
                "UPDATE fin_period SET name = :name, start_date = :sd, end_date = :ed "
                "WHERE id = :id"
            ),
            {"name": nm0, "sd": s0, "ed": e0, "id": pid},
        )

        for j, (ss, ee, _nj, mlab) in enumerate(segs[1:], start=1):
            new_id = uuid.uuid4()
            nmi = _short_name(name_base, mlab)
            conn.execute(
                text(
                    """
                    INSERT INTO fin_period (
                        id, vendor_id, fiscal_year_id, name, start_date, end_date,
                        period_number, period_kind, status, closed_at, closed_by_id
                    ) VALUES (
                        :id, :vid, :fy, :name, :sd, :ee, :pnum, 'audit', :st, :ca, :cby
                    )
                    """
                ),
                {
                    "id": new_id,
                    "vid": vendor_id,
                    "fy": fy_id,
                    "name": nmi,
                    "sd": ss,
                    "ee": ee,
                    "pnum": pnum + j,
                    "st": st,
                    "ca": ca,
                    "cby": cby,
                },
            )


def downgrade() -> None:
    pass
