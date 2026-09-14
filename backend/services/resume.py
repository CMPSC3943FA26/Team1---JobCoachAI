from datetime import date, datetime
from uuid import UUID

from backend.supabase_client import supabase
from backend.schemas.resume import ResumeSaveRequest


def _to_json_safe(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, list):
        return [_to_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_json_safe(item) for key, item in value.items()}
    return value


def create_resume(data: ResumeSaveRequest, user_id: str):
    resume_payload = _to_json_safe(data.resume.dict(exclude_unset=True))

    resume_row = supabase.table('resumes').insert({
        **resume_payload,
        'user_id': user_id,
    }).execute()

    resume_id = resume_row.data[0]['id']

    for section_name, rows in [
        ('work_experience', data.work_experience),
        ('education', data.education),
        ('skills', data.skills),
        ('projects', data.projects),
        ('certifications', data.certifications),
    ]:
        if rows:
            payload = [
                {**_to_json_safe(row.dict()), 'resume_id': resume_id}
                for row in rows
            ]
            supabase.table(section_name).insert(payload).execute()

    return get_resume(resume_id, user_id)


def get_resume(resume_id: str, user_id: str):
    resume = supabase.table("resumes").select("*, work_experience(*), education(*), skills(*), projects(*), certifications(*)").eq("id", resume_id).eq("user_id", user_id).execute()
    return resume.data[0] if resume.data else None