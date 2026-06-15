"""Approve the demo vendor (slug=test) for local dev."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE vendor SET status = 'approved', verification_status = 'verified' "
                "WHERE slug = 'test'"
            )
        )
    await engine.dispose()
    print("Approved vendor slug=test")


if __name__ == "__main__":
    asyncio.run(main())
