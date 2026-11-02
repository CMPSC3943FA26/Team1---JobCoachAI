<<<<<<< Updated upstream
from backend.AI.AI_test import main_request_combined

def tailor_resume(resume_id:str,job:object,user_id:str,request_id=None):
    return main_request_combined(
        resume_id, job, user_id, request_id=request_id
    )
=======
from backend.AI.AI_test import main_request_combined,regenerate
def tailor_resume(resume_id:str,job:object,user_id:str):
    return main_request_combined(resume_id, job, user_id)
def regenerate_resume(current_resume,job,requirements):
    regenerate(current_resume,job,requirements)

    
>>>>>>> Stashed changes
