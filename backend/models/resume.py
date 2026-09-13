from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class WorkExperience(BaseModel):
    id: Optional[UUID] = None
    resume_id: UUID
    job_title: str
    company: str
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None  # null = current role
    description: str
    sort_order: int


class Education(BaseModel):
    id: Optional[UUID] = None
    resume_id: UUID
    school: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort_order: int


class Skill(BaseModel):
    id: Optional[UUID] = None
    resume_id: UUID
    skill_name: str
    sort_order: int


class Project(BaseModel):
    id: Optional[UUID] = None
    resume_id: UUID
    name: str
    description: Optional[str] = None
    link: Optional[str] = None
    sort_order: int


class Certification(BaseModel):
    id: Optional[UUID] = None
    resume_id: UUID
    name: str
    issuer: Optional[str] = None
    date_earned: Optional[date] = None
    sort_order: int


class Resume(BaseModel):
    id: Optional[UUID] = None
    user_id: UUID
    full_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    professional_summary: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    work_experience: list[WorkExperience] = []
    education: list[Education] = []
    skills: list[Skill] = []
    projects: list[Project] = []
    certifications: list[Certification] = []