import httpx
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class SocialAdapter(ABC):
    @abstractmethod
    async def publish(self, image_url: str, caption: str, platform_config: Dict[str, Any]) -> str:
        """Publishes content and returns a post ID/URL"""
        pass

class NativeInstagramAdapter(SocialAdapter):
    def __init__(self):
        self.base_url = "https://graph.facebook.com/v19.0"

    async def publish(self, image_url: str, caption: str, platform_config: Dict[str, Any]) -> str:
        access_token = platform_config.get("access_token")
        page_id = platform_config.get("page_id")
        
        if not access_token or not page_id:
            raise ValueError("Native Instagram requires 'access_token' and 'page_id'")

        # 1. Create Media Container
        container_url = f"{self.base_url}/{page_id}/media"
        params = {
            "image_url": image_url,
            "caption": caption,
            "access_token": access_token
        }
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(container_url, params=params)
                resp.raise_for_status()
                container_id = resp.json()["id"]
                logger.info(f"Created Container ID: {container_id}")
                
                # 2. Publish Media
                publish_url = f"{self.base_url}/{page_id}/media_publish"
                pub_params = {
                    "creation_id": container_id,
                    "access_token": access_token
                }
                
                pub_resp = await client.post(publish_url, params=pub_params)
                pub_resp.raise_for_status()
                publish_id = pub_resp.json()["id"]
                logger.info(f"Published to Instagram (Native): {publish_id}")
                
                return publish_id

        except httpx.HTTPStatusError as e:
            logger.error(f"Instagram API Error: {e.response.text}")
            raise ValueError(f"Instagram API Failed: {e.response.text}")

class OutstandAdapter(SocialAdapter):
    """
    Adapter for Outstand.io (or similar simple API).
    Assumed Schema based on industry standards:
    POST /publish
    {
      "apiKey": "...",
      "platform": "instagram",
      "imageUrl": "...",
      "text": "..."
    }
    """
    def __init__(self):
        # Allow override via env for testing/config
        self.api_url = os.getenv("OUTSTAND_API_URL", "https://api.outstand.so/v1/publish") 
        self.api_key = os.getenv("OUTSTAND_API_KEY")

    async def publish(self, image_url: str, caption: str, platform_config: Dict[str, Any]) -> str:
        if not self.api_key:
             # Fallback if passed in config (unlikely for global service key, but possible)
             self.api_key = platform_config.get("api_key")
        
        if not self.api_key:
            raise ValueError("Outstand API Key not configured (OUTSTAND_API_KEY env var)")

        payload = {
            "apiKey": self.api_key,
            "platform": "instagram", # or pass as arg if we support others
            "imageUrl": image_url,
            "caption": caption,
            # optional: "accountId": platform_config.get("page_id") 
        }

        try:
            async with httpx.AsyncClient() as client:
                # Assuming JSON payload standard
                resp = await client.post(self.api_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                
                # Assume they return an ID
                post_id = data.get("id") or data.get("postId") or "published-via-outstand"
                logger.info(f"Published via Outstand: {post_id}")
                return post_id

        except httpx.HTTPStatusError as e:
            logger.error(f"Outstand API Error: {e.response.text}")
            raise ValueError(f"Outstand API Failed: {e.response.text}")

def get_social_adapter() -> SocialAdapter:
    provider = os.getenv("SOCIAL_PROVIDER", "native").lower()
    
    if provider == "outstand":
        return OutstandAdapter()
    
    return NativeInstagramAdapter()
