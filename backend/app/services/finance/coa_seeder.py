"""
Default Chart of Accounts Seeder
Seeds a standard Indian SMB COA when a vendor sets up Finance for the first time.
"""
from __future__ import annotations
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.finance import (
    FinAccount, FinFiscalYear, FinFiscalYearCompany, FinPeriod, FinCompany,
    FinAssetCategory,
)
from app.services.finance.fiscal_calendar import build_standard_periods


async def get_or_create_default_fin_company(db: AsyncSession, vendor_id) -> FinCompany:
    r = await db.execute(
        select(FinCompany).where(
            FinCompany.vendor_id == vendor_id,
            FinCompany.is_default == True,
            FinCompany.is_active == True,
        ).limit(1)
    )
    co = r.scalar_one_or_none()
    if co:
        return co
    r2 = await db.execute(
        select(FinCompany).where(FinCompany.vendor_id == vendor_id).order_by(FinCompany.code).limit(1)
    )
    co = r2.scalar_one_or_none()
    if co:
        return co
    co = FinCompany(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        code="1000",
        name="Main company",
        is_default=True,
        is_active=True,
    )
    db.add(co)
    await db.flush()
    return co

DEFAULT_COA = [
    # (code, name, account_type, account_subtype, is_system, is_reconciliation_account, reconciliation_subledger)
    # ASSETS
    ("1000", "Assets", "Asset", None, True, False, None),
    ("1100", "Current Assets", "Asset", "Current Asset", True, False, None),
    ("1110", "Cash in Hand", "Asset", "Current Asset", True, False, None),
    ("1120", "Bank Accounts", "Asset", "Current Asset", True, False, None),
    # AR reconciliation account — auto-posting only; manual posting blocked
    ("1130", "Accounts Receivable", "Asset", "Current Asset", True, True, "customer"),
    ("1140", "GST Input Credit", "Asset", "Current Asset", True, False, None),
    ("1150", "Advance to Suppliers", "Asset", "Current Asset", False, False, None),
    ("1160", "Prepaid Expenses", "Asset", "Current Asset", False, False, None),
    ("1170", "Inventory / Stock", "Asset", "Current Asset", False, False, None),
    ("1200", "Fixed Assets", "Asset", "Fixed Asset", True, False, None),
    ("1210", "Plant & Machinery", "Asset", "Fixed Asset", False, False, None),
    ("1220", "Computers & Equipment", "Asset", "Fixed Asset", False, False, None),
    ("1230", "Furniture & Fixtures", "Asset", "Fixed Asset", False, False, None),
    ("1240", "Vehicles", "Asset", "Fixed Asset", False, False, None),
    ("1250", "Land & Building", "Asset", "Fixed Asset", False, False, None),
    # Asset / AccumDep reconciliation account — auto-posting only
    ("1290", "Accumulated Depreciation", "Asset", "Fixed Asset", True, True, "asset"),
    ("1300", "Investments", "Asset", "Fixed Asset", False, False, None),
    # LIABILITIES
    ("2000", "Liabilities", "Liability", None, True, False, None),
    ("2100", "Current Liabilities", "Liability", "Current Liability", True, False, None),
    # AP reconciliation account — auto-posting only; manual posting blocked
    ("2110", "Accounts Payable", "Liability", "Current Liability", True, True, "supplier"),
    ("2120", "GST Output Payable", "Liability", "Current Liability", True, False, None),
    ("2130", "TDS Payable", "Liability", "Current Liability", True, False, None),
    ("2140", "Salary Payable", "Liability", "Current Liability", True, False, None),
    ("2150", "Advance from Customers", "Liability", "Current Liability", False, False, None),
    ("2160", "Other Current Liabilities", "Liability", "Current Liability", False, False, None),
    ("2200", "Long-term Liabilities", "Liability", "Long-term Liability", False, False, None),
    ("2210", "Long-term Loans", "Liability", "Long-term Liability", False, False, None),
    ("2220", "Bank Overdraft", "Liability", "Long-term Liability", False, False, None),
    # EQUITY
    ("3000", "Equity", "Equity", "Owner Equity", True, False, None),
    ("3100", "Owner's Capital", "Equity", "Owner Equity", False, False, None),
    ("3200", "Retained Earnings", "Equity", "Owner Equity", True, False, None),
    ("3300", "Current Year Profit/Loss", "Equity", "Owner Equity", True, False, None),
    # INCOME
    ("4000", "Income", "Income", None, True, False, None),
    ("4100", "Sales Revenue", "Income", "Operating Income", True, False, None),
    ("4110", "Product Sales", "Income", "Operating Income", False, False, None),
    ("4120", "Service Revenue", "Income", "Operating Income", False, False, None),
    ("4200", "Other Income", "Income", "Other Income", False, False, None),
    ("4210", "Interest Income", "Income", "Other Income", False, False, None),
    ("4220", "Gain on Asset Disposal", "Income", "Other Income", False, False, None),
    ("4230", "Miscellaneous Income", "Income", "Other Income", False, False, None),
    # EXPENSES
    ("5000", "Expenses", "Expense", None, True, False, None),
    ("5100", "Cost of Goods Sold", "Expense", "COGS", True, False, None),
    ("5110", "Purchases / COGS", "Expense", "COGS", True, False, None),
    ("5200", "Operating Expenses", "Expense", "Operating Expense", True, False, None),
    ("5210", "Salary & Wages", "Expense", "Operating Expense", True, False, None),
    ("5220", "Rent Expense", "Expense", "Operating Expense", False, False, None),
    ("5230", "Utilities", "Expense", "Operating Expense", False, False, None),
    ("5240", "Depreciation Expense", "Expense", "Operating Expense", True, False, None),
    ("5250", "Interest Expense", "Expense", "Operating Expense", False, False, None),
    ("5260", "Loss on Asset Disposal", "Expense", "Operating Expense", False, False, None),
    ("5270", "Travel & Conveyance", "Expense", "Operating Expense", False, False, None),
    ("5280", "Office Supplies", "Expense", "Operating Expense", False, False, None),
    ("5290", "Marketing & Advertising", "Expense", "Operating Expense", False, False, None),
    ("5300", "Tax Expenses", "Expense", "Tax Expense", False, False, None),
    ("5310", "Income Tax Expense", "Expense", "Tax Expense", False, False, None),
]

# Hierarchy mapping: code -> parent_code
PARENT_MAP = {
    "1100": "1000", "1200": "1000", "1300": "1000",
    "1110": "1100", "1120": "1100", "1130": "1100", "1140": "1100",
    "1150": "1100", "1160": "1100", "1170": "1100",
    "1210": "1200", "1220": "1200", "1230": "1200", "1240": "1200",
    "1250": "1200", "1290": "1200",
    "2100": "2000", "2200": "2000",
    "2110": "2100", "2120": "2100", "2130": "2100", "2140": "2100",
    "2150": "2100", "2160": "2100",
    "2210": "2200", "2220": "2200",
    "3100": "3000", "3200": "3000", "3300": "3000",
    "4100": "4000", "4200": "4000",
    "4110": "4100", "4120": "4100",
    "4210": "4200", "4220": "4200", "4230": "4200",
    "5100": "5000", "5200": "5000", "5300": "5000",
    "5110": "5100",
    "5210": "5200", "5220": "5200", "5230": "5200", "5240": "5200",
    "5250": "5200", "5260": "5200", "5270": "5200", "5280": "5200",
    "5290": "5200",
    "5310": "5300",
}


async def seed_default_coa(db: AsyncSession, vendor_id) -> None:
    """Create default COA for a vendor if not already seeded."""
    existing = await db.execute(
        select(FinAccount).where(FinAccount.vendor_id == vendor_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return  # Already seeded

    code_to_id = {}
    for code, name, acct_type, subtype, is_system, is_recon, recon_sub in DEFAULT_COA:
        acct = FinAccount(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            code=code,
            name=name,
            account_type=acct_type,
            account_subtype=subtype,
            is_system=is_system,
            is_active=True,
            is_reconciliation_account=is_recon,
            reconciliation_subledger=recon_sub,
        )
        code_to_id[code] = acct
        db.add(acct)

    await db.flush()

    # Set parent_ids
    for code, parent_code in PARENT_MAP.items():
        if code in code_to_id and parent_code in code_to_id:
            code_to_id[code].parent_id = code_to_id[parent_code].id

    await db.flush()


# Default Fixed Asset categories, mapped to the Fixed Asset GL accounts above.
# (name, fixed_asset_code, useful_life_years, depreciation_method, salvage_pct)
DEFAULT_ASSET_CATEGORIES = [
    ("Plant & Machinery", "1210", 10, "wdv", 5),
    ("Computers & Equipment", "1220", 3, "straight_line", 0),
    ("Furniture & Fixtures", "1230", 8, "straight_line", 5),
    ("Vehicles", "1240", 8, "wdv", 10),
    ("Land & Building", "1250", 30, "straight_line", 0),
]

ACCUM_DEP_CODE = "1290"
DEP_EXPENSE_CODE = "5240"


async def seed_default_asset_categories(db: AsyncSession, vendor_id) -> None:
    """
    Create default Fixed Asset categories mapped to the seeded Fixed Asset GL
    accounts. No-op if the vendor already has any categories, or if the COA
    hasn't been seeded yet (accounts not found).
    """
    existing = await db.execute(
        select(FinAssetCategory).where(FinAssetCategory.vendor_id == vendor_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return  # Already seeded

    r = await db.execute(select(FinAccount).where(FinAccount.vendor_id == vendor_id))
    accounts_by_code = {a.code: a for a in r.scalars().all()}
    accum_dep = accounts_by_code.get(ACCUM_DEP_CODE)
    dep_expense = accounts_by_code.get(DEP_EXPENSE_CODE)
    if not accounts_by_code:
        return  # COA not seeded yet — nothing to map categories to

    for name, fa_code, life, method, salvage_pct in DEFAULT_ASSET_CATEGORIES:
        asset_acc = accounts_by_code.get(fa_code)
        db.add(FinAssetCategory(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            name=name,
            depreciation_method=method,
            useful_life_years=life,
            salvage_pct=salvage_pct,
            asset_account_id=asset_acc.id if asset_acc else None,
            accum_dep_account_id=accum_dep.id if accum_dep else None,
            dep_expense_account_id=dep_expense.id if dep_expense else None,
        ))

    await db.flush()


async def seed_default_fiscal_year(db: AsyncSession, vendor_id) -> FinFiscalYear:
    """Create the current fiscal year (India: Apr–Mar) for the default company if missing."""
    company = await get_or_create_default_fin_company(db, vendor_id)
    r_any = await db.execute(
        select(FinFiscalYear)
        .join(
            FinFiscalYearCompany, FinFiscalYearCompany.fiscal_year_id == FinFiscalYear.id
        )
        .where(
            FinFiscalYear.vendor_id == vendor_id,
            FinFiscalYearCompany.company_id == company.id,
        )
        .order_by(FinFiscalYear.start_date.desc())
        .limit(1)
    )
    existing_fy = r_any.scalar_one_or_none()
    if existing_fy:
        return existing_fy

    today = date.today()
    # India fiscal year: Apr 1 – Mar 31
    fy_start_year = today.year if today.month >= 4 else today.year - 1
    fy_start = date(fy_start_year, 4, 1)
    fy_end = date(fy_start_year + 1, 3, 31)

    fy = FinFiscalYear(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        variant_code="MAIN",
        name=f"FY {fy_start_year}-{str(fy_start_year + 1)[2:]}",
        start_date=fy_start,
        end_date=fy_end,
        status="open",
    )
    db.add(fy)
    await db.flush()
    db.add(
        FinFiscalYearCompany(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            fiscal_year_id=fy.id,
            company_id=company.id,
            is_current=True,
        )
    )
    await db.flush()

    await build_standard_periods(db, vendor_id, fy)

    return fy
