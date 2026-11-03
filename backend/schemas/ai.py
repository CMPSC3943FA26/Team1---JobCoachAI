from typing import Literal

from pydantic import BaseModel, Field

class UserEvidence(BaseModel):
    requirement: str
    evidence: str
    target_section: Literal[
        "Work Experience",
        "Professional Summary",
        "Projects",
        "Education",
        "Skills",
        "Certifications",
    ]
    source: Literal["user"] = "user"


class RequirementEvidence(BaseModel):
    resume_id: str
    source: Literal["resume", "user"]
    reason: str


class RequirementMatch(BaseModel):
    requirement: str
    group: str = ""
    group_logic: Literal["all", "any"] = "all"
    group_classification: Literal["supported", "partial", "unsupported"] = "unsupported"
    importance: Literal["required", "desired", "mentioned"]
    classification: Literal["supported", "partial", "unsupported"]
    evidence: list[RequirementEvidence]


class Suggestion(BaseModel):
    suggestion: str
    type: str
    requirement: str
    importance: int
    before: str
    reason: str
    resume_id: str


class Improvement(BaseModel):
    improvement: str
    type: str
    requirement: str
    reason: str
    resume_id: str | None

class Removal(BaseModel):
    relevant_text: str
    reason: str

class MissingRequirements(BaseModel):
    requirement: str


class JobRequirement(BaseModel):
    requirement: str
    group: str = ""
    group_logic: Literal["all", "any"] = "all"
    importance: Literal["required", "desired", "mentioned"]
    direct_search_terms: list[str]
    related_search_terms: list[str]

class JobRequirements(BaseModel):
    requirements: list[JobRequirement]


class FrontendResponse(BaseModel):
    suggestions: list[Suggestion]
    improvements: list[Improvement]
    removals: list[Removal]
    missing_requirements: list[MissingRequirements]
    ATS_score: int
    requirements_met: list[MissingRequirements]
    requirements_missing: int
    requirements: JobRequirements
    evidence: list[RequirementMatch] = Field(default_factory=list)
    total_time_seconds: float | None = None
