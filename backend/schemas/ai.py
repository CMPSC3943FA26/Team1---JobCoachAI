from pydantic import BaseModel

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

class FrontendResponse(BaseModel):
    suggestions: list[Suggestion]
    improvements: list[Improvement]
    removals: list[Removal]
    missing_requirements: list[MissingRequirements]
    ATS_score: int
    requirements_met: int
    requirements_missing: int
    total_time_seconds: float | None = None
