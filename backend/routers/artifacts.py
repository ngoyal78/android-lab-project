from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Any, Optional
from datetime import datetime
import os
import shutil
import uuid
import mimetypes
from pathlib import Path

from ..database import get_db
from ..models import User, Artifact, ArtifactType
from ..schemas import ArtifactResponse, ArtifactWithUserDetails
from ..auth import get_current_active_user, get_admin_user, get_developer_user

router = APIRouter(
    prefix="/artifacts",
    tags=["artifacts"],
    responses={401: {"description": "Unauthorized"}},
)

# Configure artifact storage
UPLOAD_DIR = os.getenv("ARTIFACT_UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[ArtifactWithUserDetails])
async def read_artifacts(
    skip: int = 0,
    limit: int = 100,
    artifact_type: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Retrieve artifacts with optional filtering.
    Admin users can see all artifacts, other users can only see their own.
    """
    query = select(
        Artifact,
        User.username.label("user_username")
    ).join(
        User, Artifact.user_id == User.id
    )
    
    # Apply filters
    if artifact_type:
        query = query.filter(Artifact.artifact_type == artifact_type)
    
    # Non-admin users can only see their own artifacts
    if current_user.role != "admin":
        query = query.filter(Artifact.user_id == current_user.id)
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    artifacts_data = result.all()
    
    # Construct response with joined data
    artifacts = []
    for artifact, username in artifacts_data:
        artifact_dict = {
            **ArtifactResponse.from_orm(artifact).dict(),
            "user_username": username
        }
        artifacts.append(artifact_dict)
    
    return artifacts

@router.get("/{artifact_id}", response_model=ArtifactWithUserDetails)
async def read_artifact(
    artifact_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get a specific artifact by id.
    Admin users can see any artifact, other users can only see their own.
    """
    query = select(
        Artifact,
        User.username.label("user_username")
    ).join(
        User, Artifact.user_id == User.id
    ).filter(
        Artifact.id == artifact_id
    )
    
    # Non-admin users can only see their own artifacts
    if current_user.role != "admin":
        query = query.filter(Artifact.user_id == current_user.id)
    
    result = await db.execute(query)
    artifact_data = result.first()
    
    if not artifact_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found or you don't have permission to view it"
        )
    
    artifact, username = artifact_data
    
    # Construct response with joined data
    artifact_dict = {
        **ArtifactResponse.from_orm(artifact).dict(),
        "user_username": username
    }
    
    return artifact_dict

@router.get("/{artifact_id}/download")
async def download_artifact(
    artifact_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Download an artifact file.
    Admin users can download any artifact, other users can only download their own.
    """
    query = select(Artifact).filter(Artifact.id == artifact_id)
    
    # Non-admin users can only download their own artifacts
    if current_user.role != "admin":
        query = query.filter(Artifact.user_id == current_user.id)
    
    result = await db.execute(query)
    artifact = result.scalars().first()
    
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found or you don't have permission to download it"
        )
    
    file_path = artifact.file_path
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact file not found on server"
        )
    
    return FileResponse(
        path=file_path,
        filename=artifact.original_filename,
        media_type=artifact.mime_type
    )

@router.post("/", response_model=ArtifactResponse)
async def create_artifact(
    file: UploadFile = File(...),
    artifact_type: ArtifactType = Form(...),
    target_id: Optional[int] = Form(None),
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Upload a new artifact file.
    """
    # Generate a unique filename to prevent collisions
    original_filename = file.filename
    file_extension = os.path.splitext(original_filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create user-specific directory
    user_upload_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_upload_dir, exist_ok=True)
    
    # Save the file
    file_path = os.path.join(user_upload_dir, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    # Determine mime type
    mime_type, _ = mimetypes.guess_type(original_filename)
    
    # Create artifact record
    new_artifact = Artifact(
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        artifact_type=artifact_type,
        user_id=current_user.id,
        target_id=target_id
    )
    
    db.add(new_artifact)
    await db.commit()
    await db.refresh(new_artifact)
    
    return new_artifact

@router.delete("/{artifact_id}", response_model=ArtifactResponse)
async def delete_artifact(
    artifact_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete an artifact.
    Admin users can delete any artifact, other users can only delete their own.
    """
    query = select(Artifact).filter(Artifact.id == artifact_id)
    
    # Non-admin users can only delete their own artifacts
    if current_user.role != "admin":
        query = query.filter(Artifact.user_id == current_user.id)
    
    result = await db.execute(query)
    artifact = result.scalars().first()
    
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found or you don't have permission to delete it"
        )
    
    # Delete the file
    file_path = artifact.file_path
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete the database record
    await db.delete(artifact)
    await db.commit()
    
    return artifact
