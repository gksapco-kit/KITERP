"""Add offering_type column to vendor table"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Add offering_type column with default 'both'
        await conn.execute(text("""
            ALTER TABLE vendor 
            ADD COLUMN IF NOT EXISTS offering_type VARCHAR(20) DEFAULT 'both' NOT NULL
        """))
        print('[OK] Added offering_type column to vendor table')
        
        # Update existing vendors based on their settings.features
        await conn.execute(text("""
            UPDATE vendor 
            SET offering_type = 
                CASE 
                    WHEN settings->'features'->>'products' = 'true' 
                         AND settings->'features'->>'services' = 'true' THEN 'both'
                    WHEN settings->'features'->>'products' = 'true' THEN 'products'
                    WHEN settings->'features'->>'services' = 'true' THEN 'services'
                    ELSE 'both'
                END
            WHERE offering_type = 'both'
        """))
        print('[OK] Updated existing vendors offering_type from settings')


if __name__ == "__main__":
    asyncio.run(migrate())
