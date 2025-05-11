from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, JSON, ARRAY, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..database import Base

class DeviceType(str, enum.Enum):
    PHYSICAL = "physical"
    VIRTUAL = "virtual"
    EMULATOR = "emulator"

class DeviceStatus(str, enum.Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    UNHEALTHY = "unhealthy"

class NetworkCapability(str, enum.Enum):
    WIFI = "wifi"
    ETHERNET = "ethernet"
    CELLULAR = "cellular"
    BLUETOOTH = "bluetooth"
    NFC = "nfc"

class TargetDevice(Base):
    __tablename__ = "target_devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    gateway_id = Column(String, nullable=False, index=True)
    device_type = Column(Enum(DeviceType), nullable=False)
    ip_address = Column(String, nullable=True)
    serial_number = Column(String, nullable=True, unique=True)
    android_version = Column(String, nullable=True)
    api_level = Column(Integer, nullable=True)
    manufacturer = Column(String, nullable=True)
    model = Column(String, nullable=True)
    
    # Location information
    location = Column(String, nullable=True)
    
    # Endpoint information
    adb_endpoint = Column(String, nullable=True)
    ssh_endpoint = Column(String, nullable=True)
    
    # Hardware specifications
    cpu_info = Column(JSON, nullable=True, default={})
    gpu_info = Column(JSON, nullable=True, default={})
    memory_mb = Column(Integer, nullable=True)
    storage_gb = Column(Integer, nullable=True)
    screen_size_inch = Column(Float, nullable=True)
    screen_resolution = Column(String, nullable=True)
    
    # Network capabilities - using JSON instead of ARRAY for SQLite compatibility
    network_capabilities = Column(JSON, nullable=True, default=[])
    
    # HAL support
    hal_support = Column(JSON, nullable=True, default={})
    
    # Tags and purpose - using JSON instead of ARRAY for SQLite compatibility
    tags = Column(JSON, nullable=True, default=[])
    purpose = Column(JSON, nullable=True, default=[])
    
    # Status fields
    status = Column(Enum(DeviceStatus), default=DeviceStatus.OFFLINE, nullable=False)
    adb_status = Column(Boolean, default=False)
    serial_status = Column(Boolean, default=False)
    
    # Health check information
    health_check_timestamp = Column(DateTime(timezone=True), nullable=True)
    health_check_status = Column(JSON, nullable=True, default={})
    health_check_score = Column(Integer, nullable=True)  # 0-100 score
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    
    # Heartbeat configuration
    heartbeat_interval_seconds = Column(Integer, default=10)
    
    # Relationships
    reservations = relationship("Reservation", back_populates="target_device")
    test_jobs = relationship("TestJob", back_populates="target")
    
    # Audit fields
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
