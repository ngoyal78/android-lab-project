from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union, Set
from datetime import datetime
from ..models.gateway import GatewayType, GatewayStatus

# Base Gateway Schema
class GatewayBase(BaseModel):
    gateway_id: str
    name: str
    description: Optional[str] = None
    gateway_type: GatewayType = GatewayType.STANDALONE
    parent_gateway_id: Optional[str] = None
    
    # Network information
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    ssh_port: Optional[int] = 22
    api_port: Optional[int] = 8000
    
    # Location and environment
    location: Optional[str] = None
    region: Optional[str] = None
    environment: Optional[str] = None
    
    # Capacity configuration
    max_targets: Optional[int] = None
    max_concurrent_sessions: Optional[int] = None
    
    # Configuration
    config: Optional[Dict[str, Any]] = None
    features: Optional[List[str]] = None
    
    # Tags for filtering and grouping
    tags: Optional[List[str]] = None

# Schema for creating a new gateway
class GatewayCreate(GatewayBase):
    pass

# Schema for updating a gateway
class GatewayUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    gateway_type: Optional[GatewayType] = None
    parent_gateway_id: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    ssh_port: Optional[int] = None
    api_port: Optional[int] = None
    location: Optional[str] = None
    region: Optional[str] = None
    environment: Optional[str] = None
    max_targets: Optional[int] = None
    max_concurrent_sessions: Optional[int] = None
    config: Optional[Dict[str, Any]] = None
    features: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[GatewayStatus] = None
    is_active: Optional[bool] = None

# Schema for gateway response
class GatewayResponse(GatewayBase):
    id: int
    status: GatewayStatus
    last_heartbeat: Optional[datetime] = None
    health_check_score: Optional[int] = None
    health_check_timestamp: Optional[datetime] = None
    health_check_details: Optional[Dict[str, Any]] = None
    current_targets: int
    current_sessions: Optional[int] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    class Config:
        orm_mode = True

# Schema for heartbeat request
class GatewayHeartbeatRequest(BaseModel):
    gateway_id: str
    status: GatewayStatus
    timestamp: datetime = Field(default_factory=datetime.now)
    health_check_score: Optional[int] = None
    health_check_details: Optional[Dict[str, Any]] = None
    current_targets: Optional[int] = None
    current_sessions: Optional[int] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None

# Schema for deactivating a gateway
class GatewayDeactivate(BaseModel):
    reason: Optional[str] = None

# Schema for bulk tagging gateways
class BulkTagGatewaysRequest(BaseModel):
    gateway_ids: List[int]
    tags: List[str]
    operation: str = "add"  # "add", "remove", "set"

# Schema for filtering gateways
class GatewayFilterParams(BaseModel):
    status: Optional[List[GatewayStatus]] = None
    gateway_type: Optional[List[GatewayType]] = None
    is_active: Optional[bool] = None
    tags: Optional[List[str]] = None
    region: Optional[str] = None
    location: Optional[str] = None
    environment: Optional[str] = None
    parent_gateway_id: Optional[str] = None
    health_score_min: Optional[int] = None
    search: Optional[str] = None  # For searching across multiple fields

# Schema for importing gateways
class ImportGatewaysRequest(BaseModel):
    gateways: List[GatewayCreate]
    update_existing: bool = False  # Whether to update existing gateways with matching gateway_id

# Schema for exporting gateways
class ExportGatewaysRequest(BaseModel):
    gateway_ids: Optional[List[int]] = None  # If None, export all gateways
    format: str = "json"  # "json" or "csv"
    filter: Optional[GatewayFilterParams] = None

# Schema for gateway audit log
class GatewayAuditLogResponse(BaseModel):
    id: int
    gateway_id: str
    timestamp: datetime
    action: str
    user_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    
    class Config:
        orm_mode = True

# Schema for gateway hierarchy
class GatewayHierarchyNode(BaseModel):
    gateway_id: str
    name: str
    gateway_type: GatewayType
    status: GatewayStatus
    children: List["GatewayHierarchyNode"] = []
    
    class Config:
        orm_mode = True

# Schema for gateway statistics
class GatewayStatistics(BaseModel):
    total_gateways: int
    online_gateways: int
    offline_gateways: int
    maintenance_gateways: int
    degraded_gateways: int
    total_targets: int
    connected_targets: int
    total_sessions: int
    gateway_types: Dict[str, int]  # Count by type
    regions: Dict[str, int]  # Count by region
    environments: Dict[str, int]  # Count by environment

# Schema for gateway target association
class GatewayTargetAssociation(BaseModel):
    gateway_id: str
    target_id: int
    association_timestamp: datetime = Field(default_factory=datetime.now)
    association_status: str = "connected"
    association_details: Optional[Dict[str, Any]] = None

# Schema for gateway target disassociation
class GatewayTargetDisassociation(BaseModel):
    gateway_id: str
    target_id: int
    reason: Optional[str] = None
    force: bool = False

# Schema for bulk gateway target association
class BulkGatewayTargetAssociation(BaseModel):
    gateway_id: str
    target_ids: List[int]
    association_status: str = "connected"
    association_details: Optional[Dict[str, Any]] = None

# Schema for bulk gateway target disassociation
class BulkGatewayTargetDisassociation(BaseModel):
    gateway_id: str
    target_ids: List[int]
    reason: Optional[str] = None
    force: bool = False

# Schema for gateway target association response
class GatewayTargetAssociationResponse(BaseModel):
    gateway_id: str
    target_id: int
    target_name: str
    association_timestamp: datetime
    association_status: str
    association_details: Optional[Dict[str, Any]] = None
    association_health: Optional[int] = None
    
    class Config:
        orm_mode = True

# Schema for gateway target association filter
class GatewayTargetAssociationFilter(BaseModel):
    gateway_id: Optional[str] = None
    target_id: Optional[int] = None
    association_status: Optional[str] = None
    association_health_min: Optional[int] = None
    association_health_max: Optional[int] = None

# Self-reference for GatewayHierarchyNode
GatewayHierarchyNode.update_forward_refs()
