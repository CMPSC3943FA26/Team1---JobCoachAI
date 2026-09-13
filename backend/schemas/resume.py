# schemas/resume.py
from datetime import date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


# ---------- Work Experience ----------

class WorkExperienceCreate(BaseModel):
    job_title: str
    company: str
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    description: str
    sort_order: Optional[int] = None





# ---------- Education ----------

class EducationCreate(BaseModel):
    school: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort_order: Optional[int] = None




# ---------- Skill ----------

class SkillCreate(BaseModel):
    skill_name: str
    sort_order: Optional[int] = None



# ---------- Project ----------

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    link: Optional[str] = None
    sort_order: Optional[int] = None

# ---------- Certification ----------

class CertificationCreate(BaseModel):
    name: str
    issuer: Optional[str] = None
    date_earned: Optional[date] = None
    sort_order: Optional[int] = None




# ---------- Resume ----------

class ResumeCreate(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    professional_summary: Optional[str] = None





class ResumeSaveRequest(BaseModel):
    """Full save: resume fields + all six sections at once."""
    resume: ResumeCreate
    work_experience: list[WorkExperienceCreate] = []
    education: list[EducationCreate] = []
    skills: list[SkillCreate] = []
    projects: list[ProjectCreate] = []
    certifications: list[CertificationCreate] = []

