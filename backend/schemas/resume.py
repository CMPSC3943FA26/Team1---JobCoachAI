# schemas/resume.py
from datetime import date
from typing import Optional
from pydantic import BaseModel
from uuid import UUID


# ---------- Work Experience ----------

class WorkExperienceCreate(BaseModel):
    job_title: str
    company: str
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    description: str
    sort_order: int

class WorkExperienceUpdate(BaseModel):
    id: Optional[UUID]=None
    job_title: str
    company: str
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    description: str
    sort_order: int





# ---------- Education ----------

class EducationCreate(BaseModel):
    school: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort_order: int

class EducationUpdate(BaseModel):
    id: Optional[UUID]=None
    school: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort_order: int




# ---------- Skill ----------

class SkillCreate(BaseModel):
    skill_name: str
    sort_order: int

class SkillUpdate(BaseModel):
    id: Optional[UUID]= None
    skill_name: str
    sort_order: int



# ---------- Project ----------

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    link: Optional[str] = None
    sort_order: int

class ProjectUpdate(BaseModel):
    id: Optional[UUID]=None
    name: str
    description: Optional[str] = None
    link: Optional[str] = None
    sort_order: int


# ---------- Certification ----------

class CertificationCreate(BaseModel):
    name: str
    issuer: Optional[str] = None
    date_earned: Optional[date] = None
    sort_order: int


class CertificationUpdate(BaseModel):
    id: Optional[UUID]=None
    name: str
    issuer: Optional[str] = None
    date_earned: Optional[date] = None
    sort_order: int

#-----------Section-Order--------

class SectionOrderCreate(BaseModel):
    section_name: str
    section_order: int


class SectionOrderUpdate(BaseModel):
    id: Optional[UUID]=None
    section_name: str
    section_order: int


# ---------- Resume ----------

class ResumeCreate(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    professional_summary: Optional[str] = None

class ResumeUpdate(BaseModel):
    id: Optional[UUID]=None
    full_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    professional_summary: Optional[str] = None

class ResumeUpdateRequest(BaseModel):
    resume: ResumeUpdate
    section_order: list[SectionOrderUpdate] = []
    work_experience: list[WorkExperienceUpdate] = []
    education: list[EducationUpdate] = []
    skills: list[SkillUpdate] = []
    projects: list[ProjectUpdate] = []
    certifications: list[CertificationUpdate] = []





class ResumeSaveRequest(BaseModel):
    """Full save: resume fields + all six sections at once."""
    resume: ResumeCreate
    section_order: list[SectionOrderCreate] = []
    work_experience: list[WorkExperienceCreate] = []
    education: list[EducationCreate] = []
    skills: list[SkillCreate] = []
    projects: list[ProjectCreate] = []
    certifications: list[CertificationCreate] = []



