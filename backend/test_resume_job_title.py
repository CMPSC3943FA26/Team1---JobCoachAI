from unittest.mock import MagicMock, patch

import pytest

from backend.schemas.resume import (
    ResumeCreate,
    ResumeSaveRequest,
    ResumeUpdate,
    ResumeUpdateRequest,
)
from backend.services import resume as resume_service


def _resume_payload():
    return {
        "title": "Product Designer Resume",
        "job_title": "Senior Product Designer",
        "full_name": "Jordan Lee",
        "email": "jordan@example.com",
    }


def test_resume_create_keeps_resume_name_and_job_title_separate():
    model = ResumeCreate(**_resume_payload())

    assert model.title == "Product Designer Resume"
    assert model.job_title == "Senior Product Designer"


@pytest.mark.parametrize(
    ("resume_name", "job_title"),
    [
        ("Product Designer Resume", "Senior Product Designer"),
        ("Product Designer Resume", "Staff Product Designer"),
    ],
)
def test_create_resume_persists_both_titles_independently(resume_name, job_title):
    payload = {
        **_resume_payload(),
        "title": resume_name,
        "job_title": job_title,
    }
    request = ResumeSaveRequest(resume=ResumeCreate(**payload))
    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "resume-id"},
    ]

    with (
        patch.object(resume_service, "supabase", supabase),
        patch.object(resume_service, "get_resume", return_value={
            "id": "resume-id",
            **payload,
        }),
    ):
        result = resume_service.create_resume(request, "user-id")

    inserted = supabase.table.return_value.insert.call_args.args[0]
    assert inserted["title"] == resume_name
    assert inserted["job_title"] == job_title
    assert result["title"] == resume_name
    assert result["job_title"] == job_title


def test_update_resume_keeps_resume_name_and_job_title_separate():
    request = ResumeUpdateRequest(
        resume=ResumeUpdate(**_resume_payload())
    )
    supabase = MagicMock()
    with (
        patch.object(resume_service, "supabase", supabase),
        patch.object(resume_service, "get_resume", side_effect=[{"id": "resume-id"}, {
            "id": "resume-id",
            **_resume_payload(),
        }]),
    ):
        result = resume_service.update_resume(
            "resume-id",
            "user-id",
            request,
        )

    updates = [
        call.args[0]
        for call in supabase.table.return_value.update.call_args_list
    ]
    assert updates == [{
        "title": "Product Designer Resume",
        "job_title": "Senior Product Designer",
        "full_name": "Jordan Lee",
        "email": "jordan@example.com",
    }]
    assert result["title"] == "Product Designer Resume"
    assert result["job_title"] == "Senior Product Designer"


def test_create_resume_persists_education_description():
    request = ResumeSaveRequest(
        resume=ResumeCreate(**_resume_payload()),
        education=[{
            "school": "Example University",
            "degree": "B.S.",
            "field_of_study": "Computer Science",
            "description": "Relevant coursework: database systems.",
            "sort_order": 0,
        }],
    )
    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "resume-id"},
    ]
    returned_resume = {
        "id": "resume-id",
        "education": [{
            "school": "Example University",
            "description": "Relevant coursework: database systems.",
        }],
    }

    with (
        patch.object(resume_service, "supabase", supabase),
        patch.object(resume_service, "get_resume", return_value=returned_resume),
    ):
        result = resume_service.create_resume(request, "user-id")

    education_insert = supabase.table.return_value.insert.call_args_list[1].args[0]
    assert education_insert[0]["description"] == (
        "Relevant coursework: database systems."
    )
    assert result["education"][0]["description"] == (
        "Relevant coursework: database systems."
    )
