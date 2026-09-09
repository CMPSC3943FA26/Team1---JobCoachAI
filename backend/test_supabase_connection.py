import os

from dotenv import load_dotenv
from supabase import create_client


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or key in backend/.env. "
        "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)."
    )


supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def main():
    try:
        response = supabase.auth.get_session()
        print("✅ Supabase connection successful.")
        print(f"Project URL: {SUPABASE_URL}")
        print(f"Session data: {response}")
    except Exception as exc:
        print("❌ Supabase connection failed.")
        print(f"Error: {type(exc).__name__}: {exc}")
        raise


if __name__ == "__main__":
    main()
