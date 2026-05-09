"""
KITERP — Comprehensive seed script
Inserts: categories, products, services, customers, suppliers, orders
"""
import asyncio, random, uuid, json
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DB = "postgresql+asyncpg://postgres:postgres@postgres:5432/kiterp"
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc)
def days_ago(n): return now() - timedelta(days=n)

# ── helpers ───────────────────────────────────────────────────────────────────

async def run():
    engine = create_async_engine(DB)
    async with engine.begin() as c:

        # get vendor id
        row = (await c.execute(text("SELECT id FROM vendor LIMIT 1"))).fetchone()
        if not row:
            print("No vendor found — run docker setup first"); return
        vendor_id = str(row[0])
        print(f"Seeding for vendor: {vendor_id}")

        # ── 1. Categories ─────────────────────────────────────────────────────

        cats = [
            # (id, name, slug, applies_to, parent_id)
            (uid(), "Electronics",     "electronics",      "both",     None),
            (uid(), "Clothing",        "clothing",         "both",     None),
            (uid(), "Food & Beverage", "food-beverage",    "both",     None),
            (uid(), "Home & Kitchen",  "home-kitchen",     "products", None),
            (uid(), "Health & Beauty", "health-beauty",    "both",     None),
            (uid(), "IT Services",     "it-services",      "services", None),
            (uid(), "Repair Services", "repair-services",  "services", None),
            (uid(), "Consulting",      "consulting",       "services", None),
        ]
        for cat in cats:
            await c.execute(text("""
                INSERT INTO vendor_category (id, vendor_id, name, slug, applies_to, is_active, sort_order)
                VALUES (:id, :vid, :name, :slug, :at, true, 0)
                ON CONFLICT DO NOTHING
            """), {"id": cat[0], "vid": vendor_id, "name": cat[1], "slug": cat[2], "at": cat[3]})
        print(f"  ✓ {len(cats)} categories")

        cat_map = {c[1]: c[0] for c in cats}

        # ── 2. Products ───────────────────────────────────────────────────────

        products = [
            # name, category, price, cost, qty, sku, brand, hsn, tax_rate, description
            ("iPhone 15 Pro 256GB",         "Electronics",     119900, 95000,  25,  "IPH15P-256",  "Apple",    "85171300", 18, "Latest Apple flagship with titanium design"),
            ("Samsung Galaxy S24 Ultra",    "Electronics",     124999, 99000,  18,  "SGS24U",      "Samsung",  "85171300", 18, "200MP camera, AI-powered features"),
            ("Sony WH-1000XM5 Headphones",  "Electronics",      29990, 18000,  40,  "SNYWH1000",   "Sony",     "85183000", 18, "Industry-leading noise cancellation"),
            ("Dell XPS 15 Laptop",          "Electronics",     189990, 145000, 12,  "DELLXPS15",   "Dell",     "84713010", 18, "15.6\" OLED display, Intel Core i7"),
            ("Organic Cotton T-Shirt",      "Clothing",           899,   350,  200, "OCT-M-WHT",   "EcoWear",  "61091000", 5,  "100% organic cotton, available in all sizes"),
            ("Premium Denim Jeans",         "Clothing",          2499,   900,  150, "PDJ-32-BLU",  "DenimCo",  "62034200", 5,  "Slim fit, stretch fabric"),
            ("Winter Jacket",               "Clothing",          4999,  2000,  60,  "WJ-L-BLK",    "NorthWear","62011000", 5,  "Water-resistant, thermal insulated"),
            ("Basmati Rice 5kg",            "Food & Beverage",    599,   320,  500, "RICE-BAS-5K", "Daawat",   "10063020", 0,  "Premium aged basmati rice"),
            ("Cold Pressed Olive Oil 1L",   "Food & Beverage",    899,   550,  200, "OO-CP-1L",    "Figaro",   "15091000", 5,  "Extra virgin, cold pressed"),
            ("Green Tea 100 bags",          "Food & Beverage",    299,   120,  300, "GT-100B",     "Tetley",   "09021000", 5,  "Premium green tea bags"),
            ("Air Fryer 4.5L",              "Home & Kitchen",   4999,  2800,  35,  "AF-4L-BLK",   "Philips",  "85165000", 18, "Digital controls, 8 preset programs"),
            ("Pressure Cooker 5L",          "Home & Kitchen",   2499,  1200,  55,  "PC-5L-SS",    "Hawkins",  "73239300", 12, "Stainless steel, 5 year warranty"),
            ("Face Moisturizer SPF50",      "Health & Beauty",   899,   350,  120, "FM-SPF50",    "Neutrogena","33049900", 18, "Daily moisturizer with sun protection"),
            ("Vitamin C Serum 30ml",        "Health & Beauty",  1299,   500,  90,  "VCS-30ML",    "The Ordinary","33049900",18,"20% concentration, brightening formula"),
            ("Yoga Mat Premium",            "Health & Beauty",  1999,   800,  75,  "YM-PRE-PRP",  "Manduka",  "39269090", 18, "6mm thick, non-slip surface"),
        ]

        prod_ids = []
        for p in products:
            pid = uid()
            prod_ids.append((pid, p[0]))
            slug = p[0].lower().replace(" ", "-").replace("/", "-")[:100]
            await c.execute(text("""
                INSERT INTO product (
                    id, vendor_id, name, slug, description, category,
                    price, cost_price, currency, sku, brand, hsn_code,
                    track_inventory, quantity, low_stock_threshold,
                    status, is_featured, is_visible, is_taxable, tax_rate,
                    product_type, created_at, updated_at
                ) VALUES (
                    :id, :vid, :name, :slug, :desc, :cat,
                    :price, :cost, 'INR', :sku, :brand, :hsn,
                    true, :qty, 5,
                    'active', :featured, true, true, :tax,
                    'physical', :ca, :ua
                ) ON CONFLICT DO NOTHING
            """), {
                "id": pid, "vid": vendor_id, "name": p[0], "slug": slug,
                "desc": p[9], "cat": p[1], "price": p[2], "cost": p[3],
                "sku": p[5], "brand": p[6], "hsn": p[7], "qty": p[4],
                "tax": p[8], "featured": random.random() > 0.6,
                "ca": days_ago(random.randint(30, 180)),
                "ua": days_ago(random.randint(1, 30)),
            })
        print(f"  ✓ {len(products)} products")

        # ── 3. Services ───────────────────────────────────────────────────────

        services = [
            # name, category, price, duration_min, sac, description
            ("Website Development",         "IT Services",    35000, 0,   "998314", "Custom responsive website development using React & Node.js"),
            ("Mobile App Development",      "IT Services",    75000, 0,   "998314", "iOS & Android app development with React Native"),
            ("SEO Optimization",            "IT Services",     8000, 120, "998314", "Complete on-page and off-page SEO audit and implementation"),
            ("Cloud Server Setup",          "IT Services",    12000, 180, "998315", "AWS/Azure cloud infrastructure setup and configuration"),
            ("Laptop Screen Repair",        "Repair Services", 2500,  90, "998719", "Screen replacement for all laptop brands"),
            ("Mobile Phone Repair",         "Repair Services", 1200,  60, "998719", "Screen, battery, charging port repairs"),
            ("AC Service & Repair",         "Repair Services", 1500, 120, "998719", "Annual maintenance contract, gas refill, repair"),
            ("Business Strategy Consulting","Consulting",      8000,  60, "998311", "One-hour strategic business consulting session"),
            ("Financial Planning Session",  "Consulting",      5000,  90, "998311", "Personal/business financial planning and advisory"),
            ("HR Policy Setup",             "Consulting",     15000,   0, "998311", "Complete HR policy documentation and compliance review"),
            ("Home Deep Cleaning",          "Health & Beauty", 2999, 240, "998531", "Professional deep cleaning for 2BHK, all included"),
            ("Personal Training Session",   "Health & Beauty",  800,  60, "999319", "One-on-one fitness training session at your location"),
        ]

        for s in services:
            sid = uid()
            slug = s[0].lower().replace(" ", "-").replace("/", "-")[:100]
            await c.execute(text("""
                INSERT INTO service (
                    id, vendor_id, name, slug, description, category,
                    price_type, price, currency, duration_minutes,
                    status, is_featured, is_visible, is_taxable, tax_rate,
                    sac_code, service_type, service_mode,
                    requires_booking, created_at, updated_at
                ) VALUES (
                    :id, :vid, :name, :slug, :desc, :cat,
                    'fixed', :price, 'INR', :dur,
                    'active', :featured, true, true, 18,
                    :sac, 'one_time', 'in_store',
                    true, :ca, :ua
                ) ON CONFLICT DO NOTHING
            """), {
                "id": sid, "vid": vendor_id, "name": s[0], "slug": slug,
                "desc": s[5], "cat": s[1], "price": s[2], "dur": s[3],
                "sac": s[4], "featured": random.random() > 0.6,
                "ca": days_ago(random.randint(30, 180)),
                "ua": days_ago(random.randint(1, 30)),
            })
        print(f"  ✓ {len(services)} services")

        # ── 4. Customers ──────────────────────────────────────────────────────

        customers_data = [
            ("Rajesh Kumar",      "rajesh.kumar@gmail.com",    "9876543210", "Tata Consultancy",   "27AABCT1332L1ZV", "Mumbai",    "Maharashtra"),
            ("Priya Sharma",      "priya.sharma@yahoo.com",    "9845612390", None,                  None,              "Delhi",     "Delhi"),
            ("Amit Patel",        "amit.patel@hotmail.com",    "9912345678", "Patel Enterprises",  "24AABCP5678K1ZP", "Ahmedabad", "Gujarat"),
            ("Sunita Reddy",      "sunita.reddy@gmail.com",    "9988776655", "Reddy & Associates", None,              "Hyderabad", "Telangana"),
            ("Mohammed Ali",      "mohammed.ali@outlook.com",  "9123456789", None,                  None,              "Chennai",   "Tamil Nadu"),
            ("Kavitha Nair",      "kavitha.nair@gmail.com",    "9654321098", "Nair Traders",       "32AABCN1234L1ZK", "Kochi",     "Kerala"),
            ("Vikram Singh",      "vikram.singh@gmail.com",    "9871234567", "Singh Industries",   "08AABCS9876K1ZV", "Jaipur",    "Rajasthan"),
            ("Anita Desai",       "anita.desai@gmail.com",     "9765432109", None,                  None,              "Pune",      "Maharashtra"),
            ("Ravi Chandran",     "ravi.chandran@gmail.com",   "9345678901", "Chandran Exports",   "33AABCC4567L1ZR", "Chennai",   "Tamil Nadu"),
            ("Meena Krishnan",    "meena.krishnan@gmail.com",  "9234567890", None,                  None,              "Bangalore", "Karnataka"),
            ("Deepak Malhotra",   "deepak.malhotra@gmail.com", "9812345670", "Malhotra & Sons",    "07AABCM2345L1ZD", "New Delhi", "Delhi"),
            ("Lakshmi Venkat",    "lakshmi.v@gmail.com",       "9567890123", None,                  None,              "Vizag",     "Andhra Pradesh"),
        ]

        customer_ids = []
        pw_hash = pwd_ctx.hash("Customer@123")
        for cust in customers_data:
            cid = uid()
            customer_ids.append((cid, cust[0]))
            addr = {"street": f"#{random.randint(1,999)}, MG Road", "city": cust[5], "state": cust[6], "postal_code": f"{random.randint(400000,999999)}", "country": "India"}
            await c.execute(text("""
                INSERT INTO customer (
                    id, vendor_id, full_name, email, phone, password_hash,
                    company_name, gstin, is_active,
                    total_orders, total_spent, opening_balance,
                    billing_address, created_at, updated_at
                ) VALUES (
                    :id, :vid, :name, :email, :phone, :pw,
                    :company, :gstin, true,
                    :orders, :spent, :bal,
                    cast(:addr as jsonb), :ca, :ua
                ) ON CONFLICT DO NOTHING
            """), {
                "id": cid, "vid": vendor_id, "name": cust[0],
                "email": cust[1], "phone": cust[2], "pw": pw_hash,
                "company": cust[3], "gstin": cust[4],
                "orders": random.randint(1, 25),
                "spent": round(random.uniform(500, 150000), 2),
                "bal": round(random.uniform(0, 5000), 2),
                "addr": json.dumps(addr),
                "ca": days_ago(random.randint(30, 365)),
                "ua": days_ago(random.randint(1, 30)),
            })
        print(f"  ✓ {len(customers_data)} customers")

        # ── 5. Suppliers ──────────────────────────────────────────────────────

        # Clear existing test suppliers and re-add clean ones
        await c.execute(text("DELETE FROM supplier WHERE vendor_id = :vid"), {"vid": vendor_id})

        suppliers_data = [
            ("Tech World Distributors",  "supplier", "techworld@gmail.com",     "9811223344", "27AABCT9012L1ZT", 45000),
            ("Fashion Hub India",        "supplier", "fashionhub@outlook.com",  "9922334455", "29AABCF3456L1ZF", 12000),
            ("Agro Fresh Supplies",      "supplier", "agrofresh@gmail.com",     "9933445566", "24AABCA7890L1ZA", 8500),
            ("Home Essentials Co",       "supplier", "homeessentials@gmail.com","9944556677", "07AABCH1234L1ZH", 23000),
            ("Beauty World Imports",     "supplier", "beautyworld@gmail.com",   "9955667788", "33AABCB5678L1ZB", 7200),
            ("Global IT Solutions",      "supplier", "globalit@outlook.com",    "9966778899", "29AABCG2345L1ZG", 55000),
            ("Prime Components Ltd",     "supplier", "primecomp@gmail.com",     "9977889900", "27AABCP6789L1ZP", 31000),
            ("SwiftLog Courier",         "supplier", "swiftlog@gmail.com",      "9988990011", None,               4500),
        ]

        for sup in suppliers_data:
            sid = uid()
            await c.execute(text("""
                INSERT INTO supplier (
                    id, vendor_id, name, party_type, email, phone,
                    gstin, opening_balance, is_active, created_at, updated_at
                ) VALUES (
                    :id, :vid, :name, :pt, :email, :phone,
                    :gstin, :bal, true, :ca, :ua
                ) ON CONFLICT DO NOTHING
            """), {
                "id": sid, "vid": vendor_id, "name": sup[0], "pt": sup[1],
                "email": sup[2], "phone": sup[3], "gstin": sup[4],
                "bal": sup[5],
                "ca": days_ago(random.randint(60, 365)),
                "ua": days_ago(random.randint(1, 30)),
            })
        print(f"  ✓ {len(suppliers_data)} suppliers")

        # ── 6. Orders ─────────────────────────────────────────────────────────

        statuses   = ['pending','confirmed','processing','shipped','delivered','delivered','delivered','cancelled']
        pay_status = ['paid','paid','paid','pending','partial']
        pay_method = ['upi','card','cash','bank_transfer','upi']

        for i in range(30):
            cust_id = random.choice(customer_ids)[0]
            prod    = random.choice(prod_ids)
            qty     = random.randint(1, 5)
            price   = random.choice([899,1299,2499,4999,29990,119900,599,2999])
            sub     = round(price * qty, 2)
            tax     = round(sub * 0.18, 2)
            disc    = round(sub * random.uniform(0, 0.1), 2)
            total   = round(sub + tax - disc, 2)
            order_date = days_ago(random.randint(1, 180))
            status  = random.choice(statuses)
            order_num = f"ORD-{2024}-{str(i+1001)}"

            items = [{
                "product_id": prod[0], "product_name": prod[1],
                "quantity": qty, "unit_price": price,
                "tax_rate": 18, "tax_amount": round(price * qty * 0.18, 2),
                "total": round(price * qty * 1.18, 2)
            }]

            await c.execute(text("""
                INSERT INTO public.order (
                    id, order_number, vendor_id, customer_id,
                    items, item_count, subtotal, tax_amount,
                    discount_amount, shipping_amount, total,
                    status, payment_status, payment_method,
                    source, created_at, updated_at
                ) VALUES (
                    :id, :num, :vid, :cid,
                    cast(:items as jsonb), :ic, :sub, :tax,
                    :disc, 0, :total,
                    :status, :ps, :pm,
                    'online', :ca, :ua
                ) ON CONFLICT DO NOTHING
            """), {
                "id": uid(), "num": order_num, "vid": vendor_id, "cid": cust_id,
                "items": json.dumps(items),
                "ic": qty, "sub": sub, "tax": tax, "disc": disc, "total": total,
                "status": status, "ps": random.choice(pay_status),
                "pm": random.choice(pay_method),
                "ca": order_date, "ua": order_date,
            })
        print(f"  ✓ 30 orders")

        print("\n✅ Seed complete!")
        print("   Categories : 8")
        print("   Products   : 15")
        print("   Services   : 12")
        print("   Customers  : 12")
        print("   Suppliers  : 8")
        print("   Orders     : 30")

asyncio.run(run())
