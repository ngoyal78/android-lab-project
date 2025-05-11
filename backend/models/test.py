from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from ..database import Base

class TestStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ERROR = "ERROR"
    CANCELLED = "CANCELLED"

class TestJob(Base):
    """Test job model"""
    __tablename__ = "test_jobs"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("target_devices.id"), nullable=False)
    artifact_id = Column(Integer, ForeignKey("artifacts.id"), nullable=True)
    command = Column(String, nullable=False)
    test_type = Column(String, nullable=False)
    status = Column(Enum(TestStatus), default=TestStatus.PENDING, nullable=False)
    result_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="test_jobs")
    target = relationship("TargetDevice", back_populates="test_jobs")
    artifact = relationship("Artifact", back_populates="test_jobs")
