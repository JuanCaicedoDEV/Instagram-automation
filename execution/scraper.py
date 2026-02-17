import httpx
from bs4 import BeautifulSoup
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

async def scrape_website(url: str) -> Dict[str, Any]:
    """
    Scrapes the HTML content of the given URL using httpx and BeautifulSoup.
    Simulates the n8n 'Scrape Website' functionality.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/"
    }
    
    try:
        # verify=False is generally not recommended for production but can help with some scraping blocks or miconfigured certs
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0, headers=headers, verify=False) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            html_content = response.text
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Basic metadata extraction (can be expanded based on specific needs)
            title = soup.title.string if soup.title else ""
            meta_description = ""
            description_tag = soup.find('meta', attrs={'name': 'description'})
            if description_tag:
                meta_description = description_tag.get('content', '')
                
            # Extract all text visible to user (simple approximation)
            text_content = soup.get_text(separator=' ', strip=True)

            return {
                "url": url,
                "status_code": response.status_code,
                "title": title,
                "meta_description": meta_description,
                "html": html_content,
                "text": text_content[:5000] # truncate for safety, n8n often passes raw HTML or truncated text to AI
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error occurred while scraping {url}: {e}")
        raise
    except Exception as e:
        logger.error(f"An error occurred while scraping {url}: {e}")
        raise
