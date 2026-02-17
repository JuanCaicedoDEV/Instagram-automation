import asyncio
import asyncpg
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/content_db")

async def run_migration():
    logger.info("Starting migration to add 'integrations' table...")
    
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Create integrations table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS integrations (
                id SERIAL PRIMARY KEY,
                platform VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'instagram', 'linkedin'
                access_token TEXT NOT NULL,
                page_id VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Add index
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
        """)
        
        logger.info("Migration completed successfully.")
        await conn.close()
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
