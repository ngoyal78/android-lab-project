from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, CheckConstraint, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..database import Base

class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"  # New status for auto-expired reservations

class ReservationPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("target_devices.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("reservation_policies.id"), nullable=True)
    
    # Reservation time window
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    
    # Status
    status = Column(Enum(ReservationStatus), default=ReservationStatus.PENDING, nullable=False)
    
    # Priority
    priority = Column(Enum(ReservationPriority), default=ReservationPriority.NORMAL, nullable=False)
    
    # Recurrence
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSON, nullable=True)  # JSON object with recurrence details
    
    # Notifications
    notifications_sent = Column(JSON, default={})  # Track which notifications have been sent
    
    # Admin override
    is_admin_override = Column(Boolean, default=False)
    override_reason = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)  # For tracking stale bookings
    
    # Relationships
    user = relationship("User", backref="reservations")
    target_device = relationship("TargetDevice", backref="reservations")
    policy = relationship("ReservationPolicy", backref="reservations")
    
    # Constraints
    __table_args__ = (
        # Ensure end_time is after start_time
        CheckConstraint('end_time > start_time', name='check_end_time_after_start_time'),
    )
