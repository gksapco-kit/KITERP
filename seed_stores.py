"""
Seed 2 stores with barcodes on all products and per-store inventory.
Run inside backend container:
  python /tmp/seed_stores.py
"""
import asyncio, uuid, json, random
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DB = "postgresql+asyncpg://postgres:postgres@postgres:5432/kiterp"

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc)

# ── EAN-13 barcode generator ──────────────────────────────────────────────────
def make_ean13(prefix: str = "890") -> str:
    """Generate a valid EAN-13 barcode with check digit."""
    digits = prefix + "".join(str(random.randint(0, 9)) for _ in range(9))
    odds  = sum(int(d) for d in digits[::2])
    evens = sum(int(d) for d in digits[1::2])
    check = (10 - ((odds + evens * 3) % 10)) % 10
    return digits + str(check)

async def run():
    engine = create_async_engine(DB)
    async with engine.begin() as c:

        # ── Get vendor ────────────────────────────────────────────────────────
        row = (await c.execute(text("SELECT id FROM vendor LIMIT 1"))).fetchone()
        if not row:
            print("No vendor found"); return
        vendor_id = str(row[0])
        print(f"Vendor: {vendor_id}")

        # ── Wipe existing stores (clean slate) ────────────────────────────────
        await c.execute(text("DELETE FROM store_inventory WHERE vendor_id = :v"), {"v": vendor_id})
        await c.execute(text("DELETE FROM store WHERE vendor_id = :v"), {"v": vendor_id})
        print("  Cleared old stores & store inventory")

        # ── Create 2 stores ───────────────────────────────────────────────────
        store1_id = uid()
        store2_id = uid()

        stores = [
            {
                "id": store1_id,
                "name": "Main Store — Bangalore",
                "code": "BLR-01",
                "description": "Primary flagship store located at Indiranagar, Bangalore",
                "phone": "080-41234567",
                "email": "bangalore@gvkrishna.store",
                "address": json.dumps({
                    "street": "100 Feet Road, Indiranagar",
                    "city": "Bangalore",
                    "state": "Karnataka",
                    "pincode": "560038",
                    "country": "India"
                }),
                "is_default": True,
                "is_active": True,
            },
            {
                "id": store2_id,
                "name": "Branch Store — Mumbai",
                "code": "MUM-01",
                "description": "Mumbai satellite store at Andheri West",
                "phone": "022-26789012",
                "email": "mumbai@gvkrishna.store",
                "address": json.dumps({
                    "street": "Veera Desai Road, Andheri West",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400058",
                    "country": "India"
                }),
                "is_default": False,
                "is_active": True,
            },
        ]

        for s in stores:
            await c.execute(text("""
                INSERT INTO store (id, vendor_id, name, code, description, phone, email,
                    address, is_default, is_active, settings, created_at, updated_at)
                VALUES (:id, :vid, :name, :code, :desc, :phone, :email,
                    cast(:addr as jsonb), :is_default, :is_active, '{}', now(), now())
                ON CONFLICT DO NOTHING
            """), {
                "id": s["id"], "vid": vendor_id, "name": s["name"], "code": s["code"],
                "desc": s["description"], "phone": s["phone"], "email": s["email"],
                "addr": s["address"], "is_default": s["is_default"], "is_active": s["is_active"],
            })
        print(f"  ✓ Created 2 stores: {stores[0]['name']}, {stores[1]['name']}")

        # ── Fetch all products ────────────────────────────────────────────────
        products = (await c.execute(text(
            "SELECT id, name, sku FROM product WHERE vendor_id = :v ORDER BY name"
        ), {"v": vendor_id})).fetchall()
        print(f"  Found {len(products)} products — assigning barcodes...")

        # ── Define per-product barcode + per-store quantities ─────────────────
        # Each product gets:
        #   - A unique EAN-13 barcode
        #   - Stock in Store 1 (main — higher qty, flagship)
        #   - Stock in Store 2 (branch — lower qty)

        random.seed(42)  # reproducible

        store1_skus = []
        store2_skus = []

        for prod in products:
            prod_id   = str(prod[0])
            prod_name = prod[1]
            sku       = prod[2]

            barcode   = make_ean13()
            qty1      = random.randint(15, 80)   # main store — more stock
            qty2      = random.randint(3, 30)    # branch — less stock
            low_stock = 5

            # Update barcode on product
            await c.execute(text(
                "UPDATE product SET barcode = :bc WHERE id = :id"
            ), {"bc": barcode, "id": prod_id})

            # Store 1 inventory
            inv1_id = uid()
            await c.execute(text("""
                INSERT INTO store_inventory (id, store_id, vendor_id, product_id, quantity, low_stock_threshold, updated_at)
                VALUES (:id, :sid, :vid, :pid, :qty, :lst, now())
                ON CONFLICT DO NOTHING
            """), {"id": inv1_id, "sid": store1_id, "vid": vendor_id, "pid": prod_id, "qty": qty1, "lst": low_stock})

            # Store 2 inventory
            inv2_id = uid()
            await c.execute(text("""
                INSERT INTO store_inventory (id, store_id, vendor_id, product_id, quantity, low_stock_threshold, updated_at)
                VALUES (:id, :sid, :vid, :pid, :qty, :lst, now())
                ON CONFLICT DO NOTHING
            """), {"id": inv2_id, "sid": store2_id, "vid": vendor_id, "pid": prod_id, "qty": qty2, "lst": low_stock})

            store1_skus.append((prod_name, sku, barcode, qty1))
            store2_skus.append((prod_name, sku, barcode, qty2))

        print(f"\n  ✓ All products barcoded + inventory seeded\n")

        # ── Pretty summary ────────────────────────────────────────────────────
        print("=" * 72)
        print(f"  🏪  {stores[0]['name']}  ({stores[0]['code']})")
        print("=" * 72)
        print(f"  {'Product':<30} {'SKU':<14} {'Barcode':<14} {'Qty':>5}")
        print(f"  {'-'*30} {'-'*14} {'-'*14} {'-'*5}")
        for name, sku, bc, qty in store1_skus:
            print(f"  {name:<30} {sku:<14} {bc:<14} {qty:>5}")

        print()
        print("=" * 72)
        print(f"  🏪  {stores[1]['name']}  ({stores[1]['code']})")
        print("=" * 72)
        print(f"  {'Product':<30} {'SKU':<14} {'Barcode':<14} {'Qty':>5}")
        print(f"  {'-'*30} {'-'*14} {'-'*14} {'-'*5}")
        for name, sku, bc, qty in store2_skus:
            print(f"  {name:<30} {sku:<14} {bc:<14} {qty:>5}")

        print()
        print("✅  Seed complete!")

asyncio.run(run())
