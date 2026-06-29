"""
Financial Statement Versions (FSV) Service
==========================================
Computes configurable financial statement reports based on a user-defined
tree structure (FinStatementVersion → FinStatementNode → FinStatementNodeAcct).

Equivalent to SAP FI-GL Financial Statement Versions.
"""
from __future__ import annotations

import uuid
import logging
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.finance import (
    FinAccount,
    FinJournalEntry,
    FinJournalLine,
    FinStatementVersion,
    FinStatementNode,
    FinStatementNodeAcct,
)

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Seed default FSVs
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_PL_STRUCTURE = [
    # (name, node_type, sort, sign_flip, bold, indent, parent_name, account_codes)
    ("Income", "group", 10, False, True, 0, None, []),
    ("Operating Revenue", "group", 20, False, False, 1, "Income", []),
    ("Sales Revenue", "item", 30, True, False, 2, "Operating Revenue", ["4100", "4110", "4120"]),
    ("Other Income", "item", 40, True, False, 2, "Operating Revenue", ["4200", "4210", "4220", "4230"]),
    ("Total Income", "subtotal", 50, False, True, 1, "Income", []),
    ("Cost of Goods Sold", "group", 60, False, True, 0, None, []),
    ("COGS", "item", 70, False, False, 1, "Cost of Goods Sold", ["5100", "5110"]),
    ("Total COGS", "subtotal", 80, False, True, 0, None, []),
    ("Gross Profit", "subtotal", 90, False, True, 0, None, []),
    ("Operating Expenses", "group", 100, False, True, 0, None, []),
    ("Salary & Wages", "item", 110, False, False, 1, "Operating Expenses", ["5210"]),
    ("Other Operating Expenses", "item", 120, False, False, 1, "Operating Expenses",
     ["5220", "5230", "5240", "5250", "5260", "5270", "5280", "5290"]),
    ("Total Operating Expenses", "subtotal", 130, False, True, 1, "Operating Expenses", []),
    ("Operating Profit (EBIT)", "subtotal", 140, False, True, 0, None, []),
    ("Tax Expenses", "item", 150, False, False, 0, None, ["5300", "5310"]),
    ("Net Profit / (Loss)", "subtotal", 160, False, True, 0, None, []),
]

DEFAULT_BS_STRUCTURE = [
    ("Assets", "group", 10, False, True, 0, None, []),
    ("Current Assets", "group", 20, False, False, 1, "Assets", []),
    ("Cash & Bank", "item", 30, False, False, 2, "Current Assets", ["1110", "1120"]),
    ("Accounts Receivable", "item", 40, False, False, 2, "Current Assets", ["1130"]),
    ("Other Current Assets", "item", 50, False, False, 2, "Current Assets",
     ["1140", "1150", "1160", "1170"]),
    ("Total Current Assets", "subtotal", 60, False, True, 1, "Current Assets", []),
    ("Fixed Assets", "group", 70, False, False, 1, "Assets", []),
    ("Gross Fixed Assets", "item", 80, False, False, 2, "Fixed Assets",
     ["1200", "1210", "1220", "1230", "1240", "1250"]),
    ("Less: Accumulated Depreciation", "item", 90, True, False, 2, "Fixed Assets", ["1290"]),
    ("Investments", "item", 100, False, False, 2, "Fixed Assets", ["1300"]),
    ("Total Fixed Assets", "subtotal", 110, False, True, 1, "Fixed Assets", []),
    ("Total Assets", "subtotal", 120, False, True, 0, None, []),
    ("Liabilities & Equity", "group", 130, False, True, 0, None, []),
    ("Current Liabilities", "group", 140, False, False, 1, "Liabilities & Equity", []),
    ("Accounts Payable", "item", 150, False, False, 2, "Current Liabilities", ["2110"]),
    ("Tax & Other Payables", "item", 160, False, False, 2, "Current Liabilities",
     ["2120", "2130", "2140", "2150", "2160"]),
    ("Total Current Liabilities", "subtotal", 170, False, True, 1, "Current Liabilities", []),
    ("Long-term Liabilities", "item", 180, False, False, 1, "Liabilities & Equity", ["2200", "2210", "2220"]),
    ("Equity", "group", 190, False, False, 1, "Liabilities & Equity", []),
    ("Share Capital & Reserves", "item", 200, False, False, 2, "Equity", ["3000", "3100", "3200", "3300"]),
    ("Total Equity", "subtotal", 210, False, True, 1, "Equity", []),
    ("Total Liabilities & Equity", "subtotal", 220, False, True, 0, None, []),
]


async def seed_default_fsv(db: AsyncSession, vendor_id: UUID) -> None:
    """Create the standard P&L and Balance Sheet FSVs for a vendor if none exist."""
    r = await db.execute(
        select(FinStatementVersion).where(
            FinStatementVersion.vendor_id == vendor_id
        ).limit(1)
    )
    if r.scalar_one_or_none():
        return  # Already seeded

    # Load all accounts for this vendor keyed by code
    r_accts = await db.execute(
        select(FinAccount).where(FinAccount.vendor_id == vendor_id)
    )
    accts_by_code: dict[str, FinAccount] = {a.code: a for a in r_accts.scalars().all()}

    for stmt_type, structure, name, desc in [
        ("income_statement", DEFAULT_PL_STRUCTURE, "Standard P&L", "Default Profit & Loss layout"),
        ("balance_sheet", DEFAULT_BS_STRUCTURE, "Standard Balance Sheet", "Default Balance Sheet layout"),
    ]:
        version = FinStatementVersion(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            name=name,
            statement_type=stmt_type,
            description=desc,
            is_default=True,
        )
        db.add(version)
        await db.flush()

        name_to_node: dict[str, FinStatementNode] = {}

        for (node_name, node_type, sort, sign_flip, bold, indent, parent_name, acct_codes) in structure:
            parent_id = name_to_node[parent_name].id if parent_name and parent_name in name_to_node else None
            node = FinStatementNode(
                id=uuid.uuid4(),
                version_id=version.id,
                vendor_id=vendor_id,
                parent_id=parent_id,
                name=node_name,
                node_type=node_type,
                sort_order=sort,
                sign_flip=sign_flip,
                bold=bold,
                indent_level=indent,
            )
            db.add(node)
            await db.flush()
            name_to_node[node_name] = node

            for code in acct_codes:
                acct = accts_by_code.get(code)
                if acct:
                    db.add(FinStatementNodeAcct(
                        id=uuid.uuid4(),
                        node_id=node.id,
                        vendor_id=vendor_id,
                        account_id=acct.id,
                    ))
                else:
                    # Store as code range (single code)
                    db.add(FinStatementNodeAcct(
                        id=uuid.uuid4(),
                        node_id=node.id,
                        vendor_id=vendor_id,
                        code_from=code,
                        code_to=code,
                    ))

    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Account balance helper
# ─────────────────────────────────────────────────────────────────────────────

async def _account_balances(
    db: AsyncSession,
    vendor_id: UUID,
    account_ids: list[UUID],
    from_date: date,
    to_date: date,
) -> dict[UUID, Decimal]:
    """Return {account_id: net_balance (debit - credit)} for the date range."""
    if not account_ids:
        return {}
    r = await db.execute(
        select(
            FinJournalLine.account_id,
            func.coalesce(func.sum(FinJournalLine.debit), 0).label("dr"),
            func.coalesce(func.sum(FinJournalLine.credit), 0).label("cr"),
        )
        .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
        .where(
            FinJournalLine.vendor_id == vendor_id,
            FinJournalLine.account_id.in_(account_ids),
            FinJournalEntry.status == "posted",
            FinJournalEntry.entry_date >= from_date,
            FinJournalEntry.entry_date <= to_date,
        )
        .group_by(FinJournalLine.account_id)
    )
    return {row.account_id: Decimal(str(row.dr)) - Decimal(str(row.cr)) for row in r.all()}


async def _resolve_accounts_for_node(
    db: AsyncSession,
    vendor_id: UUID,
    assignments: list[FinStatementNodeAcct],
) -> list[UUID]:
    """Resolve account IDs from assignments (direct or code range)."""
    direct_ids = [a.account_id for a in assignments if a.account_id]
    range_accts: list[UUID] = []
    for a in assignments:
        if not a.account_id and a.code_from:
            r = await db.execute(
                select(FinAccount.id).where(
                    FinAccount.vendor_id == vendor_id,
                    FinAccount.code >= a.code_from,
                    FinAccount.code <= (a.code_to or a.code_from),
                    FinAccount.is_active == True,
                )
            )
            range_accts.extend(row[0] for row in r.all())
    return list(set(direct_ids + range_accts))


# ─────────────────────────────────────────────────────────────────────────────
# FSV computation
# ─────────────────────────────────────────────────────────────────────────────

async def compute_fsv(
    db: AsyncSession,
    vendor_id: UUID,
    version_id: UUID,
    from_date: date,
    to_date: date,
) -> dict:
    """
    Compute the financial statement for a given FSV and date range.
    Returns a list of row dicts: {node_id, name, node_type, indent_level,
    bold, sign_flip, value, account_count}.
    """
    # Load version
    r = await db.execute(
        select(FinStatementVersion).where(
            FinStatementVersion.id == version_id,
            FinStatementVersion.vendor_id == vendor_id,
        )
    )
    version = r.scalar_one_or_none()
    if not version:
        raise ValueError("Financial Statement Version not found.")

    # Load all nodes and assignments in bulk
    r_nodes = await db.execute(
        select(FinStatementNode).where(
            FinStatementNode.version_id == version_id,
            FinStatementNode.vendor_id == vendor_id,
        ).order_by(FinStatementNode.sort_order)
    )
    nodes: list[FinStatementNode] = r_nodes.scalars().all()

    r_accts = await db.execute(
        select(FinStatementNodeAcct).where(
            FinStatementNodeAcct.vendor_id == vendor_id,
            FinStatementNodeAcct.node_id.in_([n.id for n in nodes]),
        )
    )
    accts_by_node: dict[UUID, list[FinStatementNodeAcct]] = {}
    for a in r_accts.scalars().all():
        accts_by_node.setdefault(a.node_id, []).append(a)

    # Collect all account IDs we need to query
    all_account_ids: list[UUID] = []
    node_account_ids: dict[UUID, list[UUID]] = {}
    for node in nodes:
        if node.node_type == "item":
            aids = await _resolve_accounts_for_node(
                db, vendor_id, accts_by_node.get(node.id, [])
            )
            node_account_ids[node.id] = aids
            all_account_ids.extend(aids)

    balances = await _account_balances(db, vendor_id, list(set(all_account_ids)), from_date, to_date)

    # Build node value map
    node_values: dict[UUID, Decimal] = {}

    def _compute_node(node: FinStatementNode) -> Decimal:
        if node.id in node_values:
            return node_values[node.id]

        if node.node_type == "separator":
            node_values[node.id] = Decimal(0)
            return Decimal(0)

        if node.node_type == "item":
            aids = node_account_ids.get(node.id, [])
            val = sum(balances.get(aid, Decimal(0)) for aid in aids)
        elif node.node_type in ("group", "subtotal"):
            children = [n for n in nodes if n.parent_id == node.id]
            if children:
                val = sum(_compute_node(c) for c in children)
            else:
                # Subtotal with no explicit children sums all preceding siblings
                if node.parent_id:
                    siblings = [n for n in nodes if n.parent_id == node.parent_id and n.sort_order < node.sort_order and n.node_type != "subtotal"]
                else:
                    siblings = [n for n in nodes if n.parent_id is None and n.sort_order < node.sort_order and n.node_type != "subtotal"]
                val = sum(_compute_node(s) for s in siblings)
        else:
            val = Decimal(0)

        if node.sign_flip:
            val = -val
        node_values[node.id] = val
        return val

    for node in nodes:
        _compute_node(node)

    rows = []
    for node in nodes:
        val = node_values.get(node.id, Decimal(0))
        rows.append({
            "node_id": str(node.id),
            "name": node.name,
            "node_type": node.node_type,
            "indent_level": node.indent_level,
            "bold": node.bold,
            "sign_flip": node.sign_flip,
            "value": float(val),
            "account_count": len(node_account_ids.get(node.id, [])),
        })

    return {
        "version_id": str(version.id),
        "version_name": version.name,
        "statement_type": version.statement_type,
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "rows": rows,
    }
