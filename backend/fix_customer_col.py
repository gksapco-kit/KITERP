import asyncio
import asyncpg

DB = "postgresql://postgres:postgres@localhost:5432/kiterp"

async def fix():
    conn = await asyncpg.connect(DB)
    try:
        exists = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name='customer' AND column_name='linked_customer_id'"
        )
        print(f"linked_customer_id column exists: {bool(exists)}")

        if not exists:
            await conn.execute(
                "ALTER TABLE customer ADD COLUMN linked_customer_id UUID"
            )
            print("Column ADDED successfully")
        else:
            print("Column already present — no action needed")

        await conn.execute("DROP INDEX IF EXISTS ix_customer_vendor_email")
        await conn.execute("DROP INDEX IF EXISTS ix_customer_vendor_phone")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_customer_email ON customer (email)")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_customer_phone ON customer (phone)")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_customer_linked ON customer (linked_customer_id)")
        print("Indexes OK")
    finally:
        await conn.close()

asyncio.run(fix())
