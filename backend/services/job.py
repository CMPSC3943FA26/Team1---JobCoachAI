from backend.supabase_client import supabase


def create_job(user_id, job_data):
    response = supabase.table("jobs").insert({
        "user_id": user_id,
        "title": job_data.title,
        "description": job_data.description,
        "company": job_data.company,
        "source": job_data.source
    }).execute()

    return response


def get_job(user_id, job_id):
    response = supabase.table("jobs") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("id", job_id) \
        .execute()

    return response


def update_job(job_id, user_id, job_data):
    response = supabase.table("jobs").update({
        "title": job_data.title,
        "description": job_data.description,
        "company": job_data.company,
        "source": job_data.source
    }).eq("id", job_id).eq("user_id", user_id).execute()

    return response


def delete_job(user_id, job_id):
    response = supabase.table("jobs") \
        .delete() \
        .eq("id", job_id) \
        .eq("user_id", user_id) \
        .execute()

    return response
