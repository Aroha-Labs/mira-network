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
    description="""
    Proxies image requests and caches them locally.
    Downloads images from external URLs and serves them from local cache if available.
    Supports various image formats based on content-type header.
    """,
    response_description="Returns the requested image file",
    responses={
        200: {"description": "Successfully retrieved image"},
        404: {"description": "Image not found or failed to download"},
        400: {"description": "Invalid image URL"},
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