from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..database import Base

class ArtifactType(str, enum.Enum):
    APK = "apk"
    TEST_SCRIPT = "test_script"
    LOG = "log"
    OTHER = "other"

class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    
    # File information
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    mime_type = Column(String, nullable=True)
    
    # Artifact type
    artifact_type = Column(Enum(ArtifactType), nullable=False)
    
    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Optional target association
    target_id = Column(Integer, ForeignKey("target_devices.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="artifacts")
    target_device = relationship("TargetDevice", backref="artifacts")
    test_jobs = relationship("TestJob", back_populates="artifact")
