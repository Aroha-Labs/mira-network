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

# S3 Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
S3_PREFIX = os.getenv("S3_PREFIX", "uploads/images")  # Prefix for organizing files in the bucket
