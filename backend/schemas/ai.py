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


class FrontendResponse(BaseModel):
    suggestions: list[Suggestion]
    improvements: list[Improvement]
    ATS_score: int
    requirements_met: int
    requirements_missing: int
    