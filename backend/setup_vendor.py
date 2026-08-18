"""
Setup script: Creates a vendor user, registers a vendor, makes the user a superuser,
and approves the vendor — all in one go.
"""
import asyncio
import httpx

BASE = "http://localhost:8000/api/v1"

VENDOR_EMAIL = "vendor@kiterp.com"
VENDOR_PASSWORD = "vendor123"
VENDOR_NAME = "Demo Store"
# Slug used in business front URLs: /store/<slug>/…  ("test" matches a common dev URL.)
VENDOR_SLUG = "test"


async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        # ── Step 1: Register user ──
        print("1. Registering user...")
        r = await client.post(f"{BASE}/auth/register", json={
            "full_name": "Demo Vendor",
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD,
        })
        if r.status_code == 201:
            user = r.json()
            print(f"   Created user: {user['id']}")
        elif r.status_code == 400 and "already" in r.text.lower():
            print("   User already exists, continuing...")
        else:
            print(f"   Register response: {r.status_code} {r.text}")

        # ── Step 2: Login ──
        print("2. Logging in...")
        r = await client.post(f"{BASE}/auth/login", data={
            "username": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD,
        })
        if r.status_code != 200:
            print(f"   Login failed: {r.status_code} {r.text}")
            return
        tokens = r.json()
        access_token = tokens["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}
        print("   Logged in OK")

        # ── Step 3: User id from JWT (verified when secret matches backend/.env) ──
        from jose import jwt as jose_jwt
        from app.core.security import decode_token

        payload = decode_token(access_token)
        if not payload or not payload.get("sub"):
            # Local dev: secret in running API may differ from backend/.env (e.g. old uvicorn). Sub is still safe to read.
            try:
                payload = jose_jwt.get_unverified_claims(access_token)
            except Exception:
                payload = {}
        user_id = payload.get("sub")
        if not user_id:
            print("   Could not read user id from access token. Restart uvicorn from the backend folder so it loads backend/.env.")
            return
        print(f"   User ID: {user_id}")

        # ── Step 4: Make superuser (direct DB) ──
        print("3. Making user a superuser via DB...")
        try:
            import sqlalchemy
            from sqlalchemy import text
            from app.config import settings
            # Use sync engine for simple update
            sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
            engine = sqlalchemy.create_engine(sync_url)
            with engine.connect() as conn:
                conn.execute(text('UPDATE "user" SET is_superuser = true WHERE id = :uid'), {"uid": user_id})
                conn.commit()
            engine.dispose()
            print("   Superuser: OK")
        except Exception as e:
            print(f"   Superuser update failed: {e}")
            print("   (You may need to set is_superuser manually in the DB)")

        # ── Step 5: Register vendor ──
        print("4. Registering vendor...")
        r = await client.post(f"{BASE}/vendors/register", headers=headers, json={
            "business_name": VENDOR_NAME,
            "display_name": VENDOR_NAME,
            "slug": VENDOR_SLUG,
            "business_type": "individual",
            "industry": "retail",
            "description": "A demo vendor store for testing the KITERP platform.",
            "primary_email": VENDOR_EMAIL,
            "primary_phone": "9876543210",
            "owner_name": "Demo Vendor",
            "address": {
                "street_address": "123 Main Street",
                "city": "Bangalore",
                "state": "Karnataka",
                "postal_code": "560001",
                "country": "India",
            },
        })
        if r.status_code == 201:
            vendor = r.json()
            vendor_id = vendor["id"]
            print(f"   Vendor created: {vendor_id} (slug: {VENDOR_SLUG})")
        elif r.status_code == 400 and "already" in r.text.lower():
            print("   Vendor already exists, fetching...")
            r = await client.get(f"{BASE}/vendors/me", headers=headers)
            if r.status_code == 200:
                vendor = r.json()
                vendor_id = vendor["id"]
                print(f"   Vendor ID: {vendor_id}")
            else:
                print(f"   Could not fetch vendor: {r.status_code} {r.text}")
                return
        else:
            print(f"   Vendor register: {r.status_code} {r.text}")
            return

        # ── Step 6: Approve vendor (as superuser) ──
        print("5. Approving vendor...")
        # Re-login to get fresh token with superuser flag
        r = await client.post(f"{BASE}/auth/login", data={
            "username": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD,
        })
        tokens = r.json()
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        r = await client.put(f"{BASE}/admin/vendors/{vendor_id}/approve", headers=headers)
        if r.status_code == 200:
            print("   Vendor approved!")
        elif r.status_code == 400 and "already" in r.text.lower():
            print("   Vendor already approved")
        else:
            print(f"   Approve response: {r.status_code} {r.text}")

        # ── Done ──
        print()
        print("=" * 55)
        print("  VENDOR SETUP COMPLETE")
        print("=" * 55)
        print()
        print(f"  Email:    {VENDOR_EMAIL}")
        print(f"  Password: {VENDOR_PASSWORD}")
        print(f"  Slug:     {VENDOR_SLUG}")
        print()
        print("  Login at:")
        print(f"    Vendor Admin:  http://localhost:3001")
        print(f"    Business Front:    http://localhost:3002/{VENDOR_SLUG}")
        print(f"    Super Admin:   http://localhost:3000")
        print()


if __name__ == "__main__":
    asyncio.run(main())
