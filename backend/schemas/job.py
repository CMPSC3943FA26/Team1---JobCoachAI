from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class JobCreateRequest(BaseModel):
    title: str
    description: str
    company: str
    source: str

    class JobUpdateRequest(BaseModel):
        title: str | None = None
        description: str | None = None
        company: str | None = None
        source: str | None = None

        class JobResponse(BaseModel):
            id: UUID
            user_id: UUID
            title: str
            description: str
            company: str
            source: str
            created_at: datetime
            updated_at: datetime