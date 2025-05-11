from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class ReservationPolicy(Base):
    __tablename__ = "reservation_policies"

    id = Column(Integer, primary_key=True, index=True)
    
    # Policy name and description
    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)
    
    # Fair use policies
    max_duration_minutes = Column(Integer, default=240)  # Default 4 hours max reservation
    cooldown_minutes = Column(Integer, default=60)  # Default 1 hour cooldown between reservations
    max_reservations_per_day = Column(Integer, default=3)  # Default 3 reservations per day
    max_reservation_days_in_advance = Column(Integer, default=14)  # Default 2 weeks in advance
    
    # Priority settings (higher number = higher priority)
    priority_level = Column(Integer, default=0)
    
    # Target type restrictions (JSON array of allowed device types)
    allowed_device_types = Column(JSON, nullable=True)
    
    # User role restrictions (JSON array of allowed roles)
    allowed_roles = Column(JSON, nullable=True)
    
    # Auto-expiration settings
    auto_expire_enabled = Column(Boolean, default=True)
    auto_expire_minutes = Column(Integer, default=15)  # Default 15 minutes to expire stale bookings
    
    # Notification settings
    notification_before_start_minutes = Column(Integer, default=15)  # Default 15 minutes before start
    notification_before_end_minutes = Column(Integer, default=15)  # Default 15 minutes before end
    
    # Timestamps
    created_at = Column(String, default=func.now())
    updated_at = Column(String, onupdate=func.now())
    
    # Relationships
    targets = relationship("TargetDevice", secondary="target_policies", back_populates="policies")
    users = relationship("User", secondary="user_policies", back_populates="policies")
