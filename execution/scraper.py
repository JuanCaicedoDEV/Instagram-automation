import httpx
import logging

logger = logging.getLogger(__name__)

async def fetch_website_content(url: str) -> str:
    """
    Fetches the raw HTML content of the given URL using httpx.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0, headers=headers, verify=False) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error occurred while fetching {url}: {e}")
        return f"Error fetching details from {url}: {e}"
    except Exception as e:
        logger.error(f"An error occurred while fetching {url}: {e}")
        return f"Error fetching details from {url}: {e}"
