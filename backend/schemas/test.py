from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum

class TestType(str, Enum):
    CUSTOM = "CUSTOM"
    INSTRUMENTATION = "INSTRUMENTATION"
    MONKEY = "MONKEY"
    UI_AUTOMATOR = "UI_AUTOMATOR"
    ESPRESSO = "ESPRESSO"

class TestStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ERROR = "ERROR"
    CANCELLED = "CANCELLED"

class TestJobBase(BaseModel):
    """Base model for test jobs"""
    command: str = Field(..., description="Command to execute")
    test_type: TestType = Field(..., description="Type of test")

class TestJobCreate(TestJobBase):
    """Model for creating a test job"""
    target_id: int = Field(..., description="Target device ID")
    artifact_id: Optional[int] = Field(None, description="Artifact ID (optional)")

class TestJobResponse(TestJobBase):
    """Model for test job response"""
    id: str = Field(..., description="Test job ID")
    user_id: int = Field(..., description="User ID")
    target_id: int = Field(..., description="Target device ID")
    artifact_id: Optional[int] = Field(None, description="Artifact ID (optional)")
    status: TestStatus = Field(..., description="Test job status")
    result_data: Dict[str, Any] = Field({}, description="Test result data")
    created_at: datetime = Field(..., description="Creation timestamp")
    start_time: Optional[datetime] = Field(None, description="Start timestamp")
    end_time: Optional[datetime] = Field(None, description="End timestamp")

    class Config:
        orm_mode = True

class TestJobWithDetails(TestJobResponse):
    """Model for test job with additional details"""
    target_name: Optional[str] = Field(None, description="Target device name")
    artifact_filename: Optional[str] = Field(None, description="Artifact filename")
    user_username: Optional[str] = Field(None, description="Username")

class TestLogCreate(BaseModel):
    """Model for creating a test log"""
    job_id: str = Field(..., description="Test job ID")
    log: str = Field(..., description="Log message")
    is_error: bool = Field(False, description="Whether this is an error log")
    timestamp: datetime = Field(..., description="Log timestamp")

class TestCompletionCreate(BaseModel):
    """Model for test completion notification"""
    job_id: str = Field(..., description="Test job ID")
    exit_code: int = Field(..., description="Exit code")
    end_time: datetime = Field(..., description="End timestamp")
    error: Optional[str] = Field(None, description="Error message")

class PendingTestResponse(BaseModel):
    """Model for pending test response"""
    tests: List[Dict[str, Any]] = Field([], description="List of pending tests")
