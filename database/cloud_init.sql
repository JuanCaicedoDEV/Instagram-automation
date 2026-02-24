-- Consolidated Cloud Initialization Script for Supabase

-- 1. Create ENUM for post status
DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('PENDING', 'APPROVED', 'PUBLISHED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create brands table
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    website_url TEXT,
    logo_url TEXT,
    identity_description TEXT,
    brand_dna JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    master_prompt TEXT,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create posts table 
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    specific_prompt TEXT,
    image_count INTEGER DEFAULT 1,
    image_urls JSONB DEFAULT '[]'::jsonb,
    caption TEXT,
    status post_status DEFAULT 'PENDING',
    type TEXT DEFAULT 'POST', -- POST, STORY, REEL
    input_image_url TEXT,
    use_as_content BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    page_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_campaign_id ON posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
