from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union, Set
from datetime import datetime
from ..models.target import DeviceType, DeviceStatus, NetworkCapability

# Base Target Device Schema
class TargetDeviceBase(BaseModel):
    name: str
    gateway_id: str
    device_type: DeviceType
    ip_address: Optional[str] = None
    serial_number: Optional[str] = None
    android_version: Optional[str] = None
    api_level: Optional[int] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    
    # Location information
    location: Optional[str] = None
    
    # Endpoint information
    adb_endpoint: Optional[str] = None
    ssh_endpoint: Optional[str] = None
    
    # Hardware specifications
    cpu_info: Optional[Dict[str, Any]] = None
    gpu_info: Optional[Dict[str, Any]] = None
    memory_mb: Optional[int] = None
    storage_gb: Optional[int] = None
    screen_size_inch: Optional[float] = None
    screen_resolution: Optional[str] = None
    
    # Network capabilities
    network_capabilities: Optional[List[NetworkCapability]] = None
    
    # HAL support
    hal_support: Optional[Dict[str, Any]] = None
    
    # Tags and purpose
    tags: Optional[List[str]] = None
    purpose: Optional[List[str]] = None

# Schema for creating a new target device
class TargetDeviceCreate(TargetDeviceBase):
    heartbeat_interval_seconds: Optional[int] = 10

# Schema for updating a target device
class TargetDeviceUpdate(BaseModel):
    name: Optional[str] = None
    gateway_id: Optional[str] = None
    device_type: Optional[DeviceType] = None
    ip_address: Optional[str] = None
    serial_number: Optional[str] = None
    android_version: Optional[str] = None
    api_level: Optional[int] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    location: Optional[str] = None
    adb_endpoint: Optional[str] = None
    ssh_endpoint: Optional[str] = None
    cpu_info: Optional[Dict[str, Any]] = None
    gpu_info: Optional[Dict[str, Any]] = None
    memory_mb: Optional[int] = None
    storage_gb: Optional[int] = None
    screen_size_inch: Optional[float] = None
    screen_resolution: Optional[str] = None
    network_capabilities: Optional[List[NetworkCapability]] = None
    hal_support: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    purpose: Optional[List[str]] = None
    status: Optional[DeviceStatus] = None
    adb_status: Optional[bool] = None
    serial_status: Optional[bool] = None
    is_active: Optional[bool] = None
    heartbeat_interval_seconds: Optional[int] = None

# Schema for target device response
class TargetDeviceResponse(TargetDeviceBase):
    id: int
    status: DeviceStatus
    adb_status: bool
    serial_status: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_heartbeat: Optional[datetime] = None
    health_check_timestamp: Optional[datetime] = None
    health_check_status: Optional[Dict[str, Any]] = None
    health_check_score: Optional[int] = None
    heartbeat_interval_seconds: int = 10
    is_active: bool
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    class Config:
        orm_mode = True

# Schema for heartbeat device info
class HeartbeatDeviceInfo(TargetDeviceBase):
    adb_status: bool = False
    serial_status: bool = False
    health_check_status: Optional[Dict[str, Any]] = None
    health_check_score: Optional[int] = None

# Schema for heartbeat request
class HeartbeatRequest(BaseModel):
    gateway_id: str
    devices: List[HeartbeatDeviceInfo]
    timestamp: datetime = Field(default_factory=datetime.now)

# Schema for deactivating a target device
class TargetDeviceDeactivate(BaseModel):
    reason: Optional[str] = None

# Schema for bulk tagging targets
class BulkTagRequest(BaseModel):
    target_ids: List[int]
    tags: List[str]
    operation: str = "add"  # "add", "remove", "set"

# Schema for bulk purpose assignment
class BulkPurposeRequest(BaseModel):
    target_ids: List[int]
    purpose: List[str]
    operation: str = "add"  # "add", "remove", "set"

# Schema for filtering targets
class TargetFilterParams(BaseModel):
    status: Optional[List[DeviceStatus]] = None
    device_type: Optional[List[DeviceType]] = None
    is_active: Optional[bool] = None
    tags: Optional[List[str]] = None
    purpose: Optional[List[str]] = None
    android_version: Optional[str] = None
    api_level_min: Optional[int] = None
    api_level_max: Optional[int] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    location: Optional[str] = None
    network_capabilities: Optional[List[NetworkCapability]] = None
    health_score_min: Optional[int] = None
    search: Optional[str] = None  # For searching across multiple fields

# Schema for importing targets
class ImportTargetsRequest(BaseModel):
    targets: List[TargetDeviceCreate]
    update_existing: bool = False  # Whether to update existing targets with matching serial numbers

# Schema for exporting targets
class ExportTargetsRequest(BaseModel):
    target_ids: Optional[List[int]] = None  # If None, export all targets
    format: str = "json"  # "json" or "csv"
    filter: Optional[TargetFilterParams] = None

# Schema for triggering a manual refresh
class ManualRefreshRequest(BaseModel):
    target_ids: Optional[List[int]] = None  # If None, refresh all targets
    gateway_id: Optional[str] = None  # If provided, refresh only targets from this gateway

# Schema for removing stale targets
class RemoveStaleTargetsRequest(BaseModel):
    hours_threshold: int = 24  # Remove targets with no heartbeat for this many hours
    gateway_id: Optional[str] = None  # If provided, only consider targets from this gateway
