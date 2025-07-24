import json
import uuid
import time
from typing import Optional, Dict, Any
import httpx
from fastapi.responses import StreamingResponse, Response
from src.router.core.config import ENABLE_CACHE, CACHE_API_URL, CACHE_API_KEY
from src.router.utils.logger import logger


class CacheService:
    """Service for handling external cache operations"""
    
    def __init__(self):
        self.enabled = ENABLE_CACHE
        self.api_url = CACHE_API_URL
        self.api_key = CACHE_API_KEY
    
    async def check(self, query: str) -> Optional[Dict[str, Any]]:
        """Check if a query exists in cache"""
        if not self.enabled or not query:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/cache",
                    json={"query": query},
                    headers={
                        "Content-Type": "application/json",
                        "X-API-Key": self.api_key
                    },
                    timeout=2.0  # Short timeout for cache check
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("hit") and data.get("response"):
                        return data
                        
        except Exception as e:
            logger.warning(f"Cache check failed: {str(e)}")
        
        return None
    
    async def save(self, query: str, response: str) -> None:
        """Save a response to cache (fire and forget)"""
        if not self.enabled or not query or not response:
            return
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.api_url}/cache",
                    json={
                        "query": query,
                        "response": response
                    },
                    headers={
                        "Content-Type": "application/json",
                        "X-API-Key": self.api_key
                    },
                    timeout=5.0
                )
                logger.info(f"Cached response for query: {query[:50]}...")
        except Exception as e:
            logger.warning(f"Failed to save to cache: {str(e)}")
    
    def build_streaming_response(self, cached_content: str, model: str) -> StreamingResponse:
        """Build a streaming response from cached content"""
        async def stream_cached_response():
            # Send initial chunk
            chunk = {
                "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {
                        "role": "assistant",
                        "content": cached_content
                    },
                    "finish_reason": None
                }]
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            
            # Send final chunk with finish reason
            final_chunk = {
                "id": chunk["id"],
                "object": "chat.completion.chunk",
                "created": chunk["created"],
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0
                }
            }
            yield f"data: {json.dumps(final_chunk)}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            stream_cached_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
    
    def build_completion_response(self, cached_content: str, model: str) -> Response:
        """Build a completion response from cached content"""
        response_data = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": cached_content
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            }
        }
        
        return Response(
            content=json.dumps(response_data),
            status_code=200,
            media_type="application/json",
        )


# Global cache service instance
cache_service = CacheService()