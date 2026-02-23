import httpx
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, BinaryIO
from pathlib import Path

logger = logging.getLogger(__name__)

class SocialAdapter(ABC):
    @abstractmethod
    async def publish(self, image_url: str, caption: str, platform_config: Dict[str, Any], post_type: str = "POST", scheduled_at: Optional[Any] = None, timezone: Optional[str] = None) -> str:
        """Publishes content and returns a post ID/URL"""
        raise NotImplementedError("Subclasses must implement publish")

class OutstandAdapter(SocialAdapter):
    """
    Adapter for Outstand.io.
    """
    def __init__(self):
        self.api_url = os.getenv("OUTSTAND_API_URL", "https://api.outstand.so/v1/publish") 
        self.api_key = os.getenv("OUTSTAND_API_KEY")

    async def publish(self, image_url: str, caption: str, platform_config: Dict[str, Any], post_type: str = "POST", scheduled_at: Optional[Any] = None, timezone: Optional[str] = None) -> str:
        api_key = platform_config.get("api_key") or self.api_key
        if not api_key:
            raise ValueError("Outstand API Key not configured.")

        payload = {
            "apiKey": api_key,
            "platform": "instagram", 
            "imageUrl": image_url,
            "caption": caption,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(self.api_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("id") or data.get("postId") or "published-via-outstand"
        except Exception as e:
            logger.error(f"Outstand API Error: {e}")
            raise ValueError(f"Outstand API Failed: {str(e)}")

class UploadPostAdapter(SocialAdapter):
    """
    Adapter for upload-post.com.
    """
    def __init__(self):
        self.api_url = "https://api.upload-post.com/api/upload_photos"
        self.api_key = os.getenv("UPLOADPOST_API_KEY")
        self.user_id = os.getenv("UPLOADPOST_USER_ID", "default_user")

    async def publish(self, image_url: str, caption: str, platform_config: Dict[str, Any], post_type: str = "POST", scheduled_at: Optional[Any] = None, timezone: Optional[str] = None) -> str:
        api_key = platform_config.get("api_key") or self.api_key
        if not api_key:
            raise ValueError("UploadPost API Key not configured. Set UPLOADPOST_API_KEY env var.")

        # Determine if image_url is local or remote
        public_url = os.getenv("PUBLIC_URL", "http://localhost:8000")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            files = []
            if image_url.startswith(public_url):
                # Local file
                filename = image_url.split("/")[-1]
                local_path = Path("uploads") / filename
                if not local_path.exists():
                    local_path = Path("generated_images") / filename
                
                if local_path.exists():
                    files = [("photos[]", (filename, open(local_path, "rb"), "image/jpeg"))]
                else:
                    resp = await client.get(image_url)
                    resp.raise_for_status()
                    files = [("photos[]", (filename, resp.content, "image/jpeg"))]
            elif image_url.startswith("http"):
                # Remote file
                resp = await client.get(image_url)
                resp.raise_for_status()
                filename = image_url.split("/")[-1] or "image.jpg"
                files = [("photos[]", (filename, resp.content, "image/jpeg"))]
            else:
                raise ValueError(f"Invalid image URL: {image_url}")

            data = {
                "user": self.user_id,
                "platform[]": "instagram",
                "title": caption,
                "type": post_type.lower() # upload-post.com expects 'post', 'reel', 'story'
            }

            if scheduled_at:
                # Format to ISO-8601
                if hasattr(scheduled_at, 'isoformat'):
                    data["scheduled_date"] = scheduled_at.isoformat()
                else:
                    data["scheduled_date"] = str(scheduled_at)
                
                if timezone:
                    data["timezone"] = timezone
                elif os.getenv("DEFAULT_TIMEZONE"):
                    data["timezone"] = os.getenv("DEFAULT_TIMEZONE")

            headers = {
                "Authorization": f"Apikey {api_key}"
            }

            try:
                resp = await client.post(self.api_url, data=data, files=files, headers=headers)
                # 200: Instant publish, 201: Created, 202: Scheduled
                if resp.status_code not in [200, 201, 202]:
                    logger.error(f"UploadPost API Error: {resp.status_code} - {resp.text}")
                
                resp.raise_for_status()
                result = resp.json()
                
                if result.get("success"):
                    # Return job_id for scheduled posts, or request_id for instant ones
                    return result.get("job_id") or result.get("request_id") or "published-via-uploadpost"
                else:
                    error_msg = result.get("message") or result.get("error") or "Unknown error"
                    raise ValueError(f"UploadPost Error: {error_msg}")
            finally:
                # Close file if opened
                for _, file_info in files:
                    if isinstance(file_info[1], (BinaryIO, type(open(__file__)))) and hasattr(file_info[1], 'close'):
                        file_info[1].close()

def get_social_adapter() -> SocialAdapter:
    # return OutstandAdapter()
    return UploadPostAdapter()
