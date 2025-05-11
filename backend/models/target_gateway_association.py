from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, JSON, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..database import Base

class AssociationStatus(str, enum.Enum):
    CONNECTED = "connected"
    CONNECTING = "connecting"
    DISCONNECTED = "disconnected"
    FAILED = "failed"
    PENDING = "pending"

class TargetGatewayAssociation(Base):
    __tablename__ = "target_gateway_associations"

    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("target_devices.id"), nullable=False, index=True)
    gateway_id = Column(String, ForeignKey("gateways.gateway_id"), nullable=False, index=True)
    
    # Status and health
    status = Column(Enum(AssociationStatus), default=AssociationStatus.PENDING, nullable=False)
    health_status = Column(Integer, nullable=True)  # 0-100 score
    last_health_check = Column(DateTime(timezone=True), nullable=True)
    connection_details = Column(JSON, nullable=True, default={})
    
    # Tunnel information
    tunnel_id = Column(String, nullable=True)
    tunnel_port = Column(Integer, nullable=True)
    tunnel_status = Column(String, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Constraints
    __table_args__ = (
        # Ensure a target can only be associated with one gateway at a time
        {"sqlite_autoincrement": True},
    )
    
    # Relationships
    target = relationship("TargetDevice", backref="gateway_associations")
    gateway = relationship("Gateway", backref="target_associations")
    created_by_user = relationship("User", foreign_keys=[created_by])
    updated_by_user = relationship("User", foreign_keys=[updated_by])
