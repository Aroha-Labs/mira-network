from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
import httpx
from hashlib import md5

router = APIRouter()

IMAGE_CACHE_DIR = "image_cache"
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)

@router.get(
    "/proxy-image",
    summary="Proxy and Cache Images",
    description="""Proxies and caches image requests from external URLs.

### Query Parameters
- `url`: The URL of the image to proxy and cache

### Response Format
Returns the image file directly with appropriate content-type header

### Technical Details
- Images are cached locally using MD5 hash of URL as filename
- File extension is determined from content-type header
- Cached images are served directly without re-downloading
- Supports all standard image formats (jpg, png, gif, webp, etc.)

### Caching Behavior
- First request downloads and caches the image
- Subsequent requests serve from local cache
- Cache is persistent across server restarts
- Files are stored in the 'image_cache' directory

### Error Responses
- `400 Bad Request`:
    ```json
    {
        "detail": "Invalid image URL"
    }
    ```
- `404 Not Found`:
    ```json
    {
        "detail": "Failed to fetch image"
    }
    ```

### Notes
- No authentication required
- Cache directory is created automatically if it doesn't exist
- Original content-type is preserved
- Useful for serving images from sources that don't support CORS""",
    response_description="Returns the cached image file with appropriate content-type",
    responses={
        200: {
            "description": "Successfully retrieved image",
            "content": {
                "image/*": {
                    "schema": {
                        "type": "string",
                        "format": "binary"
                    }
                }
            }
        },
        400: {
            "description": "Invalid image URL",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Invalid image URL"
                    }
                }
            }
        },
        404: {
            "description": "Image not found or failed to download",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Failed to fetch image"
                    }
                }
            }
        }
    },
)
async def proxy_image(url: str):
    # Generate a unique filename based on the URL
    filename = md5(url.encode()).hexdigest()
    filepath = os.path.join(IMAGE_CACHE_DIR, filename)

    # Check if the image is already cached
    if os.path.exists(filepath):
        return FileResponse(filepath)

    # Download the image and save it to the cache
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, detail="Failed to fetch image"
            )

        # Determine the file extension from the response headers
        content_type = response.headers.get("content-type")
        if content_type:
            extension = content_type.split("/")[-1]
            filepath += f".{extension}"

        with open(filepath, "wb") as f:
            f.write(response.content)

    return FileResponse(filepath)