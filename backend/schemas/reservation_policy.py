from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Set
from datetime import datetime

# Base Reservation Policy Schema
class ReservationPolicyBase(BaseModel):
    name: str
    description: Optional[str] = None
    max_duration_minutes: int = 240
    cooldown_minutes: int = 60
    max_reservations_per_day: int = 3
    max_reservation_days_in_advance: int = 14
    priority_level: int = 0
    allowed_device_types: Optional[List[str]] = None
    allowed_roles: Optional[List[str]] = None
    auto_expire_enabled: bool = True
    auto_expire_minutes: int = 15
    notification_before_start_minutes: int = 15
    notification_before_end_minutes: int = 15

# Schema for creating a new reservation policy
class ReservationPolicyCreate(ReservationPolicyBase):
    pass

# Schema for updating a reservation policy
class ReservationPolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_duration_minutes: Optional[int] = None
    cooldown_minutes: Optional[int] = None
    max_reservations_per_day: Optional[int] = None
    max_reservation_days_in_advance: Optional[int] = None
    priority_level: Optional[int] = None
    allowed_device_types: Optional[List[str]] = None
    allowed_roles: Optional[List[str]] = None
    auto_expire_enabled: Optional[bool] = None
    auto_expire_minutes: Optional[int] = None
    notification_before_start_minutes: Optional[int] = None
    notification_before_end_minutes: Optional[int] = None

# Schema for reservation policy response
class ReservationPolicyResponse(ReservationPolicyBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Schema for assigning policies to targets
class TargetPolicyAssignment(BaseModel):
    target_ids: List[int]
    policy_id: int

# Schema for assigning policies to users
class UserPolicyAssignment(BaseModel):
    user_ids: List[int]
    policy_id: int
