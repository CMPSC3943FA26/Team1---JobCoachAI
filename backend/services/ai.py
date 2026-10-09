from backend.AI.AI_test import main_request_combined

def tailor_resume(resume_id:str,job:object,user_id:str):
    return main_request_combined(resume_id, job, user_id)
