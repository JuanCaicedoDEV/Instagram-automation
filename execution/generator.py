import os
import json
import logging
import urllib.parse
from typing import List, Dict, Optional, Any, Callable
from google import genai
from google.genai import types
import urllib.parse
import uuid
from pathlib import Path
import httpx
from io import BytesIO
from PIL import Image as PILImage

logger = logging.getLogger(__name__)

# Configure Gemini API
GENAI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GENAI_API_KEY:
    logger.warning("GEMINI_API_KEY not set in environment variables")
    client = None
else:
    client = genai.Client(api_key=GENAI_API_KEY)

async def analyze_brand(text_content: str, visual_content_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyzes the brand identity from the provided text description and optional visual content (logo/image) using Gemini.
    Returns a JSON object with brand details.
    """
    if not client:
        raise ValueError("GEMINI_API_KEY is not set")

    prompt = f"""
    Actúa como un Director de Arte y Estratega de Marca Senior.

    Tu tarea es analizar la identidad de marca basándote en la información proporcionada (Texto y/o Imagen).
    Debes estructurar esta información en un perfil de marca coherente.

    Analiza los siguientes puntos:
    1. **Verbal Identity (Copywriting):** ¿Cómo hablan? (Tono, estilo) Basado en el texto.
    2. **Estética Visual:** 
       - Si se proporciona una imagen (Logo/Web), analízala PRIORITARIAMENTE para extraer la paleta de colores exacta y el estilo gráfico.
       - Si solo hay texto, deduce el estilo visual probable.
    3. **Colores:** Extrae los códigos HEX exactos de la imagen si está disponible.

    Genera un JSON ESTRICTO (sin markdown, sin texto extra) con la siguiente estructura exacta:

    {{
      "brand_name": "Nombre de la empresa (si se menciona) o 'Unknown'",
      "brand_voice": "Descripción del tono de voz.",
      "target_audience": "Público objetivo deducido.",
      "color_palette": ["#HEX_PRIMARY", "#HEX_SECONDARY", "#HEX_ACCENT"],
      "visual_style_description": "Descripción técnica del estilo visual.",
      "nano_banana_prompt_suffix": "Prompt para generar una imagen representativa. Formato en Inglés: 'Style: [Adjetivos]. Colors: [Colores]. UI Elements: [Elementos]. High fidelity, UX/UI masterpiece.'",
      "keywords": ["Palabra clave 1", "Palabra clave 2", "Palabra clave 3"]
    }}

    IMPORTANTE:
    - Responde ÚNICAMENTE con el objeto JSON.
    
    ---
    CONTEXTO TEXTUAL / URL CONTENT:
    {text_content[:30000]} 
    """

    contents = [prompt]
    
    if visual_content_url:
        try:
            logger.info(f"Fetching visual content from {visual_content_url}")
            async with httpx.AsyncClient() as http_client:
                 resp = await http_client.get(visual_content_url)
                 resp.raise_for_status()
                 image_data = resp.content
                 # Pass image to Gemini
                 contents.append(types.Part.from_bytes(data=image_data, mime_type="image/jpeg")) 
        except Exception as e:
            logger.warning(f"Failed to fetch/process visual content for analysis: {e}")

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        text_response = response.text
        return json.loads(text_response.strip())
    except Exception as e:
        logger.error(f"Error analyzing brand with Gemini: {e}")
        raise

async def generate_image(prompt: str, input_image: Optional[PILImage.Image] = None, image_saver: Optional[Callable[[bytes, str, str], str]] = None) -> str:
    """
    Generates an image based on the prompt using Gemini's Imagen 3 model via google-genai SDK.
    If input_image is provided, it attempts to use it for image-to-image generation (if supported) 
    or just uses the prompt derived from it.
    """
    if not client:
        raise ValueError("GEMINI_API_KEY is not set")

    try:
        # Configuration for image generation
        response = await client.aio.models.generate_content(
            model='gemini-3-pro-image-preview', # or 'imagen-3.0-generate-001'
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['Image'],
                image_config=types.ImageConfig(
                    aspect_ratio="1:1",
                )
            )
        )

        image = None
        if response.parts:
            for part in response.parts:
                 if hasattr(part, 'inline_data') and part.inline_data:
                     try:
                         image_bytes = part.inline_data.data
                         image = PILImage.open(BytesIO(image_bytes))
                         break
                     except Exception as img_e:
                         logger.warning(f"Failed to process inline_data as image: {img_e}")
                
                 if hasattr(part, 'image') and part.image:
                     image = part.image
                     break

        if not image:
             if response.parts:
                 logger.error(f"First part attributes: {dir(response.parts[0])}")
             raise ValueError("No image found in response parts")

        # Use callback if provided, else fallback to local (for backward compatibility during migration)
        # But ideally we always use the callback now.
        if image_saver:
            img_byte_arr = BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr = img_byte_arr.getvalue()
            
            filename = f"{uuid.uuid4()}.png"
            return image_saver(img_byte_arr, filename, "image/png")
        
        # Fallback Local Save (Legacy)
        filename = f"{uuid.uuid4()}.png"
        save_path = Path("generated_images") / filename
        save_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(save_path)
        return f"http://localhost:8000/images/{filename}"

    except Exception as e:
        logger.error(f"Image Generation failed: {e}")
        encoded_prompt = urllib.parse.quote(prompt[:50])
        return f"https://placehold.co/1024x1024/png?text={encoded_prompt}&font=roboto"

async def generate_post(brand_info: Dict[str, Any], prompt_details: str = "Create a generic promotional post", image_count: int = 1, input_image_url: Optional[str] = None, image_saver: Optional[Callable[[bytes, str, str], str]] = None) -> Dict[str, Any]:
    """
    Generates an Instagram caption and multiple image prompts/images.
    If input_image_url is provided, it uses the image to guide the caption and image prompts.
    """
    if not client:
        raise ValueError("GEMINI_API_KEY is not set")

    input_image_data = None
    input_image_pil = None
    if input_image_url:
        try:
            # Download the image
            # Since we are local, if it's localhost, we can try to read file or just download
            async with httpx.AsyncClient() as http_client:
                resp = await http_client.get(input_image_url)
                resp.raise_for_status()
                input_image_data = resp.content
                input_image_pil = PILImage.open(BytesIO(input_image_data))
        except Exception as e:
            logger.error(f"Failed to download input image: {e}")

    prompt_text = f"""
    Based on the following context and post details, generate an Instagram caption and {image_count} distinct image generation prompts.

    CONTEXT:
    {json.dumps(brand_info, indent=2) if brand_info else "No specific brand guidelines provided. Focus entirely on the POST DETAILS."}

    POST DETAILS:
    {prompt_details}

    """
    
    if input_image_data:
        prompt_text += "\n\nAn input image has been provided. \n1. Analyze this image and use it as the primary visual reference for the caption.\n2. For the 'image_prompts', describe how to EDIT or RECREATE this image to match the desired style better, or generate variations of it."
    
    prompt_text += f"""
    OUTPUT FORMAT (Strict JSON):
    {{
        "caption": "The instagram caption with emojis and hashtags",
    """
    
    if image_count > 0:
        prompt_text += f"""
        "image_prompts": [
            "Detailed prompt for image 1...",
            "Detailed prompt for image 2..."
        ]
        }}
        Ensure you generate exactly {image_count} prompts in the array.
        """
    else:
        prompt_text += f"""
        "image_prompts": []
        }}
        """

    contents = [prompt_text]
    if input_image_data:
        # Pass the image to Gemini for analysis (Multimodal)
        contents.append(types.Part.from_bytes(data=input_image_data, mime_type="image/jpeg")) # Assuming jpeg/png, API handles detection usually or strictly mime

    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.0-flash', # Multimodal model for text/caption generation
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        text_response = response.text
        try:
             result = json.loads(text_response.strip())
        except json.JSONDecodeError:
             # Fallback cleanup
             cleaned_text = text_response.replace("```json", "").replace("```", "")
             result = json.loads(cleaned_text.strip())
        
        image_prompts = result.get("image_prompts", [])
        if isinstance(image_prompts, str):
            image_prompts = [image_prompts]
        
        final_prompts = []
        prompt_suffix = brand_info.get('prompt_suffix', '') if brand_info else ''
        
        for i, img_prompt in enumerate(image_prompts[:image_count]):
            p = f"{img_prompt}"
            if prompt_suffix:
                p += f". {prompt_suffix}"
            final_prompts.append(p)
            
        while len(final_prompts) < image_count:
            variant_prompt = f"{prompt_details} - Variation {len(final_prompts)+1}"
            if prompt_suffix:
                variant_prompt += f". {prompt_suffix}"
            final_prompts.append(variant_prompt)
            
        import asyncio
        logger.info(f"Generating {len(final_prompts)} images in parallel...")
        
        tasks = [generate_image(prompt, input_image=input_image_pil if input_image_data else None, image_saver=image_saver) for prompt in final_prompts]
        generated_urls = await asyncio.gather(*tasks)

        result["image_urls"] = generated_urls 
        if "image_url" in result:
            del result["image_url"]
            
        return result
    except Exception as e:
        logger.error(f"Error generating post content with Gemini: {e}")
        raise
