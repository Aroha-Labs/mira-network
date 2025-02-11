import logging
from sqlalchemy import DDL, event
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text
from .user import User

# Configure logging
logger = logging.getLogger(__name__)

# SQL to create the trigger function
CREDIT_TRIGGER_FUNCTION = """
CREATE OR REPLACE FUNCTION notify_low_credits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.credits <= 0 AND NEW.auto_credit = true THEN
        -- Log the low credits event
        RAISE NOTICE 'Low credits detected for user %: Current credits = %', NEW.user_id, NEW.credits;
        
        -- Notify about low credits with user_id as payload
        PERFORM pg_notify(
            'low_credits',
            json_build_object(
                'user_id', NEW.user_id,
                'current_credits', NEW.credits
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# SQL to create the trigger
CREATE_TRIGGER = """
DROP TRIGGER IF EXISTS user_credits_trigger ON "user";
CREATE TRIGGER user_credits_trigger
    AFTER UPDATE OF credits
    ON "user"
    FOR EACH ROW
    EXECUTE FUNCTION notify_low_credits();
"""

def setup_credit_triggers(engine):
    """Setup the PostgreSQL triggers and functions for credit monitoring."""
    try:
        logger.info("Setting up credit monitoring triggers...")
        with engine.connect() as conn:
            logger.debug("Creating trigger function...")
            conn.execute(text(CREDIT_TRIGGER_FUNCTION))
            
            logger.debug("Creating trigger...")
            conn.execute(text(CREATE_TRIGGER))
            
            conn.commit()
            logger.info("Credit monitoring triggers setup successfully")
    except Exception as e:
        logger.error(f"Failed to setup credit triggers: {str(e)}")
        raise
