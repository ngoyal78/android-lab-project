from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from ..models.reservation import ReservationStatus, ReservationPriority

# Base Reservation Schema
class ReservationBase(BaseModel):
    target_id: int
    start_time: datetime
    end_time: datetime
    priority: Optional[ReservationPriority] = ReservationPriority.NORMAL

    @validator('end_time')
    def end_time_must_be_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

# Schema for creating a new reservation
class ReservationCreate(ReservationBase):
    policy_id: Optional[int] = None
    is_recurring: Optional[bool] = False
    recurrence_pattern: Optional[Dict[str, Any]] = None
    override_reason: Optional[str] = None

# Schema for updating a reservation
class ReservationUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[ReservationStatus] = None
    priority: Optional[ReservationPriority] = None
    policy_id: Optional[int] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[Dict[str, Any]] = None
    is_admin_override: Optional[bool] = None
    override_reason: Optional[str] = None

    @validator('end_time')
    def end_time_must_be_after_start_time(cls, v, values, **kwargs):
        if v and 'start_time' in values and values['start_time'] and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

# Schema for reservation response
class ReservationResponse(ReservationBase):
    id: int
    user_id: int
    status: ReservationStatus
    policy_id: Optional[int] = None
    is_recurring: bool
    recurrence_pattern: Optional[Dict[str, Any]] = None
    is_admin_override: bool
    override_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Schema for reservation with target and user details
class ReservationWithDetails(ReservationResponse):
    target_name: str
    target_type: str
    user_username: str

    class Config:
        orm_mode = True
