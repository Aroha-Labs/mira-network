import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_PUBLIC_KEY = os.getenv("SUPABASE_PUBLIC_KEY")
JWT_SECRET = os.getenv(
    "SUPABASE_JWT_SECRET"
)  # This should be the same as your Supabase JWT secret

MACHINE_ALB_URL = os.getenv("MACHINE_ALB_URL")
