import json
import os
import select
import psycopg2
import psycopg2.extensions
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Optional
import logging
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Add the project root to Python path when running as script
if __name__ == "__main__":
    project_root = str(Path(__file__).parent.parent.parent.parent)
    sys.path.insert(0, project_root)

from src.router.models.user import User

logger = logging.getLogger(__name__)


class CreditListener:
    def __init__(self, db_url: str, default_refill_amount: float = 100.0):
        self.db_url = db_url
        # Convert SQLAlchemy URL to psycopg2 format if needed
        self.psycopg2_url = db_url.replace("postgresql+psycopg2://", "postgresql://")
        self.default_refill_amount = default_refill_amount
        self.conn = None
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)

    def connect(self):
        """Establish connection to PostgreSQL for LISTEN/NOTIFY."""
        if self.conn is None or self.conn.closed:
            self.conn = psycopg2.connect(self.psycopg2_url)
            self.conn.set_isolation_level(
                psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT
            )
            cur = self.conn.cursor()
            cur.execute("LISTEN low_credits;")
            logger.info(
                "Connected to PostgreSQL and listening for low_credits notifications"
            )

    def refill_credits(self, user_id: str, amount: Optional[float] = None) -> bool:
        """Refill credits for a user."""
        refill_amount = amount or self.default_refill_amount

        try:
            session = self.Session()
            user = session.query(User).filter(User.user_id == user_id).first()

            if user and user.auto_credit:
                previous_credits = user.credits
                user.credits += refill_amount
                session.add(user)
                session.commit()
                logger.info(
                    f"Refilled credits for user {user_id}: {previous_credits} -> {user.credits} (+{refill_amount})"
                )
                return True

            if not user:
                logger.warning(
                    f"Attempted to refill credits for non-existent user: {user_id}"
                )
            elif not user.auto_credit:
                logger.info(
                    f"Skipped credit refill for user {user_id}: auto_credit is disabled"
                )
            return False
        except Exception as e:
            logger.error(
                f"Error refilling credits for user {user_id}: {str(e)}", exc_info=True
            )
            return False
        finally:
            session.close()

    def start_listening(self):
        """Start listening for credit notifications."""
        logger.info("Starting credit listener service...")
        self.connect()

        while True:
            if select.select([self.conn], [], [], 5) == ([], [], []):
                # Timeout - check connection
                try:
                    cur = self.conn.cursor()
                    cur.execute("SELECT 1")
                except Exception as e:
                    logger.warning(
                        f"Lost database connection, reconnecting... Error: {str(e)}"
                    )
                    self.connect()
                continue

            self.conn.poll()
            while self.conn.notifies:
                notify = self.conn.notifies.pop()
                try:
                    logger.debug(f"Received notification: {notify.payload}")
                    payload = json.loads(notify.payload)
                    user_id = payload.get("user_id")
                    current_credits = payload.get("current_credits")

                    if user_id:
                        logger.info(
                            f"Processing low credits notification for user {user_id} (current credits: {current_credits})"
                        )
                        self.refill_credits(user_id, 10)
                    else:
                        logger.warning("Received notification without user_id")
                except json.JSONDecodeError:
                    logger.error(f"Invalid notification payload: {notify.payload}")
                except Exception as e:
                    logger.error(
                        f"Error processing notification: {str(e)}", exc_info=True
                    )


def start_credit_listener(db_url: str):
    """Start the credit listener service."""
    listener = CreditListener(db_url)
    listener.start_listening()


if __name__ == "__main__":
    DATABASE_URL = os.getenv("DB_CONNECTION_STRING")
    if not DATABASE_URL:
        print("Error: DATABASE_URL environment variable is not set")
        sys.exit(1)

    print("Starting credit listener service...")
    start_credit_listener(DATABASE_URL)
