from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, JSON, Float, ForeignKey, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..database import Base

class GatewayType(str, enum.Enum):
    MASTER = "master"
    REGION = "region"
    SITE = "site"
    STANDALONE = "standalone"

class GatewayStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    DEGRADED = "degraded"

class Gateway(Base):
    __tablename__ = "gateways"

    id = Column(Integer, primary_key=True, index=True)
    gateway_id = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # Gateway type and hierarchy
    gateway_type = Column(Enum(GatewayType), default=GatewayType.STANDALONE, nullable=False)
    parent_gateway_id = Column(String, ForeignKey("gateways.gateway_id"), nullable=True)
    
    # Status and health
    status = Column(Enum(GatewayStatus), default=GatewayStatus.OFFLINE, nullable=False)
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    health_check_score = Column(Integer, nullable=True)  # 0-100 score
    health_check_timestamp = Column(DateTime(timezone=True), nullable=True)
    health_check_details = Column(JSON, nullable=True, default={})
    
    # Network information
    hostname = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    ssh_port = Column(Integer, default=22)
    api_port = Column(Integer, default=8000)
    
    # Location and environment
    location = Column(String, nullable=True)
    region = Column(String, nullable=True)
    environment = Column(String, nullable=True)  # e.g., production, staging, development
    
    # Capacity and load
    max_targets = Column(Integer, nullable=True)
    current_targets = Column(Integer, default=0)
    max_concurrent_sessions = Column(Integer, nullable=True)
    current_sessions = Column(Integer, default=0)
    cpu_usage = Column(Float, nullable=True)
    memory_usage = Column(Float, nullable=True)
    disk_usage = Column(Float, nullable=True)
    
    # Configuration
    config = Column(JSON, nullable=True, default={})
    features = Column(JSON, nullable=True, default=[])
    
    # Tags for filtering and grouping
    tags = Column(JSON, nullable=True, default=[])
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    targets = relationship("TargetDevice", back_populates="gateway")
    child_gateways = relationship("Gateway", 
                                 backref="parent_gateway",
                                 remote_side=[gateway_id])
    
    # Audit trail
    audit_logs = relationship("GatewayAuditLog", back_populates="gateway")

class GatewayAuditLog(Base):
    __tablename__ = "gateway_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    gateway_id = Column(String, ForeignKey("gateways.gateway_id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String, nullable=False)  # e.g., created, updated, status_changed
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    details = Column(JSON, nullable=True)
    
    # Relationships
    gateway = relationship("Gateway", back_populates="audit_logs")
    user = relationship("User")
