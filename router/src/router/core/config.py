import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_PUBLIC_KEY = os.getenv("SUPABASE_PUBLIC_KEY")
JWT_SECRET = os.getenv(
    "SUPABASE_JWT_SECRET"
)  # This should be the same as your Supabase JWT secret

NODE_SERVICE_URL = os.getenv("NODE_SERVICE_URL")

# LiteLLM Configuration
LITELLM_API_KEY = os.getenv("LITELLM_API_KEY")
LITELLM_API_URL = os.getenv("LITELLM_API_URL", "http://localhost:4000")
LITELLM_MASTER_KEY = os.getenv("LITELLM_MASTER_KEY", "")

# OpenSearch Configuration
OPENSEARCH_BASE_URL = os.getenv("OPENSEARCH_BASE_URL", "")
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "")

# Data Stream API Configuration
DATA_STREAM_API_URL = os.getenv("DATA_STREAM_API_URL", "")
DATA_STREAM_SERVICE_KEY = os.getenv("DATA_STREAM_SERVICE_KEY", "")

# Cache Configuration
ENABLE_CACHE = os.getenv("ENABLE_CACHE", "false").lower() == "true"
CACHE_API_URL = os.getenv("CACHE_API_URL", "http://localhost:3000")
CACHE_API_KEY = os.getenv("CACHE_API_KEY", "your-secret-api-key")

# Grafana Configuration
GRAFANA_API_URL = os.getenv("GRAFANA_API_URL", "http://localhost:3005")
GRAFANA_API_KEY = os.getenv("GRAFANA_API_KEY", "")
