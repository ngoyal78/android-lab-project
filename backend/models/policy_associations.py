from sqlalchemy import Column, Integer, ForeignKey, Table
from ..database import Base

# Association table for TargetDevice to ReservationPolicy
target_policies = Table(
    "target_policies",
    Base.metadata,
    Column("target_id", Integer, ForeignKey("target_devices.id"), primary_key=True),
    Column("policy_id", Integer, ForeignKey("reservation_policies.id"), primary_key=True)
)

# Association table for User to ReservationPolicy
user_policies = Table(
    "user_policies",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("policy_id", Integer, ForeignKey("reservation_policies.id"), primary_key=True)
)
