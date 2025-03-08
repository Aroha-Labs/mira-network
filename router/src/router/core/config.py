import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_PUBLIC_KEY = os.getenv("SUPABASE_PUBLIC_KEY")
JWT_SECRET = os.getenv(
    "SUPABASE_JWT_SECRET"
)  # This should be the same as your Supabase JWT secret

NODE_SERVICE_URL = os.getenv("NODE_SERVICE_URL")

# OpenSearch Configuration
OPENSEARCH_BASE_URL = os.getenv("OPENSEARCH_BASE_URL", "")
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "")
