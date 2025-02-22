from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from uuid import UUID
from uuid import uuid4
from datetime import datetime

from src.router.schemas.ai import AiRequest
from src.router.models.thread import Thread, Message
from src.router.models.user import User
from src.router.db.session import DBSession
from src.router.core.security import verify_token
from pydantic import BaseModel, Field


router = APIRouter()


class ThreadCreate(BaseModel):
    title: Optional[str] = None
    metadata: dict = {}


class MessageCreate(BaseModel):
    content: str
    role: str = Field(default="user")
    thread_id: Optional[UUID] = None  # Optional for lazy thread creation
    tool_calls: Optional[List[dict]] = None
    parent_message_id: Optional[UUID] = None
    metadata: dict = {}
    model: Optional[str] = None  # For AI generation
    stream: bool = False  # For streaming responses


class ThreadResponse(BaseModel):
    id: UUID
    title: str
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    thread_metadata: dict
    is_archived: bool


class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    role: str
    content: str
    tool_calls: Optional[List[dict]]
    created_at: datetime
    message_metadata: dict
    parent_message_id: Optional[UUID]


async def create_thread_from_message(
    message: MessageCreate,
    user: User,
    db: DBSession,
) -> Thread:
    """Create a new thread from the first message"""
    # Generate title from first message if not provided
    title = (
        message.content[:50] + "..." if len(message.content) > 50 else message.content
    )

    db_thread = Thread(
        title=title,
        user_id=user.id,
        thread_metadata={},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        id=uuid4(),
    )
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    return db_thread


@router.post("/v1/threads", response_model=ThreadResponse)
async def create_thread(
    thread: ThreadCreate,
    db: DBSession,
    current_user: User = Depends(verify_token),
):
    """Create a new thread explicitly"""
    if not thread.title:
        raise HTTPException(
            status_code=400, detail="Title is required for explicit thread creation"
        )

    db_thread = Thread(
        title=thread.title,
        user_id=current_user.id,
        thread_metadata=thread.metadata if thread.metadata else {},
    )
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    return db_thread


@router.get("/v1/threads", response_model=List[ThreadResponse])
async def list_threads(
    db: DBSession,
    current_user: User = Depends(verify_token),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, le=100),
):
    """List all threads for the current user"""
    query = (
        select(Thread)
        .where(Thread.user_id == str(current_user.id))
        .offset(skip)
        .limit(limit)
        .order_by(Thread.updated_at.desc())
    )
    threads = await db.exec(query)
    threads = threads.all()

    # Convert thread_metadata to dict before returning
    for thread in threads:
        # Handle both MetaData and dict cases
        thread.thread_metadata = (
            dict(thread.thread_metadata) if thread.thread_metadata else {}
        )
    return threads


@router.get("/v1/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: UUID,
    db: DBSession,
    current_user: User = Depends(verify_token),
):
    """Get a specific thread"""
    thread = await db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if str(thread.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=403, detail="Not authorized to access this thread"
        )
    return thread


@router.delete("/v1/threads/{thread_id}")
async def archive_thread(
    thread_id: UUID,
    db: DBSession,
    current_user: User = Depends(verify_token),
):
    """Archive a thread"""
    thread = await db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if str(thread.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=403, detail="Not authorized to access this thread"
        )

    thread.is_archived = True
    db.add(thread)
    db.commit()
    return {"status": "success"}


@router.post("/v1/messages")
async def create_message(
    message: MessageCreate,
    db: DBSession,
    current_user: User = Depends(verify_token),
):
    # If no thread_id, create a new thread
    if not message.thread_id:
        thread = Thread(
            title=(
                message.content[:50] + "..."
                if len(message.content) > 50
                else message.content
            ),
            user_id=current_user.id,
            thread_metadata={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            id=uuid4(),
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
    else:
        # Get existing thread
        thread = await db.get(Thread, message.thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        if str(thread.user_id) != str(current_user.id):
            raise HTTPException(
                status_code=403, detail="Not authorized to access this thread"
            )

    # Create the user's message
    db_message = Message(
        thread_id=thread.id,
        role=message.role or "user",
        content=message.content,
        tool_calls=message.tool_calls if message.tool_calls else [],
        parent_message_id=message.parent_message_id,
        message_metadata=message.metadata if message.metadata else {},
        created_at=datetime.utcnow(),
        id=uuid4(),
    )

    # Update thread's updated_at timestamp
    thread.updated_at = datetime.utcnow()
    db.add(db_message)
    db.add(thread)
    db.commit()
    db.refresh(db_message)

    # If model is specified, generate AI response
    if message.model:
        from src.router.api.v1.network import generate
        from fastapi.responses import StreamingResponse
        import json
        from typing import AsyncGenerator

        # Get all previous messages from the thread if it exists
        thread_messages = []
        if db_message.thread_id:
            query = (
                select(Message)
                .where(Message.thread_id == db_message.thread_id)
                .order_by(Message.created_at)
            )
            thread_messages = await db.exec(query)
            thread_messages = [
                {"role": msg.role, "content": msg.content}
                for msg in thread_messages.all()
            ]

        # Add the current message
        thread_messages.append({"role": "user", "content": message.content})

        ai_request = AiRequest(
            model=message.model,
            messages=thread_messages,
            stream=message.stream,
        )

        # Create placeholder AI message
        ai_message = Message(
            thread_id=thread.id,
            role="assistant",
            content="",  # Will be updated after streaming
            parent_message_id=db_message.id,
            message_metadata={},
            tool_calls=[],
            created_at=datetime.utcnow(),
            id=uuid4(),
        )
        db.add(ai_message)
        db.commit()

        if message.stream:

            async def content_stream() -> AsyncGenerator[bytes, None]:
                accumulated_content = []
                try:
                    response = await generate(req=ai_request, db=db, user=current_user)

                    async for chunk in response.body_iterator:
                        if chunk:
                            chunk_str = (
                                chunk.decode() if isinstance(chunk, bytes) else chunk
                            )
                            if chunk_str.startswith("data: "):
                                try:
                                    data = json.loads(chunk_str[6:])
                                    if (
                                        "choices" in data
                                        and len(data["choices"]) > 0
                                        and "delta" in data["choices"][0]
                                        and "content" in data["choices"][0]["delta"]
                                    ):
                                        content = data["choices"][0]["delta"]["content"]
                                        if content:
                                            accumulated_content.append(content)
                                            yield f"data: {json.dumps({'choices': [{'delta': {'content': content}}]})}\n".encode()
                                except json.JSONDecodeError:
                                    continue

                    # After streaming is done, update the AI message
                    ai_message.content = "".join(accumulated_content)
                    db.add(ai_message)
                    db.commit()

                    # Send final message with thread_id
                    yield f"data: {json.dumps({'thread_id': str(thread.id)})}\n".encode()

                except Exception as e:
                    print(f"Error in streaming: {e}")
                    yield f"data: {json.dumps({'error': str(e)})}\n".encode()

            return StreamingResponse(
                content_stream(),
                media_type="text/event-stream",
                headers={
                    "X-Thread-Id": str(thread.id),
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Content-Type": "text/event-stream",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Expose-Headers": "X-Thread-Id",
                },
            )
        else:
            # For non-streaming responses
            response = await generate(req=ai_request, db=db, user=current_user)
            ai_response = await response.json()

            # Update AI message with response
            if "choices" in ai_response and len(ai_response["choices"]) > 0:
                ai_message.content = ai_response["choices"][0]["message"]["content"]
                db.add(ai_message)
                db.commit()
                db.refresh(ai_message)

            return MessageResponse(
                id=ai_message.id,
                thread_id=thread.id,
                role=ai_message.role,
                content=ai_message.content,
                tool_calls=ai_message.tool_calls,
                parent_message_id=ai_message.parent_message_id,
                message_metadata=ai_message.message_metadata,
                created_at=ai_message.created_at,
            )

    return MessageResponse(
        id=db_message.id,
        thread_id=thread.id,
        role=db_message.role,
        content=db_message.content,
        tool_calls=db_message.tool_calls,
        parent_message_id=db_message.parent_message_id,
        message_metadata=db_message.message_metadata,
        created_at=db_message.created_at,
    )


@router.get("/v1/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    thread_id: UUID,
    db: DBSession,
    current_user: User = Depends(verify_token),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=100),
):
    """Get messages in a thread"""
    thread = await db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if str(thread.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=403, detail="Not authorized to access this thread"
        )

    query = (
        select(Message)
        .where(Message.thread_id == thread_id)
        .offset(skip)
        .limit(limit)
        .order_by(Message.created_at)
    )
    messages = await db.exec(query)
    return messages.all()


@router.get(
    "/v1/threads/{thread_id}/messages/{message_id}",
    response_model=MessageResponse,
)
async def get_message(
    thread_id: UUID,
    message_id: UUID,
    db: DBSession,
    current_user: User = Depends(verify_token),
):
    """Get a specific message"""
    thread = await db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if str(thread.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=403, detail="Not authorized to access this thread"
        )

    message = await db.get(Message, message_id)
    if not message or message.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Message not found")

    return message
