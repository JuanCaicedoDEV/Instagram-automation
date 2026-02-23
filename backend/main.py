import os
import json
import logging
import time
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl
import asyncpg
from execution import scraper, generator
from backend.storage import get_storage_provider
import shutil
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Content Automation Engine")

# Storage Provider
storage = get_storage_provider()
logger.info(f"Using Storage Provider: {type(storage).__name__}")

# Security Configuration
API_SECRET_KEY = os.getenv("API_SECRET_KEY")
if not API_SECRET_KEY:
    logger.warning("API_SECRET_KEY not set! Security relies on network isolation.")

# Middleware for API Key Authentication
@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    # Skip auth for static files, docs, and trivial endpoints if needed
    if request.url.path.startswith("/images") or request.url.path.startswith("/uploads") or request.url.path == "/docs" or request.url.path == "/openapi.json":
        response = await call_next(request)
        return response

    if request.method == "OPTIONS":
        return await call_next(request)

    api_key = request.headers.get("X-API-Key")
    if API_SECRET_KEY:
        if api_key != API_SECRET_KEY:
             logger.warning("Auth Failed: Invalid API Key")
             return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or missing API Key"},
            )
    else:
        logger.warning("API_SECRET_KEY not set, skipping auth check.")
    
    response = await call_next(request)
    return response

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "*" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for generated images and uploads
os.makedirs("generated_images", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
app.mount("/images", StaticFiles(directory="generated_images"), name="images")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Database URL (Strict - no default password)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL is not set! Application will fail.")
    raise RuntimeError("DATABASE_URL must be set in environment")

# --- Pydantic Models ---
class CampaignCreate(BaseModel):
    name: str
    master_prompt: str
    brand_id: Optional[int] = None # Link campaign to a brand

class BrandCreate(BaseModel):
    name: str
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    identity_description: Optional[str] = None
    brand_dna: dict = {}

class BrandGenerate(BaseModel):
    brand_context: Optional[str] = None
    url: Optional[str] = None
    logo_url: Optional[str] = None

class PostCreate(BaseModel):
    specific_prompt: str
    image_count: int = 1
    type: str = "POST" 
    scheduled_at: Optional[datetime] = None
    input_image_url: Optional[str] = None
    use_as_content: bool = False # If true, use input_image_url as the final image

class PostUpdate(BaseModel):
    status: str

class PostPatch(BaseModel):
    scheduled_at: Optional[datetime] = None

# --- Startup/Shutdown ---
@app.on_event("startup")
async def startup():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        return
    # Wait for DB to be ready in real world, but for now just connect
    # Optimized pool settings
    app.state.pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
    logger.info("Database connection pool created with min_size=5, max_size=20")
    
    # Migrations
    async with app.state.pool.acquire() as connection:
        try:
            await connection.execute("""
                ALTER TABLE posts ADD COLUMN IF NOT EXISTS input_image_url TEXT;
            """)
            await connection.execute("""
                ALTER TABLE posts ADD COLUMN IF NOT EXISTS use_as_content BOOLEAN DEFAULT FALSE;
            """)
        except Exception as e:
            logger.warning(f"Migration error: {e}")

@app.on_event("shutdown")
async def shutdown():
    if hasattr(app.state, 'pool'):
        await app.state.pool.close()

# --- Endpoints ---
@app.get("/")
async def root():
    return {"message": "Content Automation Engine is running"}

# Campaign Endpoints
@app.post("/campaigns")
async def create_campaign(campaign: CampaignCreate):
    start_time = time.time()
    try:
        pool_acquire_start = time.time()
        async with app.state.pool.acquire() as connection:
            pool_acquire_end = time.time()
            logger.info(f"DB Connection acquired in {pool_acquire_end - pool_acquire_start:.4f}s")
            
            query_start = time.time()
            campaign_id = await connection.fetchval("""
                INSERT INTO campaigns (name, master_prompt, brand_id)
                VALUES ($1, $2, $3)
                RETURNING id
            """, campaign.name, campaign.master_prompt, campaign.brand_id)
            query_end = time.time()
            logger.info(f"Query executed in {query_end - query_start:.4f}s")
            
            total_time = time.time() - start_time
            logger.info(f"Total create_campaign time: {total_time:.4f}s")
            
            return {"id": campaign_id, "name": campaign.name}
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/campaigns")
async def get_campaigns():
    try:
        async with app.state.pool.acquire() as connection:
            rows = await connection.fetch("""
                SELECT c.id, c.name, c.master_prompt, c.created_at, c.brand_id, b.name as brand_name
                FROM campaigns c
                LEFT JOIN brands b ON c.brand_id = b.id
                ORDER BY c.created_at DESC
            """)
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# --- Brand Endpoints ---
@app.post("/brands/generate")
async def generate_brand_dna(input: BrandGenerate):
    try:
        content = input.brand_context or ""
        
        if input.url:
            logger.info(f"Fetching content from {input.url}")
            website_content = await scraper.fetch_website_content(input.url)
            content += f"\n\n--- WEBSITE CONTENT ({input.url}) ---\n{website_content[:20000]}" # Truncate to avoid huge context
            
        if not content and not input.logo_url:
             raise HTTPException(status_code=400, detail="Provide at least 'brand_context', 'url', or 'logo_url'")

        logger.info(f"Generating DNA (Multimodal: Text len={len(content)}, Logo={bool(input.logo_url)})")
        brand_dna = await generator.analyze_brand(content, input.logo_url)
        return brand_dna
    except Exception as e:
        logger.error(f"Error generating DNA: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate Brand DNA")

@app.post("/brands")
async def create_brand(brand: BrandCreate):
    try:
        async with app.state.pool.acquire() as connection:
            brand_id = await connection.fetchval("""
                INSERT INTO brands (name, website_url, logo_url, identity_description, brand_dna)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            """, brand.name, brand.website_url, brand.logo_url, brand.identity_description, json.dumps(brand.brand_dna))
            return {"id": brand_id, "name": brand.name}
    except Exception as e:
        logger.error(f"Error creating brand: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/brands")
async def get_brands():
    try:
        async with app.state.pool.acquire() as connection:
            rows = await connection.fetch("SELECT * FROM brands ORDER BY created_at DESC")
            brands = []
            for row in rows:
                brand = dict(row)
                if brand['brand_dna']:
                    brand['brand_dna'] = json.loads(brand['brand_dna'])
                brands.append(brand)
            return brands
    except Exception as e:
        logger.error(f"Error fetching brands: {e}")
        raise HTTPException(status_code=500)

@app.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: int):
    try:
        async with app.state.pool.acquire() as connection:
            # 1. Delete posts associated with campaign
            await connection.execute("""
                DELETE FROM posts WHERE campaign_id = $1
            """, campaign_id)
            
            # 2. Delete campaign
            result = await connection.execute("""
                DELETE FROM campaigns WHERE id = $1
            """, campaign_id)
            
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Campaign not found")
                
            return {"message": "Campaign and its posts deleted"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error deleting campaign: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/campaigns/{campaign_id}/posts")
async def get_campaign_posts(campaign_id: int):
    try:
        async with app.state.pool.acquire() as connection:
            rows = await connection.fetch("""
                SELECT id, campaign_id, specific_prompt, image_count, image_urls, caption, status, scheduled_at, input_image_url, use_as_content, type, created_at
                FROM posts
                WHERE campaign_id = $1
                ORDER BY created_at ASC
            """, campaign_id)
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching campaign posts: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # 1. Content-Type Validation
        if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/gif"]:
            raise HTTPException(status_code=400, detail="Invalid file type. Only images are allowed.")
        
        # 2. Extension Validation (Double check)
        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in ["jpg", "jpeg", "png", "webp", "gif"]:
             raise HTTPException(status_code=400, detail="Invalid file extension.")

        filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Upload using Storage Provider
        # We need to read the file first
        url = storage.upload(file.file, filename, file.content_type)
            
        return {"url": url, "path": filename} # path is less relevant now in cloud, but keeping key
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")

@app.post("/campaigns/{campaign_id}/posts")
async def create_post_in_campaign(campaign_id: int, post: PostCreate, background_tasks: BackgroundTasks):
    try:
        async with app.state.pool.acquire() as connection:
            # Create post record
            post_id = await connection.fetchval("""
                INSERT INTO posts (campaign_id, specific_prompt, image_count, status, input_image_url, use_as_content, type)
                VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)
                RETURNING id
            """, campaign_id, post.specific_prompt, post.image_count, post.input_image_url, post.use_as_content, post.type)
            
            # Start background generation task
            
            # Define saver callback for generator
            def save_generated_image(data: bytes, filename: str, content_type: str) -> str:
                return storage.upload(data, filename, content_type)

            background_tasks.add_task(process_post_generation, post_id, post.specific_prompt, post.image_count, post.input_image_url, post.use_as_content, save_generated_image) 
            
            return {"id": post_id, "status": "PENDING"}
            
    except Exception as e:
        logger.error(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

async def process_post_generation(post_id: int, prompt: str, image_count: int, input_image_url: str = None, use_as_content: bool = False, image_saver=None):
    try:
        logger.info(f"Processing post {post_id}...")
        
        # 2. Fetch Context (Brand DNA & Master Prompt)
        brand_dna = {} 
        master_prompt = ""
        
        try:
             async with app.state.pool.acquire() as conn:
                # Optimized query to get everything in one go
                row = await conn.fetchrow("""
                    SELECT c.master_prompt, b.brand_dna, p.status, p.image_urls, p.type, p.scheduled_at
                    FROM posts p 
                    JOIN campaigns c ON p.campaign_id = c.id 
                    LEFT JOIN brands b ON c.brand_id = b.id
                    WHERE p.id = $1
                """, post_id)
                
                if row:
                    # Guard: If post is already APPROVED and has images, skip re-generation to avoid overwriting
                    if row['status'] == 'APPROVED' and row['image_urls'] and json.loads(row['image_urls']):
                        logger.info(f"Post {post_id} already has approved content. Skipping generation.")
                        return

                    master_prompt = row['master_prompt']
                    if row['brand_dna']:
                        brand_dna = json.loads(row['brand_dna'])
                    
                    post_type = row['type']
                    scheduled_at = row['scheduled_at']

        except Exception as db_e:
            logger.error(f"Failed to fetch context: {db_e}")

        # 3. Generate Content
        full_prompt_details = f"Master Strategy: {master_prompt or ''}\nSpecific Context: {prompt}"

        content = await generator.generate_post(
            brand_dna, 
            full_prompt_details, 
            image_count=0 if use_as_content else image_count, 
            input_image_url=input_image_url,
            image_saver=image_saver,
            post_type=post_type,
            scheduled_at=scheduled_at
        )
        
        caption = content.get("caption", "")
        
        if use_as_content and input_image_url:
            image_urls = [input_image_url]
        else:
            image_urls = content.get("image_urls", [])
        
        # 3. Update DB
        async with app.state.pool.acquire() as conn:
            await conn.execute("""
                UPDATE posts 
                SET caption = $1, image_urls = $2, status = 'APPROVED'
                WHERE id = $3
            """, caption, json.dumps(image_urls), post_id)
        
        logger.info(f"Generated content for post {post_id}")
            
    except Exception as e:
        logger.error(f"Failed to process post {post_id}: {e}")
        # Update DB to failed
        try:
             async with app.state.pool.acquire() as connection:
                await connection.execute("UPDATE posts SET status = 'FAILED' WHERE id = $1", post_id)
        except:
            pass

@app.post("/posts/{post_id}/generate")
async def trigger_post_generation(post_id: int, background_tasks: BackgroundTasks):
    # Fetch details needed for generation since we only have ID
    try:
        async with app.state.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT specific_prompt, image_count, input_image_url, use_as_content
                FROM posts WHERE id = $1
            """, post_id)
            
            if not row:
                raise HTTPException(status_code=404, detail="Post not found")
            
            # Define saver callback
            def save_generated_image(data: bytes, filename: str, content_type: str) -> str:
                return storage.upload(data, filename, content_type)

            background_tasks.add_task(
                process_post_generation, 
                post_id, 
                row['specific_prompt'], 
                row['image_count'], 
                row['input_image_url'], 
                row['use_as_content'], 
                save_generated_image
            )
            
            return {"message": "Generation started", "id": post_id}
    except Exception as e:
         logger.error(f"Error triggering generation: {e}")
         raise HTTPException(status_code=500, detail="Internal Server Error")

@app.put("/posts/{post_id}/status")
async def update_post_status(post_id: int, update: PostUpdate):
    try:
        async with app.state.pool.acquire() as connection:
            result = await connection.execute("""
                UPDATE posts SET status = $1 WHERE id = $2
            """, update.status, post_id)
            if result == "UPDATE 0":
                raise HTTPException(status_code=404, detail="Post not found")
            return {"message": "Status updated"}
    except Exception as e:
        logger.error(f"Error updating status: {e}")
        raise HTTPException(status_code=500)

@app.delete("/posts/{post_id}")
async def delete_post(post_id: int):
    try:
        async with app.state.pool.acquire() as connection:
            result = await connection.execute("""
                DELETE FROM posts WHERE id = $1
            """, post_id)
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Post not found")
            return {"message": "Post deleted"}
    except Exception as e:
        logger.error(f"Error deleting post: {e}")
        raise HTTPException(status_code=500)

class InstagramConfig(BaseModel):
    api_key: str

# Instagram Integration Endpoints
@app.post("/integrations/instagram")
async def configure_instagram(config: InstagramConfig):
    try:
        async with app.state.pool.acquire() as connection:
            # Upsert integration config
            # We reuse 'access_token' column to store the Outstand API Key for simplicity
            await connection.execute("""
                INSERT INTO integrations (platform, access_token, page_id)
                VALUES ('instagram', $1, 'outstand')
                ON CONFLICT (platform) 
                DO UPDATE SET access_token = $1, page_id = 'outstand', updated_at = CURRENT_TIMESTAMP
            """, config.api_key)
            return {"message": "Instagram (Outstand) configuration saved"}
    except Exception as e:
        logger.error(f"Error saving Instagram config: {e}")
        raise HTTPException(status_code=500, detail="Failed to save configuration")

@app.get("/integrations/instagram")
async def get_instagram_config():
    try:
        async with app.state.pool.acquire() as connection:
            row = await connection.fetchrow("""
                SELECT access_token, updated_at FROM integrations WHERE platform = 'instagram'
            """)
            if row and row['access_token']:
                # Mask key for security
                masked = f"{row['access_token'][:4]}...{row['access_token'][-4:]}" if len(row['access_token']) > 8 else "***"
                return {"configured": True, "api_key_preview": masked, "updated_at": row["updated_at"]}
            return {"configured": False}
    except Exception as e:
        logger.error(f"Error fetching Instagram config: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch configuration")

@app.post("/posts/{post_id}/publish/instagram")
async def publish_post_to_instagram(post_id: int):
    try:
        async with app.state.pool.acquire() as connection:
            # 1. Get Post
            post = await connection.fetchrow("""
                SELECT caption, image_urls, scheduled_at, type FROM posts WHERE id = $1
            """, post_id)
            
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")
                
            image_urls = json.loads(post['image_urls'])
            if not image_urls:
                raise HTTPException(status_code=400, detail="Post has no images")
                
            # 2. Get Integration Config
            config_row = await connection.fetchrow("""
                SELECT access_token FROM integrations WHERE platform = 'instagram'
            """)
            
            # Pass to adapter as a dict
            platform_config = {}
            if config_row:
                platform_config["api_key"] = config_row["access_token"]
            
            # 3. Publish
            from backend.social_adapter import get_social_adapter
            adapter = get_social_adapter()
            
            # For now, handle single image. 
            image_url = image_urls[0]
            
            try:
                publish_id = await adapter.publish(
                    image_url, 
                    post['caption'], 
                    platform_config, 
                    post_type=post['type'],
                    scheduled_at=post['scheduled_at']
                )
            except Exception as e:
                logger.error(f"Adapter Publish Error: {e}")
                raise HTTPException(status_code=500, detail=f"Publishing failed: {str(e)}")
            
            # 4. Update Post Status
            await connection.execute("""
                UPDATE posts SET status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP WHERE id = $1
            """, post_id)
            
            return {"message": "Published successfully", "publish_id": publish_id}
            
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error publishing post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/posts/{post_id}")
async def patch_post(post_id: int, update: PostPatch):
    try:
        async with app.state.pool.acquire() as connection:
            # Construct dynamic update query
            # For now only scheduled_at is supported, but structure allows extension
            if update.scheduled_at is not None:
                await connection.execute("""
                    UPDATE posts SET scheduled_at = $1 WHERE id = $2
                """, update.scheduled_at, post_id)
            
            return {"message": "Post updated"}
    except Exception as e:
        logger.error(f"Error patching post: {e}")
        raise HTTPException(status_code=500)

