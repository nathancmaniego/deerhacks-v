from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


async def init_db():
    """Verify Supabase connection with a lightweight query."""
    supabase.table("users").select("id").limit(1).execute()
