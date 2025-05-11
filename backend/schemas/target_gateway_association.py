from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class AssociationStatus(str, Enum):
    CONNECTED = "connected"
    CONNECTING = "connecting"
    DISCONNECTED = "disconnected"
    FAILED = "failed"
    PENDING = "pending"

class TargetGatewayAssociationBase(BaseModel):
    target_id: int
    gateway_id: str
    status: Optional[AssociationStatus] = AssociationStatus.PENDING
    health_status: Optional[int] = None
    connection_details: Optional[Dict[str, Any]] = None
    tunnel_id: Optional[str] = None
    tunnel_port: Optional[int] = None
    tunnel_status: Optional[str] = None

class TargetGatewayAssociationCreate(TargetGatewayAssociationBase):
    pass

class TargetGatewayAssociationUpdate(BaseModel):
    status: Optional[AssociationStatus] = None
    health_status: Optional[int] = None
    connection_details: Optional[Dict[str, Any]] = None
    tunnel_id: Optional[str] = None
    tunnel_port: Optional[int] = None
    tunnel_status: Optional[str] = None

class TargetGatewayAssociation(TargetGatewayAssociationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    class Config:
        orm_mode = True

class TargetGatewayAssociationWithDetails(TargetGatewayAssociation):
    target_name: Optional[str] = None
    target_serial: Optional[str] = None
    target_model: Optional[str] = None
    target_status: Optional[str] = None
    gateway_name: Optional[str] = None
    gateway_status: Optional[str] = None
    gateway_location: Optional[str] = None

class TargetGatewayAssociationBulkCreate(BaseModel):
    target_ids: List[int]
    gateway_id: str

class TargetGatewayAssociationBulkDelete(BaseModel):
    target_ids: List[int]
    gateway_id: Optional[str] = None

class TargetGatewayAssociationFilter(BaseModel):
    target_id: Optional[int] = None
    gateway_id: Optional[str] = None
    status: Optional[AssociationStatus] = None
    health_status_min: Optional[int] = None
    health_status_max: Optional[int] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    created_by: Optional[int] = None
