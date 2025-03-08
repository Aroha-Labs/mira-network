from fastapi import HTTPException
from sqlmodel import select
from src.router.db.session import DBSession
from src.router.utils.redis import redis_client
from src.router.models.user import User as UserModel


async def get_user_credits(user_id: int, db: DBSession):
    redis_key = f"user_credit:{user_id}"
    current_credit = await redis_client.get(redis_key)

    if current_credit is not None:
        current_credit = float(current_credit)
        return current_credit

    user_credits = await db.exec(
        select(UserModel.credits).where(UserModel.user_id == user_id)
    )
    user_credits = user_credits.one_or_none()
    if user_credits is None:
        raise HTTPException(status_code=404, detail="User not found")

    current_credit = user_credits
    await redis_client.set(redis_key, current_credit)
    return current_credit
