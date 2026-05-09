"""
Seed product variants with barcodes + per-store inventory (full & low stock).
Covers: Clothing (Size×Color), Electronics (Storage×Color), Food (Pack size),
        Health/Beauty (Volume), Home/Kitchen (Capacity/Color).
"""
import asyncio, uuid, json, random
from datetime import datetime, timezone, date
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DB  = "postgresql+asyncpg://postgres:postgres@postgres:5432/kiterp"
VID = "97d013f9-4e28-49d1-9441-3587f2852c46"
# BLR = main/default store, MUM = branch
BLR = "0cb0b274-0c66-4c8f-83cb-943887fc5703"
MUM = "6ed3a272-75f6-43cd-ac0a-948604d62fad"

def uid():  return str(uuid.uuid4())
def now():  return datetime.now(timezone.utc)

def ean13(prefix="890"):
    d = prefix + "".join(str(random.randint(0,9)) for _ in range(9))
    odds  = sum(int(x) for x in d[::2])
    evens = sum(int(x) for x in d[1::2])
    chk   = (10 - ((odds + evens*3) % 10)) % 10
    return d + str(chk)

# ─────────────────────────────────────────────────────────────────────────────
# VARIANT DEFINITIONS
# Each entry: (product_sku, [list of variant dicts])
# variant dict keys:
#   name, sku, barcode, price, compare_at, cost, color, attributes,
#   qty_blr, qty_mum, low_threshold, is_on_sale, discount_pct
# ─────────────────────────────────────────────────────────────────────────────

random.seed(99)

VARIANTS_BY_SKU = {

    # ── Organic Cotton T-Shirt  (Size × Color) ────────────────────────────────
    "OCT-M-WHT": [
        # size=S
        {"name":"S / White",  "sku":"OCT-S-WHT", "color":"White", "price":899,  "cost":350, "compare_at":1199,
         "attrs":{"size":"S","color":"White"}, "qty_blr":45, "qty_mum":18, "thresh":8, "sale":False, "disc":0},
        {"name":"S / Black",  "sku":"OCT-S-BLK", "color":"Black", "price":899,  "cost":350, "compare_at":1199,
         "attrs":{"size":"S","color":"Black"}, "qty_blr":38, "qty_mum":12, "thresh":8, "sale":False, "disc":0},
        {"name":"S / Navy",   "sku":"OCT-S-NVY", "color":"Navy",  "price":899,  "cost":350, "compare_at":1199,
         "attrs":{"size":"S","color":"Navy"},  "qty_blr":3,  "qty_mum":2,  "thresh":8, "sale":False, "disc":0},  # LOW
        # size=M
        {"name":"M / White",  "sku":"OCT-M-WHT", "color":"White", "price":899,  "cost":350, "compare_at":1199,
         "attrs":{"size":"M","color":"White"}, "qty_blr":60, "qty_mum":25, "thresh":8, "sale":True,  "disc":10},
        {"name":"M / Black",  "sku":"OCT-M-BLK", "color":"Black", "price":899,  "cost":350, "compare_at":1199,
         "attrs":{"size":"M","color":"Black"}, "qty_blr":55, "qty_mum":20, "thresh":8, "sale":False, "disc":0},
        {"name":"M / Olive",  "sku":"OCT-M-OLV", "color":"Olive", "price":899,  "cost":350, "compare_at":1199,
         "attrs":{"size":"M","color":"Olive"}, "qty_blr":4,  "qty_mum":1,  "thresh":8, "sale":False, "disc":0},  # LOW
        # size=L
        {"name":"L / White",  "sku":"OCT-L-WHT", "color":"White", "price":949,  "cost":370, "compare_at":1299,
         "attrs":{"size":"L","color":"White"}, "qty_blr":42, "qty_mum":15, "thresh":8, "sale":False, "disc":0},
        {"name":"L / Black",  "sku":"OCT-L-BLK", "color":"Black", "price":949,  "cost":370, "compare_at":1299,
         "attrs":{"size":"L","color":"Black"}, "qty_blr":30, "qty_mum":10, "thresh":8, "sale":True,  "disc":15},
        # size=XL
        {"name":"XL / White", "sku":"OCT-XL-WHT","color":"White", "price":999,  "cost":390, "compare_at":1399,
         "attrs":{"size":"XL","color":"White"},"qty_blr":5,  "qty_mum":2,  "thresh":8, "sale":False, "disc":0},  # LOW
        {"name":"XL / Black", "sku":"OCT-XL-BLK","color":"Black", "price":999,  "cost":390, "compare_at":1399,
         "attrs":{"size":"XL","color":"Black"},"qty_blr":25, "qty_mum":8,  "thresh":8, "sale":False, "disc":0},
    ],

    # ── Premium Denim Jeans  (Waist × Color) ─────────────────────────────────
    "PDJ-32-BLU": [
        {"name":"28 / Blue",  "sku":"PDJ-28-BLU","color":"Blue",  "price":2299, "cost":900, "compare_at":2999,
         "attrs":{"waist":"28","color":"Blue"},  "qty_blr":22, "qty_mum":8,  "thresh":5, "sale":False, "disc":0},
        {"name":"28 / Black", "sku":"PDJ-28-BLK","color":"Black", "price":2299, "cost":900, "compare_at":2999,
         "attrs":{"waist":"28","color":"Black"}, "qty_blr":4,  "qty_mum":1,  "thresh":5, "sale":False, "disc":0},  # LOW
        {"name":"30 / Blue",  "sku":"PDJ-30-BLU","color":"Blue",  "price":2499, "cost":900, "compare_at":3199,
         "attrs":{"waist":"30","color":"Blue"},  "qty_blr":35, "qty_mum":12, "thresh":5, "sale":True,  "disc":10},
        {"name":"30 / Black", "sku":"PDJ-30-BLK","color":"Black", "price":2499, "cost":900, "compare_at":3199,
         "attrs":{"waist":"30","color":"Black"}, "qty_blr":28, "qty_mum":9,  "thresh":5, "sale":False, "disc":0},
        {"name":"32 / Blue",  "sku":"PDJ-32-BLU","color":"Blue",  "price":2499, "cost":900, "compare_at":3199,
         "attrs":{"waist":"32","color":"Blue"},  "qty_blr":40, "qty_mum":15, "thresh":5, "sale":False, "disc":0},
        {"name":"32 / Grey",  "sku":"PDJ-32-GRY","color":"Grey",  "price":2499, "cost":900, "compare_at":3199,
         "attrs":{"waist":"32","color":"Grey"},  "qty_blr":3,  "qty_mum":2,  "thresh":5, "sale":False, "disc":0},  # LOW
        {"name":"34 / Blue",  "sku":"PDJ-34-BLU","color":"Blue",  "price":2699, "cost":950, "compare_at":3499,
         "attrs":{"waist":"34","color":"Blue"},  "qty_blr":18, "qty_mum":6,  "thresh":5, "sale":False, "disc":0},
        {"name":"36 / Blue",  "sku":"PDJ-36-BLU","color":"Blue",  "price":2699, "cost":950, "compare_at":3499,
         "attrs":{"waist":"36","color":"Blue"},  "qty_blr":2,  "qty_mum":0,  "thresh":5, "sale":True,  "disc":20},  # LOW + SALE
    ],

    # ── Winter Jacket  (Size × Color) ────────────────────────────────────────
    "WJ-L-BLK": [
        {"name":"S / Black",     "sku":"WJ-S-BLK",  "color":"Black",  "price":4499, "cost":1800, "compare_at":5999,
         "attrs":{"size":"S","color":"Black"},  "qty_blr":20, "qty_mum":6,  "thresh":4, "sale":False, "disc":0},
        {"name":"M / Black",     "sku":"WJ-M-BLK",  "color":"Black",  "price":4499, "cost":1800, "compare_at":5999,
         "attrs":{"size":"M","color":"Black"},  "qty_blr":35, "qty_mum":12, "thresh":4, "sale":False, "disc":0},
        {"name":"M / Olive",     "sku":"WJ-M-OLV",  "color":"Olive",  "price":4999, "cost":2000, "compare_at":6499,
         "attrs":{"size":"M","color":"Olive"},  "qty_blr":3,  "qty_mum":1,  "thresh":4, "sale":False, "disc":0},  # LOW
        {"name":"L / Black",     "sku":"WJ-L-BLK",  "color":"Black",  "price":4999, "cost":2000, "compare_at":6499,
         "attrs":{"size":"L","color":"Black"},  "qty_blr":28, "qty_mum":10, "thresh":4, "sale":True,  "disc":12},
        {"name":"L / Navy",      "sku":"WJ-L-NVY",  "color":"Navy",   "price":4999, "cost":2000, "compare_at":6499,
         "attrs":{"size":"L","color":"Navy"},   "qty_blr":4,  "qty_mum":0,  "thresh":4, "sale":False, "disc":0},  # LOW
        {"name":"XL / Black",    "sku":"WJ-XL-BLK", "color":"Black",  "price":5499, "cost":2200, "compare_at":6999,
         "attrs":{"size":"XL","color":"Black"}, "qty_blr":15, "qty_mum":4,  "thresh":4, "sale":False, "disc":0},
    ],

    # ── iPhone 15 Pro  (Storage × Color) ─────────────────────────────────────
    "IPH15P-256": [
        {"name":"128GB / Natural Titanium", "sku":"IPH15P-128-NTI","color":"Natural Titanium","price":109900,"cost":88000,"compare_at":None,
         "attrs":{"storage":"128GB","color":"Natural Titanium"},"qty_blr":15,"qty_mum":5, "thresh":3,"sale":False,"disc":0},
        {"name":"256GB / Black Titanium",   "sku":"IPH15P-256-BTI","color":"Black Titanium",  "price":119900,"cost":95000,"compare_at":None,
         "attrs":{"storage":"256GB","color":"Black Titanium"},  "qty_blr":20,"qty_mum":7, "thresh":3,"sale":False,"disc":0},
        {"name":"256GB / White Titanium",   "sku":"IPH15P-256-WTI","color":"White Titanium",  "price":119900,"cost":95000,"compare_at":None,
         "attrs":{"storage":"256GB","color":"White Titanium"},  "qty_blr":2, "qty_mum":1, "thresh":3,"sale":False,"disc":0},  # LOW
        {"name":"512GB / Black Titanium",   "sku":"IPH15P-512-BTI","color":"Black Titanium",  "price":139900,"cost":112000,"compare_at":None,
         "attrs":{"storage":"512GB","color":"Black Titanium"},  "qty_blr":10,"qty_mum":4, "thresh":3,"sale":False,"disc":0},
        {"name":"512GB / Blue Titanium",    "sku":"IPH15P-512-BLTI","color":"Blue Titanium",  "price":139900,"cost":112000,"compare_at":None,
         "attrs":{"storage":"512GB","color":"Blue Titanium"},   "qty_blr":1, "qty_mum":0, "thresh":3,"sale":True, "disc":5},   # LOW + SALE
        {"name":"1TB / Natural Titanium",   "sku":"IPH15P-1T-NTI", "color":"Natural Titanium","price":159900,"cost":130000,"compare_at":None,
         "attrs":{"storage":"1TB","color":"Natural Titanium"},  "qty_blr":8, "qty_mum":2, "thresh":3,"sale":False,"disc":0},
    ],

    # ── Samsung Galaxy S24 Ultra  (Storage × Color) ───────────────────────────
    "SGS24U": [
        {"name":"256GB / Titanium Black",  "sku":"SGS24U-256-BLK","color":"Titanium Black", "price":124999,"cost":99000,"compare_at":None,
         "attrs":{"storage":"256GB","color":"Titanium Black"}, "qty_blr":18,"qty_mum":6, "thresh":3,"sale":False,"disc":0},
        {"name":"256GB / Titanium Grey",   "sku":"SGS24U-256-GRY","color":"Titanium Grey",  "price":124999,"cost":99000,"compare_at":None,
         "attrs":{"storage":"256GB","color":"Titanium Grey"},  "qty_blr":3, "qty_mum":1, "thresh":3,"sale":False,"disc":0},  # LOW
        {"name":"512GB / Titanium Black",  "sku":"SGS24U-512-BLK","color":"Titanium Black", "price":144999,"cost":116000,"compare_at":None,
         "attrs":{"storage":"512GB","color":"Titanium Black"}, "qty_blr":12,"qty_mum":4, "thresh":3,"sale":True, "disc":8},
        {"name":"1TB / Titanium Violet",   "sku":"SGS24U-1T-VIO", "color":"Titanium Violet","price":164999,"cost":135000,"compare_at":None,
         "attrs":{"storage":"1TB","color":"Titanium Violet"},  "qty_blr":2, "qty_mum":1, "thresh":3,"sale":False,"disc":0},  # LOW
    ],

    # ── Sony Headphones  (Color) ──────────────────────────────────────────────
    "SNYWH1000": [
        {"name":"Midnight Black", "sku":"SNYWH-BLK","color":"Black",  "price":29990,"cost":18000,"compare_at":34990,
         "attrs":{"color":"Midnight Black"}, "qty_blr":25,"qty_mum":10,"thresh":4,"sale":False,"disc":0},
        {"name":"Platinum Silver","sku":"SNYWH-SLV","color":"Silver", "price":29990,"cost":18000,"compare_at":34990,
         "attrs":{"color":"Platinum Silver"},"qty_blr":4, "qty_mum":1, "thresh":4,"sale":False,"disc":0},  # LOW
        {"name":"Midnight Blue",  "sku":"SNYWH-BLU","color":"Blue",   "price":31990,"cost":19000,"compare_at":36990,
         "attrs":{"color":"Midnight Blue"},  "qty_blr":15,"qty_mum":5, "thresh":4,"sale":True, "disc":10},
    ],

    # ── Dell XPS 15  (RAM × Storage) ─────────────────────────────────────────
    "DELLXPS15": [
        {"name":"16GB / 512GB SSD", "sku":"DELL-16-512","color":"Silver","price":174990,"cost":140000,"compare_at":None,
         "attrs":{"ram":"16GB","storage":"512GB SSD"},"qty_blr":8, "qty_mum":3,"thresh":2,"sale":False,"disc":0},
        {"name":"16GB / 1TB SSD",   "sku":"DELL-16-1T", "color":"Silver","price":189990,"cost":152000,"compare_at":None,
         "attrs":{"ram":"16GB","storage":"1TB SSD"},  "qty_blr":1, "qty_mum":0,"thresh":2,"sale":False,"disc":0},  # LOW
        {"name":"32GB / 1TB SSD",   "sku":"DELL-32-1T", "color":"Platinum","price":219990,"cost":178000,"compare_at":None,
         "attrs":{"ram":"32GB","storage":"1TB SSD"},  "qty_blr":6, "qty_mum":2,"thresh":2,"sale":True, "disc":7},
        {"name":"64GB / 2TB SSD",   "sku":"DELL-64-2T", "color":"Platinum","price":279990,"cost":225000,"compare_at":None,
         "attrs":{"ram":"64GB","storage":"2TB SSD"},  "qty_blr":2, "qty_mum":1,"thresh":2,"sale":False,"disc":0},  # LOW
    ],

    # ── Basmati Rice  (Pack size) ─────────────────────────────────────────────
    "RICE-BAS-5K": [
        {"name":"1 kg",  "sku":"RICE-BAS-1K", "color":None,"price":139,  "cost":70,  "compare_at":159,
         "attrs":{"weight":"1kg"},  "qty_blr":120,"qty_mum":60,"thresh":20,"sale":False,"disc":0},
        {"name":"5 kg",  "sku":"RICE-BAS-5K", "color":None,"price":599,  "cost":320, "compare_at":699,
         "attrs":{"weight":"5kg"},  "qty_blr":80, "qty_mum":35,"thresh":15,"sale":True, "disc":10},
        {"name":"10 kg", "sku":"RICE-BAS-10K","color":None,"price":1099, "cost":600, "compare_at":1299,
         "attrs":{"weight":"10kg"}, "qty_blr":4,  "qty_mum":2, "thresh":10,"sale":False,"disc":0},  # LOW
        {"name":"25 kg", "sku":"RICE-BAS-25K","color":None,"price":2499, "cost":1400,"compare_at":None,
         "attrs":{"weight":"25kg"}, "qty_blr":2,  "qty_mum":1, "thresh":5, "sale":False,"disc":0},  # LOW
    ],

    # ── Olive Oil  (Volume) ───────────────────────────────────────────────────
    "OO-CP-1L": [
        {"name":"250 ml","sku":"OO-CP-250","color":None,"price":299, "cost":150,"compare_at":349,
         "attrs":{"volume":"250ml"}, "qty_blr":55,"qty_mum":25,"thresh":10,"sale":False,"disc":0},
        {"name":"500 ml","sku":"OO-CP-500","color":None,"price":549, "cost":280,"compare_at":649,
         "attrs":{"volume":"500ml"}, "qty_blr":40,"qty_mum":18,"thresh":10,"sale":True, "disc":8},
        {"name":"1 L",   "sku":"OO-CP-1L", "color":None,"price":899, "cost":550,"compare_at":1099,
         "attrs":{"volume":"1L"},    "qty_blr":4, "qty_mum":2, "thresh":8, "sale":False,"disc":0},  # LOW
        {"name":"2 L",   "sku":"OO-CP-2L", "color":None,"price":1699,"cost":1050,"compare_at":1999,
         "attrs":{"volume":"2L"},    "qty_blr":20,"qty_mum":8, "thresh":5, "sale":False,"disc":0},
    ],

    # ── Green Tea  (Quantity) ─────────────────────────────────────────────────
    "GT-100B": [
        {"name":"25 bags", "sku":"GT-25B", "color":None,"price":99,  "cost":40, "compare_at":129,
         "attrs":{"count":"25 bags"},  "qty_blr":90,"qty_mum":40,"thresh":15,"sale":False,"disc":0},
        {"name":"50 bags", "sku":"GT-50B", "color":None,"price":199, "cost":80, "compare_at":249,
         "attrs":{"count":"50 bags"},  "qty_blr":65,"qty_mum":28,"thresh":15,"sale":True, "disc":10},
        {"name":"100 bags","sku":"GT-100B","color":None,"price":299, "cost":120,"compare_at":369,
         "attrs":{"count":"100 bags"}, "qty_blr":4, "qty_mum":3, "thresh":10,"sale":False,"disc":0},  # LOW
        {"name":"250 bags","sku":"GT-250B","color":None,"price":699, "cost":280,"compare_at":None,
         "attrs":{"count":"250 bags"}, "qty_blr":2, "qty_mum":1, "thresh":5, "sale":False,"disc":0},  # LOW
    ],

    # ── Face Moisturizer  (SPF × Size) ───────────────────────────────────────
    "FM-SPF50": [
        {"name":"SPF15 / 50ml", "sku":"FM-SPF15-50","color":None,"price":599, "cost":250,"compare_at":799,
         "attrs":{"spf":"SPF15","size":"50ml"}, "qty_blr":30,"qty_mum":12,"thresh":8,"sale":False,"disc":0},
        {"name":"SPF30 / 50ml", "sku":"FM-SPF30-50","color":None,"price":749, "cost":320,"compare_at":999,
         "attrs":{"spf":"SPF30","size":"50ml"}, "qty_blr":3, "qty_mum":1, "thresh":8,"sale":False,"disc":0},  # LOW
        {"name":"SPF50 / 50ml", "sku":"FM-SPF50-50","color":None,"price":899, "cost":350,"compare_at":1199,
         "attrs":{"spf":"SPF50","size":"50ml"}, "qty_blr":45,"qty_mum":18,"thresh":8,"sale":True, "disc":15},
        {"name":"SPF50 / 100ml","sku":"FM-SPF50-100","color":None,"price":1499,"cost":600,"compare_at":1999,
         "attrs":{"spf":"SPF50","size":"100ml"},"qty_blr":2, "qty_mum":0, "thresh":5,"sale":False,"disc":0},  # LOW
    ],

    # ── Vitamin C Serum  (Volume × Concentration) ─────────────────────────────
    "VCS-30ML": [
        {"name":"10% / 15ml","sku":"VCS-10-15","color":None,"price":699, "cost":280,"compare_at":999,
         "attrs":{"concentration":"10%","size":"15ml"},"qty_blr":35,"qty_mum":14,"thresh":8,"sale":False,"disc":0},
        {"name":"20% / 30ml","sku":"VCS-20-30","color":None,"price":1299,"cost":500,"compare_at":1699,
         "attrs":{"concentration":"20%","size":"30ml"},"qty_blr":4, "qty_mum":1, "thresh":8,"sale":True, "disc":10},  # LOW
        {"name":"20% / 60ml","sku":"VCS-20-60","color":None,"price":2299,"cost":900,"compare_at":2999,
         "attrs":{"concentration":"20%","size":"60ml"},"qty_blr":20,"qty_mum":8, "thresh":5,"sale":False,"disc":0},
        {"name":"30% / 30ml","sku":"VCS-30-30","color":None,"price":1799,"cost":700,"compare_at":2199,
         "attrs":{"concentration":"30%","size":"30ml"},"qty_blr":2, "qty_mum":1, "thresh":5,"sale":False,"disc":0},  # LOW
    ],

    # ── Yoga Mat  (Color × Thickness) ────────────────────────────────────────
    "YM-PRE-PRP": [
        {"name":"4mm / Purple", "sku":"YM-4-PRP","color":"Purple","price":1499,"cost":600,"compare_at":1999,
         "attrs":{"thickness":"4mm","color":"Purple"},"qty_blr":20,"qty_mum":8, "thresh":5,"sale":True, "disc":10},
        {"name":"6mm / Purple", "sku":"YM-6-PRP","color":"Purple","price":1999,"cost":800,"compare_at":2499,
         "attrs":{"thickness":"6mm","color":"Purple"},"qty_blr":4, "qty_mum":2, "thresh":5,"sale":False,"disc":0},  # LOW
        {"name":"6mm / Black",  "sku":"YM-6-BLK","color":"Black", "price":1999,"cost":800,"compare_at":2499,
         "attrs":{"thickness":"6mm","color":"Black"}, "qty_blr":18,"qty_mum":7, "thresh":5,"sale":False,"disc":0},
        {"name":"6mm / Blue",   "sku":"YM-6-BLU","color":"Blue",  "price":1999,"cost":800,"compare_at":2499,
         "attrs":{"thickness":"6mm","color":"Blue"},  "qty_blr":2, "qty_mum":1, "thresh":5,"sale":False,"disc":0},  # LOW
        {"name":"8mm / Black",  "sku":"YM-8-BLK","color":"Black", "price":2499,"cost":1000,"compare_at":3199,
         "attrs":{"thickness":"8mm","color":"Black"}, "qty_blr":12,"qty_mum":4, "thresh":4,"sale":False,"disc":0},
    ],

    # ── Air Fryer  (Capacity × Color) ─────────────────────────────────────────
    "AF-4L-BLK": [
        {"name":"2L / Black",   "sku":"AF-2L-BLK","color":"Black","price":2999,"cost":1600,"compare_at":3999,
         "attrs":{"capacity":"2L","color":"Black"},  "qty_blr":30,"qty_mum":12,"thresh":5,"sale":False,"disc":0},
        {"name":"4.5L / Black", "sku":"AF-4L-BLK","color":"Black","price":4999,"cost":2800,"compare_at":6499,
         "attrs":{"capacity":"4.5L","color":"Black"},"qty_blr":3, "qty_mum":0, "thresh":5,"sale":True, "disc":15},  # LOW + SALE
        {"name":"4.5L / White", "sku":"AF-4L-WHT","color":"White","price":4999,"cost":2800,"compare_at":6499,
         "attrs":{"capacity":"4.5L","color":"White"},"qty_blr":20,"qty_mum":8, "thresh":5,"sale":False,"disc":0},
        {"name":"6L / Black",   "sku":"AF-6L-BLK","color":"Black","price":6999,"cost":4000,"compare_at":8999,
         "attrs":{"capacity":"6L","color":"Black"},  "qty_blr":2, "qty_mum":1, "thresh":4,"sale":False,"disc":0},  # LOW
    ],

    # ── Pressure Cooker  (Capacity) ───────────────────────────────────────────
    "PC-5L-SS": [
        {"name":"2L Stainless Steel","sku":"PC-2L-SS","color":None,"price":1299,"cost":600,"compare_at":1699,
         "attrs":{"capacity":"2L"},"qty_blr":25,"qty_mum":10,"thresh":5,"sale":False,"disc":0},
        {"name":"3L Stainless Steel","sku":"PC-3L-SS","color":None,"price":1799,"cost":800,"compare_at":2299,
         "attrs":{"capacity":"3L"},"qty_blr":3, "qty_mum":1, "thresh":5,"sale":False,"disc":0},  # LOW
        {"name":"5L Stainless Steel","sku":"PC-5L-SS","color":None,"price":2499,"cost":1200,"compare_at":2999,
         "attrs":{"capacity":"5L"},"qty_blr":20,"qty_mum":8, "thresh":5,"sale":True, "disc":12},
        {"name":"7L Stainless Steel","sku":"PC-7L-SS","color":None,"price":3299,"cost":1600,"compare_at":None,
         "attrs":{"capacity":"7L"},"qty_blr":2, "qty_mum":1, "thresh":3,"sale":False,"disc":0},  # LOW
    ],
}


async def run():
    engine = create_async_engine(DB)
    async with engine.begin() as c:

        # Delete existing variants for clean run
        await c.execute(text("""
            DELETE FROM store_inventory WHERE variant_id IS NOT NULL AND vendor_id = :v
        """), {"v": VID})
        await c.execute(text("""
            DELETE FROM product_variant WHERE product_id IN (
                SELECT id FROM product WHERE vendor_id = :v
            )
        """), {"v": VID})
        print("  Cleared existing variants & variant store inventory\n")

        # Get product map: sku → (id, price)
        rows = (await c.execute(text(
            "SELECT id, sku, price FROM product WHERE vendor_id = :v"
        ), {"v": VID})).fetchall()
        prod_map = {row[1]: (str(row[0]), float(row[2])) for row in rows}

        total_variants = 0
        total_low_blr  = 0
        total_low_mum  = 0

        for prod_sku, variants in VARIANTS_BY_SKU.items():
            if prod_sku not in prod_map:
                print(f"  ⚠ Product SKU {prod_sku} not found, skipping")
                continue

            product_id, base_price = prod_map[prod_sku]
            print(f"  📦 {prod_sku} → {len(variants)} variants")

            for v in variants:
                var_id  = uid()
                barcode = ean13()
                price   = v["price"]
                disc_pct = v["disc"]
                disc_amt = round(price * disc_pct / 100, 2) if disc_pct else None

                await c.execute(text("""
                    INSERT INTO product_variant (
                        id, product_id, name, sku, barcode, price,
                        compare_at_price, cost_price, quantity,
                        color, attributes, is_active,
                        is_on_sale, discount_percentage, discount_amount,
                        low_stock_threshold, stock_status,
                        track_inventory, is_taxable,
                        created_at, updated_at
                    ) VALUES (
                        :id, :pid, :name, :sku, :bc, :price,
                        :compare, :cost, :qty_total,
                        :color, cast(:attrs as jsonb), true,
                        :on_sale, :disc_pct, :disc_amt,
                        :thresh,
                        CASE WHEN :qty_total = 0 THEN 'out_of_stock'
                             WHEN :qty_total <= :thresh THEN 'low_stock'
                             ELSE 'in_stock' END,
                        true, true,
                        now(), now()
                    )
                """), {
                    "id": var_id, "pid": product_id, "name": v["name"],
                    "sku": v["sku"], "bc": barcode, "price": price,
                    "compare": v["compare_at"], "cost": v["cost"],
                    "qty_total": v["qty_blr"] + v["qty_mum"],
                    "color": v["color"],
                    "attrs": json.dumps(v["attrs"]),
                    "on_sale": v["sale"],
                    "disc_pct": disc_pct if disc_pct else None,
                    "disc_amt": disc_amt,
                    "thresh": v["thresh"],
                })

                # Store inventory — BLR
                await c.execute(text("""
                    INSERT INTO store_inventory (id, store_id, vendor_id, product_id, variant_id, quantity, low_stock_threshold, updated_at)
                    VALUES (:id, :sid, :vid, :pid, :varid, :qty, :thresh, now())
                """), {"id": uid(), "sid": BLR, "vid": VID, "pid": product_id,
                       "varid": var_id, "qty": v["qty_blr"], "thresh": v["thresh"]})

                # Store inventory — MUM
                await c.execute(text("""
                    INSERT INTO store_inventory (id, store_id, vendor_id, product_id, variant_id, quantity, low_stock_threshold, updated_at)
                    VALUES (:id, :sid, :vid, :pid, :varid, :qty, :thresh, now())
                """), {"id": uid(), "sid": MUM, "vid": VID, "pid": product_id,
                       "varid": var_id, "qty": v["qty_mum"], "thresh": v["thresh"]})

                if v["qty_blr"] <= v["thresh"]:
                    total_low_blr += 1
                if v["qty_mum"] <= v["thresh"]:
                    total_low_mum += 1

                total_variants += 1

        # Print summary
        print(f"""
╔══════════════════════════════════════════════╗
║           VARIANT SEED COMPLETE              ║
╠══════════════════════════════════════════════╣
║  Total variants created   : {total_variants:<16} ║
║  Products with variants   : {len(VARIANTS_BY_SKU):<16} ║
║                                              ║
║  Bangalore store                             ║
║    Low-stock variants     : {total_low_blr:<16} ║
║                                              ║
║  Mumbai store                                ║
║    Low-stock variants     : {total_low_mum:<16} ║
╚══════════════════════════════════════════════╝
        """)

asyncio.run(run())
