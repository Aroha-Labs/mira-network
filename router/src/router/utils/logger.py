import logging
import sys
import os

# Get log level from environment variable, default to INFO if not specified
LOG_LEVEL = os.getenv("LOG_LEVEL", "ERROR").upper()

# Map string to logging level
LOG_LEVEL_MAP = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL
}

# Configure logger
logger = logging.getLogger("router")
logger.setLevel(LOG_LEVEL_MAP.get(LOG_LEVEL, logging.INFO))

# Create console handler with formatter
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)

# Add handler to logger
logger.addHandler(handler)

# Prevent propagation to root logger
logger.propagate = False

# Log the current level for verification during startup
logger.info(f"Logger initialized with level: {LOG_LEVEL}")
