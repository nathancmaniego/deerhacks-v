from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()
# Prefer service_role key so backend can insert/update without RLS blocking (never expose this key to the frontend)
_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
supabase: Client = create_client(settings.SUPABASE_URL, _key)


async def init_db():
    """Verify Supabase connection with a lightweight query."""
    supabase.table("users").select("id").limit(1).execute()
