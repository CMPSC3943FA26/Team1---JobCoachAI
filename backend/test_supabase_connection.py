import os
from datetime import date
from backend.supabase_client import supabase
from dotenv import load_dotenv

from backend.schemas.resume import (
    ResumeSaveRequest,
    ResumeCreate,
    WorkExperienceCreate,
    SkillCreate,
    ProjectCreate,
)
from backend.services.resume import create_resume


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")


if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or key in backend/.env. "
        "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)."
    )
auth_response = supabase.auth.sign_in_with_password(
    {
        "email": "jobcoachai6@gmail.com",
        "password": os.getenv("test_user_password")
    }
)
user_id = auth_response.user.id
def main():
    request = ResumeSaveRequest(
        resume=ResumeCreate(
            full_name="test user",
            email="jobcoachai6@gmail.com",
            phone="123-456-7890",
            location="Ada, OK",
            professional_summary="A long professional summary.",
        ),
        work_experience=[
            WorkExperienceCreate(
                job_title="Software Engineer",
                company="Tech Company",
                location="San Francisco, CA",
                start_date=date(2020, 1, 1),
                end_date=date(2022, 12, 31),
                description="Developed and maintained web applications.",
                sort_order=1,
            )
        ],
        skills=[
            SkillCreate(skill_name="Python", sort_order=1),
        ],
        projects=[
            ProjectCreate(
                name="Project A",
                description="A project description.",
                link="https://example.com/project-a",
                sort_order=1,
            )
        ]
    )

    result = create_resume(
        request,
        user_id,
    )
    print(f"Resume created successfully: {result}")


if __name__ == "__main__":
    main()
