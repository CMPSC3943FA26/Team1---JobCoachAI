from backend.supabase_client import supabase
from backend.models.resume import ResumeSaveRequest

def create_resume(data: ResumeSaveRequest, user_id: str):
    resume_row = supabase.table('resumes').insert({
        **data.resume.dict(exclude_unset=True),
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
            supabase.table(section_name).insert([
                {**row.dict(), 'resume_id': resume_id} for row in rows
            ]).execute()

    return get_resume(resume_id, user_id)
def get_resume(resume_id: str, user_id: str):
    resume = supabase.table("resumes").select("*, work_experience(*), education(*), skills(*), projects(*), certifications(*)").eq("id", resume_id).eq("user_id", user_id).execute()
    return resume.data[0] if resume.data else None