"""
Pure GST helpers (no database access) so the rules are unit-testable:

  * state-code normalisation (place of supply must be the 2-digit GST state code)
  * B2CL threshold by date
  * invoice line -> rate-wise tax lines
  * ITC set-off per Sections 49 / 49A / 49B of the CGST Act
  * GSTN-format GSTR-1 JSON builder
"""
from __future__ import annotations

import re
from collections import OrderedDict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable, Optional

TWO = Decimal("0.01")


def D(v: Any) -> Decimal:
    if v is None or v == "":
        return Decimal("0")
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal("0")


def q2(v: Any) -> Decimal:
    return D(v).quantize(TWO, rounding=ROUND_HALF_UP)


# ── State codes ──────────────────────────────────────────────────────────────

STATE_CODES: dict[str, str] = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
    "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
    "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
    "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
}

_ALIASES = {
    "jammu & kashmir": "01", "j&k": "01", "jk": "01", "hp": "02", "pb": "03", "ch": "04",
    "uk": "05", "uttaranchal": "05", "hr": "06", "dl": "07", "nct of delhi": "07", "new delhi": "07",
    "rj": "08", "up": "09", "br": "10", "sk": "11", "ar": "12", "nl": "13", "mn": "14",
    "mz": "15", "tr": "16", "ml": "17", "as": "18", "wb": "19", "jh": "20", "od": "21",
    "or": "21", "orissa": "21", "cg": "22", "chattisgarh": "22", "mp": "23", "gj": "24",
    "dadra and nagar haveli": "26", "daman and diu": "25", "dnhdd": "26", "dd": "26", "dn": "26",
    "mh": "27", "ka": "29", "ga": "30", "ld": "31", "kl": "32", "tn": "33", "py": "34",
    "pondicherry": "34", "an": "35", "andaman & nicobar islands": "35", "ts": "36", "tg": "36",
    "ap": "37", "la": "38",
}
_NAME_TO_CODE = {re.sub(r"\s+", " ", v.lower().replace("&", "and")): k for k, v in STATE_CODES.items()}
_NAME_TO_CODE["daman and diu"] = "26"


def normalize_state_code(value: Optional[str], gstin: Optional[str] = None) -> Optional[str]:
    """
    Return the 2-digit GST state code for free-text place of supply ("Maharashtra",
    "27-Maharashtra", "MH", "27"); fall back to the GSTIN prefix. None if unknown.
    """
    v = (value or "").strip()
    if v:
        m = re.match(r"^(\d{1,2})\b", v)
        if m:
            code = m.group(1).zfill(2)
            if code in STATE_CODES or code == "25":
                return "26" if code == "25" else code
        key = re.sub(r"\s+", " ", v.lower().replace("&", "and")).strip(" .")
        key = re.sub(r"^\d{1,2}\s*[-–:]\s*", "", key)
        if key in _NAME_TO_CODE:
            return _NAME_TO_CODE[key]
        raw = v.lower().strip(" .")
        if raw in _ALIASES:
            c = _ALIASES[raw]
            return "26" if c == "25" else c
        if key in _ALIASES:
            c = _ALIASES[key]
            return "26" if c == "25" else c
    g = (gstin or "").strip()
    if len(g) >= 2 and g[:2].isdigit() and g[:2] in STATE_CODES:
        return g[:2]
    return None


def gstin_state(gstin: Optional[str]) -> Optional[str]:
    g = (gstin or "").strip()
    return g[:2] if len(g) >= 2 and g[:2] in STATE_CODES else None


# ── B2CL threshold ───────────────────────────────────────────────────────────

B2CL_CHANGE_DATE = date(2024, 8, 1)       # Notification 12/2024-CT


def b2cl_threshold(invoice_date: date) -> Decimal:
    """Inter-state B2C invoices above this value are reported invoice-wise (B2CL)."""
    return Decimal("100000") if invoice_date >= B2CL_CHANGE_DATE else Decimal("250000")


# ── Line items → rate-wise tax lines ─────────────────────────────────────────

def _get(it: Any, *names: str, default: Any = None) -> Any:
    for n in names:
        if isinstance(it, dict):
            if n in it and it[n] not in (None, ""):
                return it[n]
        else:
            v = getattr(it, n, None)
            if v not in (None, ""):
                return v
    return default


def line_tax(it: Any) -> dict:
    """Normalise one invoice line (dict or object) into taxable/tax components."""
    taxable = D(_get(it, "taxable_value", "taxable_amount", "taxable", "subtotal", default=0))
    cgst = D(_get(it, "cgst_amt", "cgst_amount", "cgst", default=0))
    sgst = D(_get(it, "sgst_amt", "sgst_amount", "sgst", default=0))
    igst = D(_get(it, "igst_amt", "igst_amount", "igst", default=0))
    cess = D(_get(it, "cess_amt", "cess_amount", "cess", default=0))
    rate = D(_get(it, "tax_rate", "gst_rate", "rate_pct", default=0))
    if rate == 0 and taxable > 0 and (cgst + sgst + igst) > 0:
        rate = ((cgst + sgst + igst) / taxable * 100).quantize(Decimal("0.01"))
    return {
        "hsn": str(_get(it, "hsn_sac", "hsn", "hsn_code", default="") or "")[:8],
        "qty": D(_get(it, "qty", "quantity", default=1)),
        "uqc": str(_get(it, "uqc", "unit", default="OTH") or "OTH").upper()[:3],
        "desc": str(_get(it, "name", "description", default="") or "")[:30],
        "rate": rate, "taxable": taxable, "cgst": cgst, "sgst": sgst, "igst": igst, "cess": cess,
    }


def rate_lines(items: Iterable[Any]) -> list[dict]:
    """Group invoice lines by GST rate (GSTN reports tax per rate)."""
    out: "OrderedDict[Decimal, dict]" = OrderedDict()
    for it in items or []:
        ln = line_tax(it)
        k = ln["rate"]
        row = out.setdefault(k, {"rate": k, "taxable": Decimal("0"), "cgst": Decimal("0"),
                                 "sgst": Decimal("0"), "igst": Decimal("0"), "cess": Decimal("0")})
        for f in ("taxable", "cgst", "sgst", "igst", "cess"):
            row[f] += ln[f]
    return list(out.values())


# ── ITC set-off (Sections 49, 49A, 49B CGST Act) ─────────────────────────────

def gst_setoff(liability: dict, itc: dict) -> dict:
    """
    Utilise input tax credit against output liability in the prescribed order:

      IGST credit -> IGST, then CGST, then SGST
      CGST credit -> CGST, then IGST   (never SGST)
      SGST credit -> SGST, then IGST   (never CGST)

    Returns {"payable": {igst,cgst,sgst}, "itc_carry_forward": {igst,cgst,sgst}} (Decimals).
    """
    liab = {h: D(liability.get(h, 0)) for h in ("igst", "cgst", "sgst")}
    cr = {h: D(itc.get(h, 0)) for h in ("igst", "cgst", "sgst")}

    def use(credit_head: str, liab_head: str) -> None:
        amt = min(cr[credit_head], liab[liab_head])
        if amt > 0:
            cr[credit_head] -= amt
            liab[liab_head] -= amt

    for head in ("igst", "cgst", "sgst"):
        use("igst", head)
    use("cgst", "cgst"); use("cgst", "igst")
    use("sgst", "sgst"); use("sgst", "igst")
    return {
        "payable": {h: q2(v) for h, v in liab.items()},
        "itc_carry_forward": {h: q2(v) for h, v in cr.items()},
    }


def infer_itc_split(tax: Decimal, supplier_gstin: Optional[str], recipient_gstin: Optional[str]) -> dict:
    """
    Split a bill's tax into IGST vs CGST+SGST when the bill has no explicit split:
    different supplier/recipient state -> IGST, same state -> 50/50 CGST/SGST.
    """
    tax = D(tax)
    s, r = gstin_state(supplier_gstin), gstin_state(recipient_gstin)
    if s and r and s != r:
        return {"igst": tax, "cgst": Decimal("0"), "sgst": Decimal("0")}
    half = (tax / 2).quantize(TWO, rounding=ROUND_HALF_UP)
    return {"igst": Decimal("0"), "cgst": half, "sgst": tax - half}


# ── GSTN GSTR-1 JSON ─────────────────────────────────────────────────────────

def _idt(d: Any) -> str:
    if isinstance(d, str):
        d = date.fromisoformat(d[:10])
    return d.strftime("%d-%m-%Y")


def _itms(rlines: list[dict]) -> list[dict]:
    out = []
    for i, ln in enumerate(rlines or [], start=1):
        det = {"rt": float(ln["rate"]), "txval": float(q2(ln["taxable"])),
               "iamt": float(q2(ln["igst"])), "camt": float(q2(ln["cgst"])),
               "samt": float(q2(ln["sgst"])), "csamt": float(q2(ln.get("cess", 0)))}
        out.append({"num": i, "itm_det": det})
    return out


def build_gstr1_json(gstin: str, period_start: date, data: dict) -> dict:
    """
    Build the GSTN offline-tool JSON for GSTR-1 from ``FinTaxRepo.compute_gstr1`` output.
    Sections: b2b, b2cl, b2cs, cdnr, cdnur, hsn, doc_issue-free minimal set.
    """
    fp = period_start.strftime("%m%Y")

    # b2b grouped by recipient GSTIN
    b2b: "OrderedDict[str, list]" = OrderedDict()
    for r in data.get("b2b", []):
        b2b.setdefault(r["customer_gstin"], []).append({
            "inum": r["invoice_number"], "idt": _idt(r["invoice_date"]),
            "val": float(q2(r["total"])), "pos": r.get("pos_code") or "99",
            "rchrg": "N", "inv_typ": "R", "itms": _itms(r.get("rate_lines", [])),
        })

    # b2cl grouped by place of supply
    b2cl: "OrderedDict[str, list]" = OrderedDict()
    for r in data.get("b2cl", []):
        b2cl.setdefault(r.get("pos_code") or "99", []).append({
            "inum": r["invoice_number"], "idt": _idt(r["invoice_date"]),
            "val": float(q2(r["total"])), "itms": _itms(r.get("rate_lines", [])),
        })

    b2cs = [{
        "sply_ty": r["sply_ty"], "pos": r.get("pos_code") or "99", "typ": "OE",
        "rt": float(r["rate"]), "txval": float(q2(r["taxable"])),
        "iamt": float(q2(r["igst"])), "camt": float(q2(r["cgst"])),
        "samt": float(q2(r["sgst"])), "csamt": float(q2(r.get("cess", 0))),
    } for r in data.get("b2cs", [])]

    cdnr: "OrderedDict[str, list]" = OrderedDict()
    for r in data.get("b2b_cdns", []):
        cdnr.setdefault(r["customer_gstin"], []).append({
            "ntty": "C", "nt_num": r["invoice_number"], "nt_dt": _idt(r["invoice_date"]),
            "val": float(q2(r["total"])), "pos": r.get("pos_code") or "99",
            "rchrg": "N", "inv_typ": "R", "itms": _itms(r.get("rate_lines", [])),
        })
    cdnur = [{
        "typ": "B2CL", "ntty": "C", "nt_num": r["invoice_number"], "nt_dt": _idt(r["invoice_date"]),
        "val": float(q2(r["total"])), "pos": r.get("pos_code") or "99", "itms": _itms(r.get("rate_lines", [])),
    } for r in data.get("b2cs_cdns", []) if r.get("report_in_cdnur")]

    hsn = []
    for i, h in enumerate(data.get("hsn_summary", []), start=1):
        hsn.append({
            "num": i, "hsn_sc": h["hsn_sac"], "desc": h.get("desc", ""), "uqc": h.get("uqc", "OTH"),
            "rt": float(h.get("rate", 0)),
            "qty": float(h["quantity"]), "val": float(q2(h.get("total_value", 0))),
            "txval": float(q2(h["taxable_value"])), "iamt": float(q2(h["igst"])),
            "camt": float(q2(h["cgst"])), "samt": float(q2(h["sgst"])),
            "csamt": float(q2(h.get("cess", 0))),
        })

    out: dict = {"gstin": gstin, "fp": fp, "version": "GST3.1.6"}
    if b2b:
        out["b2b"] = [{"ctin": k, "inv": v} for k, v in b2b.items()]
    if b2cl:
        out["b2cl"] = [{"pos": k, "inv": v} for k, v in b2cl.items()]
    if b2cs:
        out["b2cs"] = b2cs
    if cdnr:
        out["cdnr"] = [{"ctin": k, "nt": v} for k, v in cdnr.items()]
    if cdnur:
        out["cdnur"] = cdnur
    if hsn:
        out["hsn"] = {"data": hsn}
    return out
