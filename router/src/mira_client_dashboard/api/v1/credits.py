from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.mira_client_dashboard.models.credits import UserCredits, UserCreditsHistory
from src.mira_client_dashboard.schemas.credits import AddCreditRequest
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.core.security import verify_token

router = APIRouter()


@router.post("/add-credit")
def add_credit(request: AddCreditRequest, db: Session = Depends(get_session)):
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == request.user_id)
    ).first()

    if user_credits:
        user_credits.credits += request.amount
    else:
        user_credits = UserCredits(user_id=request.user_id, credits=request.amount)
        db.add(user_credits)

    credit_history = UserCreditsHistory(
        user_id=request.user_id,
        amount=request.amount,
        description=request.description,
    )
    db.add(credit_history)
    db.commit()

    return {"credits": user_credits.credits}


@router.get("/user-credits")
def get_user_credits(db: Session = Depends(get_session), user=Depends(verify_token)):
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == user.id)
    ).first()
    return {"credits": user_credits.credits if user_credits else 0}


@router.get("/user-credits-history")
def get_user_credits_history(
    db: Session = Depends(get_session), user=Depends(verify_token)
):
    history = db.exec(
        select(UserCreditsHistory)
        .where(UserCreditsHistory.user_id == user.id)
        .order_by(UserCreditsHistory.created_at.desc())
    ).all()
    return history
