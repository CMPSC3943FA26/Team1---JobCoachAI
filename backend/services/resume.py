from datetime import date, datetime
from uuid import UUID

from backend.supabase_client import supabase
from backend.schemas.resume import ResumeSaveRequest, ResumeUpdateRequest

# jsonify values to stop errors
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

#create a new resume
def create_resume(data: ResumeSaveRequest, user_id: str):
    resume_payload = _to_json_safe(data.resume.dict(exclude_unset=True))

    resume_row = supabase.table('resumes').insert({
        **resume_payload,
        'user_id': str(user_id),
    }).execute()

    resume_id = resume_row.data[0]['id']

    for section_name, rows in [
        ('work_experience', data.work_experience),
        ('education', data.education),
        ('skills', data.skills),
        ('projects', data.projects),
        ('certifications', data.certifications),
        ('section_order', data.section_order),
    ]:
        if rows:
            payload = [
                {**_to_json_safe(row.dict()), 'resume_id': resume_id}
                for row in rows
            ]
            supabase.table(section_name).insert(payload).execute()

    return get_resume(resume_id, user_id)

# get the resume as a dict from the database
def get_resume(resume_id: str, user_id: str):
    resume = supabase.table("resumes").select("*, work_experience(*), education(*), skills(*), projects(*), certifications(*),section_order(*)").eq("id", resume_id).eq("user_id", user_id).execute()
    return resume.data[0] if resume.data else None

#delete resume from database
def delete_resume(resume_id: str, user_id: str):
    if not get_resume(resume_id,user_id):
        return None
    supabase.table("resumes").delete().eq("id", resume_id).eq("user_id", user_id).execute()
    return True

#update resume tables
def update_resume(resume_id: str, user_id: str, data: ResumeUpdateRequest):
    if not get_resume(resume_id, user_id):
        return None

    resume_payload = _to_json_safe(data.resume.dict(exclude_unset=True))
    supabase.table("resumes").update(resume_payload).eq(
        "id", resume_id
    ).eq("user_id", user_id).execute()

    provided_fields = getattr(data, "model_fields_set", None)
    if provided_fields is None:
        provided_fields = data.__fields_set__

    for table, rows in [
        ("work_experience", data.work_experience),
        ("education", data.education),
        ("skills", data.skills),
        ("projects", data.projects),
        ("certifications", data.certifications),
        ("section_order", data.section_order),
    ]:
        if table not in provided_fields:
            continue

        existing_response = (
            supabase.table(table)
            .select("id")
            .eq("resume_id", resume_id)
            .execute()
        )
        existing_ids = {
            str(row["id"])
            for row in (existing_response.data or [])
            if row.get("id") is not None
        }
        submitted_ids = set()

        for row_model in rows:
            row = _to_json_safe(row_model.dict(exclude_unset=True))
            row_id = row.pop("id", None)

            if row_id is not None:
                row_id = str(row_id)
                submitted_ids.add(row_id)
                supabase.table(table).update(row).eq(
                    "resume_id", resume_id
                ).eq("id", row_id).execute()
            else:
                supabase.table(table).insert(
                    {**row, "resume_id": resume_id}
                ).execute()

        for row_id in existing_ids - submitted_ids:
            supabase.table(table).delete().eq(
                "resume_id", resume_id
            ).eq("id", row_id).execute()

    return get_resume(resume_id, user_id)

