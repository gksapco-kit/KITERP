import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from passlib.context import CryptContext

ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:admin%401234@localhost:5432/vendor_db")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        rows = (await session.execute(text(
            'SELECT u.email, u.phone, u.full_name, u.is_active, u.password_hash '
            'FROM vendor_owner vo JOIN "user" u ON u.id = vo.user_id'
        ))).fetchall()
        for r in rows:
            print(f"Email:    {r.email}")
            print(f"Phone:    {r.phone}")
            print(f"Name:     {r.full_name}")
            print(f"Active:   {r.is_active}")
            print(f"Hash:     {r.password_hash[:40]}...")
            print(f"Admin@123 matches: {ctx.verify('Admin@123', r.password_hash)}")
            print("---")
    await engine.dispose()

asyncio.run(main())
