import json
import logging
import sys
from redis.asyncio import Redis
import requests
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)

# Configuration
REDIS_URL = ""  # Update this with your Redis URL
REDIS_PASSWORD = ""
REDIS_USERNAME = ""
DISCORD_WEBHOOK_URL = "https://discord.com/api/**"
CREDIT_THRESHOLD = 100  # Alert when credits go below this value

KEYS = ["user_credit:3edf8858"]


class CreditNotifier:
    def __init__(self, redis_url: str):
        self.redis_client = Redis.from_url(
            redis_url, password=REDIS_PASSWORD, username=REDIS_USERNAME
        )
        self.pubsub = self.redis_client.pubsub()

    async def setup_keyspace_notifications(self):
        """Enable keyspace notifications for key changes."""
        await self.redis_client.config_set("notify-keyspace-events", "KEA")
        logger.info("Enabled keyspace notifications")

    async def send_discord_notification(self, user_id: str, credits: float):
        """Send a notification to Discord about low credits."""
        try:
            # Calculate percentage of threshold remaining
            percent_remaining = (credits / CREDIT_THRESHOLD) * 100

            # Simple color coding based on severity
            if percent_remaining <= 25:
                color = 15158332  # Red
                status = "CRITICAL"
            elif percent_remaining <= 50:
                color = 16776960  # Yellow
                status = "WARNING"
            else:
                color = 4037724  # Blue
                status = "NOTICE"

            message = {
                "embeds": [
                    {
                        "title": f"{status}: Low Credits Alert",
                        "color": color,
                        "fields": [
                            {
                                "name": "User ID",
                                "value": f"```{user_id}```",
                                "inline": True,
                            },
                            {
                                "name": "Current Credits",
                                "value": f"```{credits:,.2f}```",
                                "inline": True,
                            },
                        ],
                        "description": f"Credits have fallen to {percent_remaining:.1f}% of threshold.",
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                ]
            }

            response = requests.post(DISCORD_WEBHOOK_URL, json=message)
            if response.status_code != 204:
                logger.warning(
                    f"Failed to send Discord notification: {response.status_code} - {response.text}"
                )
            else:
                logger.info(f"Successfully sent low credits alert for user {user_id}")

        except Exception as e:
            logger.error(f"Error sending Discord notification: {str(e)}", exc_info=True)

    async def start_listening(self):
        """Start listening for credit value changes in Redis."""
        logger.info(
            f"Starting credit notification service (threshold: {CREDIT_THRESHOLD:,})..."
        )

        try:
            await self.setup_keyspace_notifications()

            # Subscribe only to the specific keys we want to monitor
            for key in KEYS:
                channel = f"__keyspace@0__:{key}"
                await self.pubsub.psubscribe(channel)
                logger.info(f"Subscribed to notifications for {key}")

            logger.info("Listening for credit changes...")

            async for message in self.pubsub.listen():
                try:
                    print("message", message)  # Debug: Print all messages
                    if message["type"] == "pmessage":
                        # Extract the full key from the channel
                        key = message["channel"].decode("utf-8").split(":", 2)[2]

                        print("key", key)  # Debug: Print the key

                        value = await self.redis_client.get("user_credit:" + key)
                        print("value", value)  # Debug: Print the value
                        if value is not None:
                            decoded_value = (
                                value.decode("utf-8")
                                if isinstance(value, bytes)
                                else str(value)
                            )
                            credits = float(decoded_value)

                            print("credits", credits)  # Debug: Print the credits

                            if credits < CREDIT_THRESHOLD:
                                user_id = key  # Extract UUID from key
                                logger.info(
                                    f"Low credits detected - User: {user_id}, Credits: {credits}"
                                )
                                await self.send_discord_notification(user_id, credits)

                except Exception as e:
                    logger.error(f"Error processing message {message}: {str(e)}")
                    continue  # Continue listening even if one message fails

        except Exception as e:
            logger.error(f"Redis error: {str(e)}", exc_info=True)
            raise
        finally:
            await self.pubsub.close()
            await self.redis_client.close()


async def main():
    """Main entry point for the credit notification service."""
    try:
        notifier = CreditNotifier(REDIS_URL)
        await notifier.start_listening()
    except KeyboardInterrupt:
        logger.info("Shutting down credit notification service...")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
