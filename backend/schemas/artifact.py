from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from ..models.artifact import ArtifactType

# Base Artifact Schema
class ArtifactBase(BaseModel):
    filename: str
    original_filename: str
    artifact_type: ArtifactType
    target_id: Optional[int] = None

# Schema for creating a new artifact
class ArtifactCreate(ArtifactBase):
    file_path: str
    file_size: int
    mime_type: Optional[str] = None

# Schema for updating an artifact
class ArtifactUpdate(BaseModel):
    filename: Optional[str] = None
    artifact_type: Optional[ArtifactType] = None
    target_id: Optional[int] = None

# Schema for artifact response
class ArtifactResponse(ArtifactBase):
    id: int
    user_id: int
    file_path: str
    file_size: int
    mime_type: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Schema for artifact with user details
class ArtifactWithUserDetails(ArtifactResponse):
    user_username: str

    class Config:
        orm_mode = True
