import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:admin%401234@localhost:5432/vendor_db")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        row = (await session.execute(text('SELECT u.email FROM vendor_owner vo JOIN "user" u ON u.id = vo.user_id LIMIT 1'))).first()
        print(f"EMAIL={row.email}")
        from passlib.context import CryptContext
        hashed = CryptContext(schemes=["bcrypt"], deprecated="auto").hash("Admin@123")
        await session.execute(text('UPDATE "user" SET password_hash = :h WHERE email = :e'), {"h": hashed, "e": row.email})
        await session.commit()
        print("PASSWORD reset to Admin@123")
    await engine.dispose()

asyncio.run(main())
