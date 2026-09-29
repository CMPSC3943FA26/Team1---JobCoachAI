from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class JobBase(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: str
    company: str
    source: str
    created_at: datetime
    updated_at: datetime