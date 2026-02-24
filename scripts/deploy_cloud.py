import os
import sys
import json
import asyncio
import requests
import asyncpg
from typing import Callable, Optional
from supabase import create_client, Client

# --- Colors for CLI ---
GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RED = "\033[91m"
END = "\033[0m"

class DeployLogger:
    def __init__(self, callback: Optional[Callable[[str, str], None]] = None):
        self.callback = callback

    def log(self, level: str, msg: str):
        if self.callback:
            self.callback(level, msg)
        
        color = END
        if level == "SUCCESS": color = GREEN
        elif level == "INFO": color = BLUE
        elif level == "WARN": color = YELLOW
        elif level == "ERROR": color = RED
        
        prefix = f"{color}[{level}]{END}"
        print(f"{prefix} {msg}")

    def success(self, msg): self.log("SUCCESS", msg)
    def info(self, msg): self.log("INFO", msg)
    def warn(self, msg): self.log("WARN", msg)
    def error(self, msg): self.log("ERROR", msg)

class CloudDeployer:
    def __init__(self, config: Optional[dict] = None, logger: Optional[DeployLogger] = None):
        self.config = config or {}
        self.logger = logger or DeployLogger()

    def ask_credentials(self):
        print(f"\n{BLUE}=== Vision Media Cloud Deployer ==={END}\n")
        
        # 1. Supabase
        print(f"{YELLOW}--- Supabase Setup ---{END}")
        if 'SUPABASE_URL' not in self.config: self.config['SUPABASE_URL'] = input("Supabase Project URL: ").strip()
        if 'SUPABASE_KEY' not in self.config: self.config['SUPABASE_KEY'] = input("Supabase Service Role Key: ").strip()
        if 'DATABASE_URL' not in self.config: self.config['DATABASE_URL'] = input("Supabase DATABASE_URL (URI): ").strip()
        
        # 2. Railway
        print(f"\n{YELLOW}--- Railway Setup (Backend) ---{END}")
        if 'RAILWAY_API_TOKEN' not in self.config: self.config['RAILWAY_API_TOKEN'] = input("Railway Token: ").strip()
        if 'RAILWAY_SERVICE_ID' not in self.config: self.config['RAILWAY_SERVICE_ID'] = input("Railway Service ID (Target Backend Service): ").strip()
        
        # 3. Vercel
        print(f"\n{YELLOW}--- Vercel Setup (Frontend) ---{END}")
        if 'VERCEL_TOKEN' not in self.config: self.config['VERCEL_TOKEN'] = input("Vercel API Token: ").strip()
        if 'VERCEL_PROJECT_ID' not in self.config: self.config['VERCEL_PROJECT_ID'] = input("Vercel Project ID: ").strip()

        # 4. App Keys
        print(f"\n{YELLOW}--- Application Keys ---{END}")
        if 'GEMINI_API_KEY' not in self.config: self.config['GEMINI_API_KEY'] = input("Gemini API Key: ").strip()
        if 'UPLOAD_POST_API_KEY' not in self.config: self.config['UPLOAD_POST_API_KEY'] = input("Upload-Post API Key: ").strip()
        if 'API_SECRET_KEY' not in self.config: self.config['API_SECRET_KEY'] = input("API Secret Key (Create one if none): ").strip() or "Vm-" + os.urandom(8).hex()

    async def setup_database(self):
        self.logger.info("Connecting to Supabase Database...")
        sql_path = "database/cloud_init.sql"
        if not os.path.exists(sql_path):
            self.logger.error(f"SQL file not found at {sql_path}")
            return False

        try:
            conn = await asyncpg.connect(self.config['DATABASE_URL'])
            with open(sql_path, "r") as f:
                sql = f.read()
            
            self.logger.info("Executing initialization script...")
            await conn.execute(sql)
            await conn.close()
            self.logger.success("Database initialized in Supabase.")
            return True
        except Exception as e:
            self.logger.error(f"Database setup failed: {e}")
            return False

    def setup_storage(self):
        self.logger.info("Configuring Supabase Storage...")
        try:
            supabase: Client = create_client(self.config['SUPABASE_URL'], self.config['SUPABASE_KEY'])
            bucket_name = "content-assets"
            
            # Check if bucket exists
            buckets = supabase.storage.list_buckets()
            exists = any(b.name == bucket_name for b in buckets)
            
            if not exists:
                supabase.storage.create_bucket(bucket_name, options={"public": True})
                self.logger.success(f"Bucket '{bucket_name}' created and set to public.")
            else:
                self.logger.info(f"Bucket '{bucket_name}' already exists.")
            return True
        except Exception as e:
            self.logger.error(f"Storage setup failed: {e}")
            return False

    def setup_railway(self):
        self.logger.info("Setting up Railway Environment Variables...")
        url = "https://backboard.railway.app/graphql"
        headers = {"Authorization": f"Bearer {self.config['RAILWAY_API_TOKEN']}"}

        vars_to_set = {
            "DATABASE_URL": self.config['DATABASE_URL'],
            "STORAGE_PROVIDER": "supabase",
            "SUPABASE_URL": self.config['SUPABASE_URL'],
            "SUPABASE_KEY": self.config['SUPABASE_KEY'],
            "SUPABASE_BUCKET": "content-assets",
            "GEMINI_API_KEY": self.config['GEMINI_API_KEY'],
            "UPLOAD_POST_API_KEY": self.config['UPLOAD_POST_API_KEY'],
            "SOCIAL_ADAPTER": "upload_post",
            "API_SECRET_KEY": self.config['API_SECRET_KEY']
        }

        mutation = """
        mutation variableUpsert($serviceId: String!, $name: String!, $value: String!) {
          variableUpsert(input: { serviceId: $serviceId, name: $name, value: $value })
        }
        """

        success_count = 0
        for name, value in vars_to_set.items():
            payload = {
                "query": mutation,
                "variables": {
                    "serviceId": self.config['RAILWAY_SERVICE_ID'],
                    "name": name,
                    "value": value
                }
            }
            resp = requests.post(url, json=payload, headers=headers)
            if resp.status_code == 200 and "errors" not in resp.json():
                success_count += 1
            else:
                self.logger.warn(f"Failed to set {name} on Railway: {resp.text}")

        self.logger.success(f"Set {success_count}/{len(vars_to_set)} variables on Railway.")
        return success_count == len(vars_to_set)

    def setup_vercel(self, backend_url: Optional[str] = None):
        self.logger.info("Setting up Vercel Environment Variables...")
        base_url = f"https://api.vercel.com/v10/projects/{self.config['VERCEL_PROJECT_ID']}/env"
        headers = {"Authorization": f"Bearer {self.config['VERCEL_TOKEN']}"}

        if not backend_url:
            backend_url = input("\nRailway Backend URL (e.g. https://vm-api.up.railway.app): ").strip()

        vars_to_set = [
            {"key": "VITE_API_URL", "value": backend_url, "type": "plain", "target": ["production", "preview", "development"]},
            {"key": "VITE_API_KEY", "value": self.config['API_SECRET_KEY'], "type": "plain", "target": ["production", "preview", "development"]}
        ]

        success_count = 0
        for v in vars_to_set:
            resp = requests.post(f"{base_url}?upsert=true", json=v, headers=headers)
            if resp.status_code in [200, 201]:
                success_count += 1
            else:
                self.logger.warn(f"Failed to set {v['key']} on Vercel: {resp.text}")

        self.logger.success(f"Set {success_count}/{len(vars_to_set)} variables on Vercel.")
        return success_count == len(vars_to_set)

    async def run(self):
        self.ask_credentials()
        
        confirm = input("\nReady to deploy? (y/n): ").lower()
        if confirm != 'y':
            return

        if await self.setup_database():
            if self.setup_storage():
                if self.setup_railway():
                    if self.setup_vercel():
                        print(f"\n{GREEN}=== CLOUD DEPLOYMENT COMPLETED! ==={END}")
                        print("Instructions:")
                        print("1. Push your code to GitHub.")
                        print("2. Railway and Vercel will auto-deploy with the new settings.")
                    else:
                        self.logger.error("Vercel setup failed.")
                else:
                    self.logger.error("Railway setup failed.")
            else:
                self.logger.error("Storage setup failed.")
        else:
            self.logger.error("Database setup failed.")

if __name__ == "__main__":
    deployer = CloudDeployer()
    asyncio.run(deployer.run())
