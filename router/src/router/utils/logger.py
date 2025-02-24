import logging
import sys

# Configure logger
logger = logging.getLogger("router")
logger.setLevel(logging.INFO)

# Create console handler with formatter
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)

# Add handler to logger
logger.addHandler(handler)

# Prevent propagation to root logger
logger.propagate = False
