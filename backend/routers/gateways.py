from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging
import csv
import io
import json

from ..database import get_db
from ..models import User, Gateway, GatewayStatus, GatewayType, TargetDevice, GatewayAuditLog, DeviceStatus
from ..schemas import (
    GatewayResponse, GatewayCreate, GatewayUpdate, GatewayHeartbeatRequest,
    GatewayDeactivate, BulkTagGatewaysRequest, GatewayFilterParams,
    ImportGatewaysRequest, ExportGatewaysRequest, GatewayAuditLogResponse,
    GatewayHierarchyNode, GatewayStatistics, GatewayTargetAssociation,
    GatewayTargetDisassociation, BulkGatewayTargetAssociation,
    BulkGatewayTargetDisassociation, GatewayTargetAssociationResponse,
    GatewayTargetAssociationFilter
)
from ..auth import get_current_active_user, get_admin_user, get_developer_user
from ..notifications import notification_manager, EventType

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gateways",
    tags=["gateways"],
    responses={401: {"description": "Unauthorized"}},
)

# Helper function to log gateway events
async def log_gateway_event(
    db: AsyncSession,
    gateway_id: str,
    action: str,
    user_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None
):
    """Log a gateway event to the audit trail"""
    audit_log = GatewayAuditLog(
        gateway_id=gateway_id,
        action=action,
        user_id=user_id,
        details=details
    )
    db.add(audit_log)
    await db.commit()
    
    # Also log to notification system
    notification_manager.log_event(
        event_type=EventType.GATEWAY_EVENT,
        user_id=user_id,
        details={
            "action": action,
            "gateway_id": gateway_id,
            "timestamp": datetime.utcnow().isoformat(),
            **(details if details else {})
        }
    )

@router.post("/", response_model=GatewayResponse, status_code=status.HTTP_201_CREATED)
async def create_gateway(
    gateway_data: GatewayCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Create a new gateway.
    """
    # Check if gateway with same gateway_id already exists
    result = await db.execute(
        select(Gateway).filter(Gateway.gateway_id == gateway_data.gateway_id)
    )
    existing_gateway = result.scalars().first()
    if existing_gateway:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gateway with this gateway_id already exists"
        )
    
    # If parent_gateway_id is provided, check if it exists
    if gateway_data.parent_gateway_id:
        result = await db.execute(
            select(Gateway).filter(Gateway.gateway_id == gateway_data.parent_gateway_id)
        )
        parent_gateway = result.scalars().first()
        if not parent_gateway:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent gateway not found"
            )
    
    # Create new gateway
    new_gateway = Gateway(**gateway_data.dict(), created_by=current_user.id)
    db.add(new_gateway)
    await db.commit()
    await db.refresh(new_gateway)
    
    # Log the event
    await log_gateway_event(
        db=db,
        gateway_id=new_gateway.gateway_id,
        action="created",
        user_id=current_user.id,
        details={
            "name": new_gateway.name,
            "gateway_type": new_gateway.gateway_type,
            "parent_gateway_id": new_gateway.parent_gateway_id
        }
    )
    
    return new_gateway

@router.get("/", response_model=List[GatewayResponse])
async def list_gateways(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    gateway_type: Optional[str] = None,
    is_active: Optional[bool] = True,
    region: Optional[str] = None,
    parent_gateway_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Retrieve gateways with optional filtering.
    """
    query = select(Gateway)
    
    # Apply filters if provided
    if status:
        query = query.filter(Gateway.status == status)
    
    if gateway_type:
        query = query.filter(Gateway.gateway_type == gateway_type)
    
    if is_active is not None:
        query = query.filter(Gateway.is_active == is_active)
    
    if region:
        query = query.filter(Gateway.region == region)
    
    if parent_gateway_id:
        query = query.filter(Gateway.parent_gateway_id == parent_gateway_id)
    
    if search:
        query = query.filter(
            or_(
                Gateway.name.ilike(f"%{search}%"),
                Gateway.gateway_id.ilike(f"%{search}%"),
                Gateway.description.ilike(f"%{search}%"),
                Gateway.location.ilike(f"%{search}%")
            )
        )
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    gateways = result.scalars().all()
    
    return gateways

@router.get("/{gateway_id}", response_model=GatewayResponse)
async def read_gateway(
    gateway_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get a specific gateway by id.
    """
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    return gateway

@router.put("/{gateway_id}", response_model=GatewayResponse)
async def update_gateway(
    gateway_id: str,
    gateway_data: GatewayUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Update a gateway. Only accessible to admin users.
    """
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Store original values for audit logging
    original_values = {
        "name": gateway.name,
        "gateway_type": gateway.gateway_type,
        "status": gateway.status,
        "parent_gateway_id": gateway.parent_gateway_id
    }
    
    # If parent_gateway_id is being updated, check if it exists
    if gateway_data.parent_gateway_id and gateway_data.parent_gateway_id != gateway.parent_gateway_id:
        # Check for circular reference
        if gateway_data.parent_gateway_id == gateway.gateway_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gateway cannot be its own parent"
            )
        
        result = await db.execute(
            select(Gateway).filter(Gateway.gateway_id == gateway_data.parent_gateway_id)
        )
        parent_gateway = result.scalars().first()
        if not parent_gateway:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent gateway not found"
            )
    
    # Update gateway fields if provided
    update_data = gateway_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(gateway, field, value)
    
    gateway.updated_by = current_user.id
    gateway.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(gateway)
    
    # Log the update event
    await log_gateway_event(
        db=db,
        gateway_id=gateway.gateway_id,
        action="updated",
        user_id=current_user.id,
        details={
            "original": original_values,
            "updated": update_data
        }
    )
    
    return gateway

@router.post("/{gateway_id}/deactivate", response_model=GatewayResponse)
async def deactivate_gateway(
    gateway_id: str,
    deactivate_data: GatewayDeactivate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Deactivate a gateway. This is a soft delete operation.
    Only accessible to admin users.
    """
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Deactivate the gateway
    gateway.is_active = False
    gateway.status = GatewayStatus.MAINTENANCE
    gateway.updated_by = current_user.id
    gateway.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(gateway)
    
    # Log the deactivation event
    await log_gateway_event(
        db=db,
        gateway_id=gateway.gateway_id,
        action="deactivated",
        user_id=current_user.id,
        details={"reason": deactivate_data.reason} if deactivate_data.reason else None
    )
    
    return gateway

@router.delete("/{gateway_id}", response_model=GatewayResponse)
async def delete_gateway(
    gateway_id: str,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Hard delete a gateway. Only accessible to admin users.
    This is not recommended for normal operations - use deactivate instead.
    """
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Check if gateway has child gateways
    result = await db.execute(select(Gateway).filter(Gateway.parent_gateway_id == gateway_id))
    child_gateways = result.scalars().all()
    
    if child_gateways:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete gateway with child gateways. Reassign or delete child gateways first."
        )
    
    # Check if gateway has associated targets
    result = await db.execute(select(TargetDevice).filter(TargetDevice.gateway_id == gateway_id))
    associated_targets = result.scalars().all()
    
    if associated_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete gateway with associated targets. Reassign or delete targets first."
        )
    
    # Store gateway info for audit log
    gateway_info = {
        "id": gateway.id,
        "gateway_id": gateway.gateway_id,
        "name": gateway.name,
        "gateway_type": gateway.gateway_type
    }
    
    # Delete gateway audit logs first (to maintain referential integrity)
    await db.execute(
        "DELETE FROM gateway_audit_logs WHERE gateway_id = :gateway_id",
        {"gateway_id": gateway_id}
    )
    
    # Delete the gateway
    await db.delete(gateway)
    await db.commit()
    
    # Log the deletion event
    notification_manager.log_event(
        EventType.GATEWAY_EVENT,
        user_id=current_user.id,
        details={
            "action": "deleted",
            "gateway_id": gateway_id,
            "gateway_info": gateway_info,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    return gateway

@router.post("/heartbeat", response_model=GatewayResponse)
async def process_heartbeat(
    heartbeat_data: GatewayHeartbeatRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Process heartbeat from gateway with status updates.
    This endpoint is open for gateway agents to report status.
    """
    # Check if gateway exists
    result = await db.execute(
        select(Gateway).filter(Gateway.gateway_id == heartbeat_data.gateway_id)
    )
    gateway = result.scalars().first()
    
    if not gateway:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Store original status for audit logging
    original_status = gateway.status
    
    # Update gateway status
    gateway.status = heartbeat_data.status
    gateway.last_heartbeat = heartbeat_data.timestamp
    
    # Update health check information if provided
    if heartbeat_data.health_check_score is not None:
        gateway.health_check_score = heartbeat_data.health_check_score
        gateway.health_check_timestamp = heartbeat_data.timestamp
    
    if heartbeat_data.health_check_details is not None:
        gateway.health_check_details = heartbeat_data.health_check_details
    
    # Update resource usage if provided
    if heartbeat_data.current_targets is not None:
        gateway.current_targets = heartbeat_data.current_targets
    
    if heartbeat_data.current_sessions is not None:
        gateway.current_sessions = heartbeat_data.current_sessions
    
    if heartbeat_data.cpu_usage is not None:
        gateway.cpu_usage = heartbeat_data.cpu_usage
    
    if heartbeat_data.memory_usage is not None:
        gateway.memory_usage = heartbeat_data.memory_usage
    
    if heartbeat_data.disk_usage is not None:
        gateway.disk_usage = heartbeat_data.disk_usage
    
    await db.commit()
    await db.refresh(gateway)
    
    # Log status change if it occurred
    if original_status != gateway.status:
        await log_gateway_event(
            db=db,
            gateway_id=gateway.gateway_id,
            action="status_changed",
            details={
                "original_status": original_status,
                "new_status": gateway.status,
                "timestamp": heartbeat_data.timestamp.isoformat()
            }
        )
    
    return gateway

@router.get("/hierarchy", response_model=List[GatewayHierarchyNode])
async def get_gateway_hierarchy(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get the gateway hierarchy as a tree structure.
    """
    # Get all active gateways
    result = await db.execute(
        select(Gateway).filter(Gateway.is_active == True)
    )
    all_gateways = result.scalars().all()
    
    # Create a dictionary of gateways by gateway_id
    gateway_dict = {gateway.gateway_id: gateway for gateway in all_gateways}
    
    # Create a dictionary to store the hierarchy
    hierarchy = {}
    
    # Build the hierarchy
    for gateway in all_gateways:
        # Create a node for this gateway
        node = GatewayHierarchyNode(
            gateway_id=gateway.gateway_id,
            name=gateway.name,
            gateway_type=gateway.gateway_type,
            status=gateway.status,
            children=[]
        )
        
        # Add to hierarchy
        hierarchy[gateway.gateway_id] = node
    
    # Connect parent-child relationships
    root_nodes = []
    for gateway in all_gateways:
        if gateway.parent_gateway_id and gateway.parent_gateway_id in hierarchy:
            # Add this gateway as a child of its parent
            parent_node = hierarchy[gateway.parent_gateway_id]
            parent_node.children.append(hierarchy[gateway.gateway_id])
        elif not gateway.parent_gateway_id:
            # This is a root node
            root_nodes.append(hierarchy[gateway.gateway_id])
    
    return root_nodes

@router.get("/statistics", response_model=GatewayStatistics)
async def get_gateway_statistics(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get statistics about gateways and their targets.
    """
    # Count gateways by status
    result = await db.execute(
        "SELECT status, COUNT(*) FROM gateways WHERE is_active = true GROUP BY status"
    )
    status_counts = {row[0]: row[1] for row in result.all()}
    
    # Count gateways by type
    result = await db.execute(
        "SELECT gateway_type, COUNT(*) FROM gateways WHERE is_active = true GROUP BY gateway_type"
    )
    type_counts = {row[0]: row[1] for row in result.all()}
    
    # Count gateways by region
    result = await db.execute(
        "SELECT region, COUNT(*) FROM gateways WHERE is_active = true AND region IS NOT NULL GROUP BY region"
    )
    region_counts = {row[0]: row[1] for row in result.all()}
    
    # Count gateways by environment
    result = await db.execute(
        "SELECT environment, COUNT(*) FROM gateways WHERE is_active = true AND environment IS NOT NULL GROUP BY environment"
    )
    environment_counts = {row[0]: row[1] for row in result.all()}
    
    # Count targets
    result = await db.execute(
        "SELECT COUNT(*) FROM target_devices WHERE is_active = true"
    )
    total_targets = result.scalar()
    
    # Count connected targets
    result = await db.execute(
        "SELECT COUNT(*) FROM target_devices WHERE is_active = true AND status = 'available'"
    )
    connected_targets = result.scalar()
    
    # Count active sessions
    result = await db.execute(
        "SELECT SUM(current_sessions) FROM gateways WHERE is_active = true"
    )
    total_sessions = result.scalar() or 0
    
    return GatewayStatistics(
        total_gateways=sum(status_counts.values()),
        online_gateways=status_counts.get(GatewayStatus.ONLINE, 0),
        offline_gateways=status_counts.get(GatewayStatus.OFFLINE, 0),
        maintenance_gateways=status_counts.get(GatewayStatus.MAINTENANCE, 0),
        degraded_gateways=status_counts.get(GatewayStatus.DEGRADED, 0),
        total_targets=total_targets,
        connected_targets=connected_targets,
        total_sessions=total_sessions,
        gateway_types=type_counts,
        regions=region_counts,
        environments=environment_counts
    )

@router.get("/{gateway_id}/audit-logs", response_model=List[GatewayAuditLogResponse])
async def get_gateway_audit_logs(
    gateway_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get audit logs for a specific gateway.
    """
    # Check if gateway exists
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Get audit logs
    result = await db.execute(
        select(GatewayAuditLog)
        .filter(GatewayAuditLog.gateway_id == gateway_id)
        .order_by(GatewayAuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    audit_logs = result.scalars().all()
    
    return audit_logs

@router.post("/{gateway_id}/associate-target", response_model=GatewayTargetAssociationResponse)
async def associate_target(
    gateway_id: str,
    association_data: GatewayTargetAssociation,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Associate a target with a gateway.
    """
    # Check if gateway exists
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Check if target exists
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == association_data.target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target not found"
        )
    
    # Check if target is already associated with another gateway
    if target.gateway_id and target.gateway_id != gateway_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target is already associated with gateway {target.gateway_id}. Disassociate first."
        )
    
    # Associate target with gateway
    target.gateway_id = gateway_id
    target.association_timestamp = association_data.association_timestamp
    target.association_status = association_data.association_status
    target.association_details = association_data.association_details
    
    # Update gateway target count
    gateway.current_targets = gateway.current_targets + 1
    
    await db.commit()
    await db.refresh(target)
    
    # Log the association event
    await log_gateway_event(
        db=db,
        gateway_id=gateway_id,
        action="target_associated",
        user_id=current_user.id,
        details={
            "target_id": target.id,
            "target_name": target.name,
            "association_status": target.association_status,
            "timestamp": target.association_timestamp.isoformat() if target.association_timestamp else None
        }
    )
    
    # Create response
    response = GatewayTargetAssociationResponse(
        gateway_id=gateway_id,
        target_id=target.id,
        target_name=target.name,
        association_timestamp=target.association_timestamp,
        association_status=target.association_status,
        association_details=target.association_details,
        association_health=target.association_health
    )
    
    return response

@router.post("/{gateway_id}/disassociate-target", response_model=GatewayTargetAssociationResponse)
async def disassociate_target(
    gateway_id: str,
    disassociation_data: GatewayTargetDisassociation,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Disassociate a target from a gateway.
    """
    # Check if gateway exists
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Check if target exists
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == disassociation_data.target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target not found"
        )
    
    # Check if target is associated with this gateway
    if target.gateway_id != gateway_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target is not associated with gateway {gateway_id}"
        )
    
    # Check if target is in use and force flag is not set
    if target.status == DeviceStatus.RESERVED and not disassociation_data.force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target is currently reserved. Use force=true to disassociate anyway."
        )
    
    # Store current association data for response
    current_association = {
        "gateway_id": target.gateway_id,
        "target_id": target.id,
        "target_name": target.name,
        "association_timestamp": target.association_timestamp,
        "association_status": target.association_status,
        "association_details": target.association_details,
        "association_health": target.association_health
    }
    
    # Disassociate target from gateway
    target.association_status = "disconnected"
    target.association_details = {
        "reason": disassociation_data.reason,
        "forced": disassociation_data.force,
        "previous_gateway_id": target.gateway_id,
        "disassociated_at": datetime.utcnow().isoformat(),
        "disassociated_by": current_user.id
    }
    
    # Update target status if it was available
    if target.status == DeviceStatus.AVAILABLE:
        target.status = DeviceStatus.OFFLINE
    
    # Update gateway target count
    if gateway.current_targets > 0:
        gateway.current_targets = gateway.current_targets - 1
    
    await db.commit()
    
    # Log the disassociation event
    await log_gateway_event(
        db=db,
        gateway_id=gateway_id,
        action="target_disassociated",
        user_id=current_user.id,
        details={
            "target_id": target.id,
            "target_name": target.name,
            "reason": disassociation_data.reason,
            "forced": disassociation_data.force,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    # Create response using the stored association data
    response = GatewayTargetAssociationResponse(**current_association)
    
    return response

@router.post("/{gateway_id}/bulk-associate", response_model=List[GatewayTargetAssociationResponse])
async def bulk_associate_targets(
    gateway_id: str,
    association_data: BulkGatewayTargetAssociation,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Associate multiple targets with a gateway in a single operation.
    """
    # Check if gateway exists
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Get all targets
    result = await db.execute(
        select(TargetDevice).filter(TargetDevice.id.in_(association_data.target_ids))
    )
    targets = result.scalars().all()
    
    # Check if all targets exist
    if len(targets) != len(association_data.target_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more targets not found"
        )
    
    # Check if any targets are already associated with another gateway
    already_associated = [
        target for target in targets 
        if target.gateway_id and target.gateway_id != gateway_id
    ]
    
    if already_associated:
        target_names = [target.name for target in already_associated]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Targets {', '.join(target_names)} are already associated with other gateways. Disassociate first."
        )
    
    # Associate targets with gateway
    responses = []
    for target in targets:
        target.gateway_id = gateway_id
        target.association_timestamp = datetime.utcnow()
        target.association_status = association_data.association_status
        target.association_details = association_data.association_details
        
        responses.append(
            GatewayTargetAssociationResponse(
                gateway_id=gateway_id,
                target_id=target.id,
                target_name=target.name,
                association_timestamp=target.association_timestamp,
                association_status=target.association_status,
                association_details=target.association_details,
                association_health=target.association_health
            )
        )
    
    # Update gateway target count
    gateway.current_targets = gateway.current_targets + len(targets)
    
    await db.commit()
    
    # Log the bulk association event
    await log_gateway_event(
        db=db,
        gateway_id=gateway_id,
        action="bulk_target_associated",
        user_id=current_user.id,
        details={
            "target_count": len(targets),
            "target_ids": [target.id for target in targets],
            "target_names": [target.name for target in targets],
            "association_status": association_data.association_status,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    return responses

@router.post("/{gateway_id}/bulk-disassociate", response_model=List[GatewayTargetAssociationResponse])
async def bulk_disassociate_targets(
    gateway_id: str,
    disassociation_data: BulkGatewayTargetDisassociation,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Disassociate multiple targets from a gateway in a single operation.
    """
    # Check if gateway exists
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Get all targets
    result = await db.execute(
        select(TargetDevice).filter(
            and_(
                TargetDevice.id.in_(disassociation_data.target_ids),
                TargetDevice.gateway_id == gateway_id
            )
        )
    )
    targets = result.scalars().all()
    
    # Check if all targets exist and are associated with this gateway
    if len(targets) != len(disassociation_data.target_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more targets not found or not associated with this gateway"
        )
    
    # Check if any targets are in use and force flag is not set
    if not disassociation_data.force:
        reserved_targets = [
            target for target in targets 
            if target.status == DeviceStatus.RESERVED
        ]
        
        if reserved_targets:
            target_names = [target.name for target in reserved_targets]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Targets {', '.join(target_names)} are currently reserved. Use force=true to disassociate anyway."
            )
    
    # Store current association data for response
    responses = []
    for target in targets:
        responses.append(
            GatewayTargetAssociationResponse(
                gateway_id=target.gateway_id,
                target_id=target.id,
                target_name=target.name,
                association_timestamp=target.association_timestamp,
                association_status=target.association_status,
                association_details=target.association_details,
                association_health=target.association_health
            )
        )
        
        # Disassociate target from gateway
        target.association_status = "disconnected"
        target.association_details = {
            "reason": disassociation_data.reason,
            "forced": disassociation_data.force,
            "previous_gateway_id": target.gateway_id,
            "disassociated_at": datetime.utcnow().isoformat(),
            "disassociated_by": current_user.id
        }
        
        # Update target status if it was available
        if target.status == DeviceStatus.AVAILABLE:
            target.status = DeviceStatus.OFFLINE
    
    # Update gateway target count
    gateway.current_targets = max(0, gateway.current_targets - len(targets))
    
    await db.commit()
    
    # Log the bulk disassociation event
    await log_gateway_event(
        db=db,
        gateway_id=gateway_id,
        action="bulk_target_disassociated",
        user_id=current_user.id,
        details={
            "target_count": len(targets),
            "target_ids": [target.id for target in targets],
            "target_names": [target.name for target in targets],
            "reason": disassociation_data.reason,
            "forced": disassociation_data.force,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    return responses

@router.get("/{gateway_id}/targets", response_model=List[GatewayTargetAssociationResponse])
async def get_gateway_targets(
    gateway_id: str,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get all targets associated with a gateway.
    """
    # Check if gateway exists
    result = await db.execute(select(Gateway).filter(Gateway.gateway_id == gateway_id))
    gateway = result.scalars().first()
    
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found"
        )
    
    # Get targets
    query = select(TargetDevice).filter(TargetDevice.gateway_id == gateway_id)
    
    if status:
        query = query.filter(TargetDevice.status == status)
    
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    targets = result.scalars().all()
    
    # Create response
    responses = []
    for target in targets:
        responses.append(
            GatewayTargetAssociationResponse(
                gateway_id=gateway_id,
                target_id=target.id,
                target_name=target.name,
                association_timestamp=target.association_timestamp,
                association_status=target.association_status,
                association_details=target.association_details,
                association_health=target.association_health
            )
        )
    
    return responses

@router.post("/import", response_model=List[GatewayResponse])
async def import_gateways(
    import_data: ImportGatewaysRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Import multiple gateways from a list.
    """
    imported_gateways = []
    
    for gateway_data in import_data.gateways:
        # Check if gateway with same gateway_id already exists
        result = await db.execute(
            select(Gateway).filter(Gateway.gateway_id == gateway_data.gateway_id)
        )
        existing_gateway = result.scalars().first()
        
        if existing_gateway:
            if import_data.update_existing:
                # Update existing gateway
                for field, value in gateway_data.dict().items():
                    setattr(existing_gateway, field, value)
                
                existing_gateway.updated_by = current_user.id
                existing_gateway.updated_at = datetime.utcnow()
                
                await db.commit()
                await db.refresh(existing_gateway)
                
                imported_gateways.append(existing_gateway)
                
                # Log the update event
                await log_gateway_event(
                    db=db,
                    gateway_id=existing_gateway.gateway_id,
                    action="updated_via_import",
                    user_id=current_user.id,
                    details={"fields_updated": list(gateway_data.dict().keys())}
                )
            else:
                # Skip existing gateway
                continue
        else:
            # Create new gateway
            new_gateway = Gateway(**gateway_data.dict(), created_by=current_user.id)
            db.add(new_gateway)
            await db.commit()
            await db.refresh(new_gateway)
            
            imported_gateways.append(new_gateway)
            
            # Log the creation event
            await log_gateway_event(
                db=db,
                gateway_id=new_gateway.gateway_id,
                action="created_via_import",
                user_id=current_user.id,
                details={"name": new_gateway.name, "gateway_type": new_gateway.gateway_type}
            )
    
    return imported_gateways

@router.post("/export", status_code=status.HTTP_200_OK)
async def export_gateways(
    export_data: ExportGatewaysRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Export gateways to JSON or CSV format.
    """
    # Build query based on filter
    query = select(Gateway)
    
    if export_data.gateway_ids:
        query = query.filter(Gateway.id.in_(export_data.gateway_ids))
    
    if export_data.filter:
        filter_data = export_data.filter
        
        if filter_data.status:
            query = query.filter(Gateway.status.in_(filter_data.status))
        
        if filter_data.gateway_type:
            query = query.filter(Gateway.gateway_type.in_(filter_data.gateway_type))
        
        if filter_data.is_active is not None:
            query = query.filter(Gateway.is_active == filter_data.is_active)
        
        if filter_data.tags:
            # This is a simplified approach for JSON fields
            # In a real implementation, you would need a more sophisticated query
            for tag in filter_data.tags:
                query = query.filter(Gateway.tags.contains(tag))
        
        if filter_data.region:
            query = query.filter(Gateway.region == filter_data.region)
        
        if filter_data.location:
            query = query.filter(Gateway.location == filter_data.location)
        
        if filter_data.environment:
            query = query.filter(Gateway.environment == filter_data.environment)
        
        if filter_data.parent_gateway_id:
            query = query.filter(Gateway.parent_gateway_id == filter_data.parent_gateway_id)
        
        if filter_data.health_score_min:
            query = query.filter(Gateway.health_check_score >= filter_data.health_score_min)
        
        if filter_data.search:
            query = query.filter(
                or_(
                    Gateway.name.ilike(f"%{filter_data.search}%"),
                    Gateway.gateway_id.ilike(f"%{filter_data.search}%"),
                    Gateway.description.ilike(f"%{filter_data.search}%")
                )
            )
    
    # Execute query
    result = await db.execute(query)
    gateways = result.scalars().all()
    
    # Format data based on requested format
    if export_data.format.lower() == "json":
        # Convert to JSON
        gateway_data = [
            {
                "id": gateway.id,
                "gateway_id": gateway.gateway_id,
                "name": gateway.name,
                "description": gateway.description,
                "gateway_type": gateway.gateway_type,
                "parent_gateway_id": gateway.parent_gateway_id,
                "status": gateway.status,
                "hostname": gateway.hostname,
                "ip_address": gateway.ip_address,
                "ssh_port": gateway.ssh_port,
                "api_port": gateway.api_port,
                "location": gateway.location,
                "region": gateway.region,
                "environment": gateway.environment,
                "max_targets": gateway.max_targets,
                "current_targets": gateway.current_targets,
                "max_concurrent_sessions": gateway.max_concurrent_sessions,
                "current_sessions": gateway.current_sessions,
                "tags": gateway.tags,
                "features": gateway.features,
                "created_at": gateway.created_at.isoformat() if gateway.created_at else None,
                "updated_at": gateway.updated_at.isoformat() if gateway.updated_at else None,
                "is_active": gateway.is_active
            }
            for gateway in gateways
        ]
        
        return {"gateways": gateway_data, "count": len(gateway_data), "format": "json"}
    
    elif export_data.format.lower() == "csv":
        # Convert to CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "id", "gateway_id", "name", "description", "gateway_type", "parent_gateway_id",
            "status", "hostname", "ip_address", "ssh_port", "api_port", "location",
            "region", "environment", "max_targets", "current_targets", 
            "max_concurrent_sessions", "current_sessions", "tags", "features",
            "created_at", "updated_at", "is_active"
        ])
        
        # Write data
        for gateway in gateways:
            writer.writerow([
                gateway.id,
                gateway.gateway_id,
                gateway.name,
                gateway.description,
                gateway.gateway_type,
                gateway.parent_gateway_id,
                gateway.status,
                gateway.hostname,
                gateway.ip_address,
                gateway.ssh_port,
                gateway.api_port,
                gateway.location,
                gateway.region,
                gateway.environment,
                gateway.max_targets,
                gateway.current_targets,
                gateway.max_concurrent_sessions,
                gateway.current_sessions,
                json.dumps(gateway.tags) if gateway.tags else "",
                json.dumps(gateway.features) if gateway.features else "",
                gateway.created_at.isoformat() if gateway.created_at else "",
                gateway.updated_at.isoformat() if gateway.updated_at else "",
                gateway.is_active
            ])
        
        csv_data = output.getvalue()
        output.close()
        
        return {"csv_data": csv_data, "count": len(gateways), "format": "csv"}
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format. Use 'json' or 'csv'."
        )
