import os
import sys
import asyncio

# Add project root to sys.path to allow importing from scripts.xxx
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from scripts.deploy_cloud import CloudDeployer, DeployLogger

app = FastAPI(title="Vision Media Cloud Deployer Pro")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DeployConfig(BaseModel):
    supabase_url: str
    supabase_key: str
    database_url: str
    railway_token: str
    railway_service_id: str
    vercel_token: str
    vercel_project_id: str
    gemini_api_key: str
    upload_post_api_key: str
    api_secret_key: Optional[str] = None
    backend_url: str

class DeployState:
    def __init__(self):
        self.logs = []
        self.is_running = False
        self.progress = 0

state = DeployState()

def api_log_callback(level: str, msg: str):
    state.logs.append({"level": level, "message": msg, "timestamp": os.times()[4]})
    if level == "SUCCESS": state.progress += 20
    elif level == "ERROR": state.progress = -1

@app.get("/logs")
async def get_logs():
    return {"logs": state.logs, "progress": state.progress, "is_running": state.is_running}

@app.post("/deploy")
async def start_deployment(config: DeployConfig, background_tasks: BackgroundTasks):
    if state.is_running:
        raise HTTPException(status_code=400, detail="Deployment already in progress")
    
    state.logs = []
    state.progress = 0
    state.is_running = True
    
    background_tasks.add_task(run_deployment, config)
    return {"message": "Deployment started"}

async def run_deployment(config: DeployConfig):
    try:
        logger = DeployLogger(callback=api_log_callback)
        deploy_config = {
            'SUPABASE_URL': config.supabase_url,
            'SUPABASE_KEY': config.supabase_key,
            'DATABASE_URL': config.database_url,
            'RAILWAY_API_TOKEN': config.railway_token,
            'RAILWAY_SERVICE_ID': config.railway_service_id,
            'VERCEL_TOKEN': config.vercel_token,
            'VERCEL_PROJECT_ID': config.vercel_project_id,
            'GEMINI_API_KEY': config.gemini_api_key,
            'UPLOAD_POST_API_KEY': config.upload_post_api_key,
            'API_SECRET_KEY': config.api_secret_key or os.urandom(8).hex()
        }
        
        deployer = CloudDeployer(config=deploy_config, logger=logger)
        
        logger.info("--- Starting Automated Deployment ---")
        
        if await deployer.setup_database():
            state.progress = 25
            if deployer.setup_storage():
                state.progress = 50
                if deployer.setup_railway():
                    state.progress = 75
                    if deployer.setup_vercel(backend_url=config.backend_url):
                        state.progress = 100
                        logger.success("DEPLOYMENT COMPLETED SUCCESSFULLY!")
                    else:
                        logger.error("Vercel setup failed")
                else:
                    logger.error("Railway setup failed")
            else:
                logger.error("Storage setup failed")
        else:
            logger.error("Database setup failed")
            
    except Exception as e:
        api_log_callback("ERROR", f"Unexpected error: {str(e)}")
    finally:
        state.is_running = False

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
