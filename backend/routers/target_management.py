"""
Enhanced Target Management Router

This router provides additional endpoints for managing Android target devices,
including bulk operations, import/export, tagging, and advanced filtering.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, func, text
from typing import List, Any, Optional, Dict
from datetime import datetime, timedelta
import csv
import io
import json
import logging

from ..database import get_db
from ..models import User, TargetDevice, DeviceStatus, DeviceType, NetworkCapability
from ..schemas import (
    TargetDeviceResponse, 
    BulkTagRequest,
    BulkPurposeRequest,
    TargetFilterParams,
    ImportTargetsRequest,
    ExportTargetsRequest,
    ManualRefreshRequest,
    RemoveStaleTargetsRequest,
    TargetDeviceCreate
)
from ..auth import get_current_active_user, get_admin_user, get_developer_user
from ..notifications import notification_manager, EventType

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/target-management",
    tags=["target management"],
    responses={401: {"description": "Unauthorized"}},
)

@router.post("/bulk-tag", response_model=List[TargetDeviceResponse])
async def bulk_tag_targets(
    tag_request: BulkTagRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Apply tags to multiple target devices at once.
    """
    if not tag_request.target_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No target IDs provided"
        )
    
    # Get all targets
    result = await db.execute(
        select(TargetDevice).filter(TargetDevice.id.in_(tag_request.target_ids))
    )
    targets = result.scalars().all()
    
    if not targets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No targets found with the provided IDs"
        )
    
    # Update tags for each target
    for target in targets:
        if tag_request.operation == "add":
            # Add tags that don't already exist
            current_tags = target.tags or []
            new_tags = list(set(current_tags + tag_request.tags))
            target.tags = new_tags
        elif tag_request.operation == "remove":
            # Remove specified tags
            if target.tags:
                target.tags = [tag for tag in target.tags if tag not in tag_request.tags]
        elif tag_request.operation == "set":
            # Replace all tags
            target.tags = tag_request.tags
        
        target.updated_by = current_user.id
    
    await db.commit()
    
    # Refresh all targets
    for target in targets:
        await db.refresh(target)
    
    # Log the event
    notification_manager.log_event(
        EventType.TARGET_UPDATED,
        user_id=current_user.id,
        details={
            "operation": f"bulk_tag_{tag_request.operation}",
            "target_ids": tag_request.target_ids,
            "tags": tag_request.tags
        }
    )
    
    return targets

@router.post("/bulk-purpose", response_model=List[TargetDeviceResponse])
async def bulk_purpose_assignment(
    purpose_request: BulkPurposeRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Assign purpose categories to multiple target devices at once.
    """
    if not purpose_request.target_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No target IDs provided"
        )
    
    # Get all targets
    result = await db.execute(
        select(TargetDevice).filter(TargetDevice.id.in_(purpose_request.target_ids))
    )
    targets = result.scalars().all()
    
    if not targets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No targets found with the provided IDs"
        )
    
    # Update purpose for each target
    for target in targets:
        if purpose_request.operation == "add":
            # Add purpose categories that don't already exist
            current_purpose = target.purpose or []
            new_purpose = list(set(current_purpose + purpose_request.purpose))
            target.purpose = new_purpose
        elif purpose_request.operation == "remove":
            # Remove specified purpose categories
            if target.purpose:
                target.purpose = [p for p in target.purpose if p not in purpose_request.purpose]
        elif purpose_request.operation == "set":
            # Replace all purpose categories
            target.purpose = purpose_request.purpose
        
        target.updated_by = current_user.id
    
    await db.commit()
    
    # Refresh all targets
    for target in targets:
        await db.refresh(target)
    
    # Log the event
    notification_manager.log_event(
        EventType.TARGET_UPDATED,
        user_id=current_user.id,
        details={
            "operation": f"bulk_purpose_{purpose_request.operation}",
            "target_ids": purpose_request.target_ids,
            "purpose": purpose_request.purpose
        }
    )
    
    return targets

@router.post("/advanced-search", response_model=List[TargetDeviceResponse])
async def advanced_search(
    filter_params: TargetFilterParams,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Advanced search for target devices with complex filtering.
    """
    query = select(TargetDevice)
    
    # Apply filters
    filters = []
    
    # Status filter
    if filter_params.status:
        filters.append(TargetDevice.status.in_(filter_params.status))
    
    # Device type filter
    if filter_params.device_type:
        filters.append(TargetDevice.device_type.in_(filter_params.device_type))
    
    # Active status filter
    if filter_params.is_active is not None:
        filters.append(TargetDevice.is_active == filter_params.is_active)
    
    # Tags filter
    if filter_params.tags:
        for tag in filter_params.tags:
            filters.append(TargetDevice.tags.contains([tag]))
    
    # Purpose filter
    if filter_params.purpose:
        for purpose in filter_params.purpose:
            filters.append(TargetDevice.purpose.contains([purpose]))
    
    # Android version filter
    if filter_params.android_version:
        filters.append(TargetDevice.android_version == filter_params.android_version)
    
    # API level range filter
    if filter_params.api_level_min is not None:
        filters.append(TargetDevice.api_level >= filter_params.api_level_min)
    
    if filter_params.api_level_max is not None:
        filters.append(TargetDevice.api_level <= filter_params.api_level_max)
    
    # Manufacturer filter
    if filter_params.manufacturer:
        filters.append(TargetDevice.manufacturer == filter_params.manufacturer)
    
    # Model filter
    if filter_params.model:
        filters.append(TargetDevice.model == filter_params.model)
    
    # Location filter
    if filter_params.location:
        filters.append(TargetDevice.location == filter_params.location)
    
    # Network capabilities filter
    if filter_params.network_capabilities:
        for capability in filter_params.network_capabilities:
            filters.append(TargetDevice.network_capabilities.contains([capability]))
    
    # Health score filter
    if filter_params.health_score_min is not None:
        filters.append(TargetDevice.health_check_score >= filter_params.health_score_min)
    
    # Search across multiple fields
    if filter_params.search:
        search_term = f"%{filter_params.search}%"
        search_filters = [
            TargetDevice.name.ilike(search_term),
            TargetDevice.serial_number.ilike(search_term),
            TargetDevice.manufacturer.ilike(search_term),
            TargetDevice.model.ilike(search_term),
            TargetDevice.location.ilike(search_term),
            TargetDevice.android_version.ilike(search_term)
        ]
        filters.append(or_(*search_filters))
    
    # Apply all filters
    if filters:
        query = query.filter(and_(*filters))
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    targets = result.scalars().all()
    
    return targets

@router.post("/import", response_model=List[TargetDeviceResponse])
async def import_targets(
    import_request: ImportTargetsRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Import multiple target devices from a JSON payload.
    """
    if not import_request.targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No targets provided for import"
        )
    
    imported_targets = []
    
    for target_data in import_request.targets:
        # Check if device with same serial number already exists
        if target_data.serial_number:
            result = await db.execute(
                select(TargetDevice).filter(TargetDevice.serial_number == target_data.serial_number)
            )
            existing_device = result.scalars().first()
            
            if existing_device:
                if import_request.update_existing:
                    # Update existing device
                    update_data = target_data.dict(exclude_unset=True)
                    for field, value in update_data.items():
                        setattr(existing_device, field, value)
                    
                    existing_device.updated_by = current_user.id
                    imported_targets.append(existing_device)
                    continue
                else:
                    # Skip existing device
                    continue
        
        # Create new device
        new_device = TargetDevice(**target_data.dict(), status=DeviceStatus.OFFLINE, created_by=current_user.id)
        db.add(new_device)
        imported_targets.append(new_device)
    
    await db.commit()
    
    # Refresh all devices
    for device in imported_targets:
        await db.refresh(device)
    
    # Log the event
    notification_manager.log_event(
        EventType.TARGET_REGISTERED,
        user_id=current_user.id,
        details={
            "operation": "import",
            "count": len(imported_targets),
            "update_existing": import_request.update_existing
        }
    )
    
    return imported_targets

@router.post("/export")
async def export_targets(
    export_request: ExportTargetsRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Export target devices to JSON or CSV format.
    """
    # Build query
    query = select(TargetDevice)
    
    # Apply target ID filter if provided
    if export_request.target_ids:
        query = query.filter(TargetDevice.id.in_(export_request.target_ids))
    
    # Apply additional filters if provided
    if export_request.filter:
        filters = []
        
        # Status filter
        if export_request.filter.status:
            filters.append(TargetDevice.status.in_(export_request.filter.status))
        
        # Device type filter
        if export_request.filter.device_type:
            filters.append(TargetDevice.device_type.in_(export_request.filter.device_type))
        
        # Active status filter
        if export_request.filter.is_active is not None:
            filters.append(TargetDevice.is_active == export_request.filter.is_active)
        
        # Tags filter
        if export_request.filter.tags:
            for tag in export_request.filter.tags:
                filters.append(TargetDevice.tags.contains([tag]))
        
        # Purpose filter
        if export_request.filter.purpose:
            for purpose in export_request.filter.purpose:
                filters.append(TargetDevice.purpose.contains([purpose]))
        
        # Apply all filters
        if filters:
            query = query.filter(and_(*filters))
    
    # Execute query
    result = await db.execute(query)
    targets = result.scalars().all()
    
    # Convert to response model
    target_responses = [TargetDeviceResponse.from_orm(target) for target in targets]
    
    # Export in requested format
    if export_request.format.lower() == "json":
        # Convert to JSON
        target_dicts = [target.dict() for target in target_responses]
        
        # Log the event
        notification_manager.log_event(
            EventType.TARGET_EXPORTED,
            user_id=current_user.id,
            details={
                "format": "json",
                "count": len(target_dicts)
            }
        )
        
        return {"targets": target_dicts, "count": len(target_dicts), "format": "json"}
    
    elif export_request.format.lower() == "csv":
        # Convert to CSV
        if not target_responses:
            return {"error": "No targets found to export"}
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=target_responses[0].dict().keys())
        writer.writeheader()
        
        for target in target_responses:
            # Convert datetime objects to strings
            target_dict = target.dict()
            for key, value in target_dict.items():
                if isinstance(value, datetime):
                    target_dict[key] = value.isoformat()
                elif isinstance(value, (list, dict)):
                    target_dict[key] = json.dumps(value)
            
            writer.writerow(target_dict)
        
        csv_data = output.getvalue()
        
        # Log the event
        notification_manager.log_event(
            EventType.TARGET_EXPORTED,
            user_id=current_user.id,
            details={
                "format": "csv",
                "count": len(target_responses)
            }
        )
        
        return {"csv_data": csv_data, "count": len(target_responses), "format": "csv"}
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format: {export_request.format}"
        )

async def _refresh_targets_task(target_ids, gateway_id, db):
    """Background task to refresh target devices."""
    async with db.begin():
        query = select(TargetDevice)
        
        if target_ids:
            query = query.filter(TargetDevice.id.in_(target_ids))
        
        if gateway_id:
            query = query.filter(TargetDevice.gateway_id == gateway_id)
        
        result = await db.execute(query)
        targets = result.scalars().all()
        
        for target in targets:
            # Update last_heartbeat to trigger a refresh
            target.last_heartbeat = datetime.utcnow() - timedelta(
                seconds=target.heartbeat_interval_seconds * 2
            )
        
        await db.commit()
    
    logger.info(f"Refreshed {len(targets)} targets")

@router.post("/refresh")
async def manual_refresh(
    refresh_request: ManualRefreshRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Trigger a manual refresh of target devices.
    """
    # Add the refresh task to background tasks
    background_tasks.add_task(
        _refresh_targets_task,
        refresh_request.target_ids,
        refresh_request.gateway_id,
        db
    )
    
    # Log the event
    notification_manager.log_event(
        EventType.TARGET_REFRESH_REQUESTED,
        user_id=current_user.id,
        details={
            "target_ids": refresh_request.target_ids,
            "gateway_id": refresh_request.gateway_id
        }
    )
    
    return {
        "message": "Refresh request submitted",
        "target_ids": refresh_request.target_ids,
        "gateway_id": refresh_request.gateway_id
    }

@router.post("/remove-stale")
async def remove_stale_targets(
    stale_request: RemoveStaleTargetsRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Remove stale target devices that haven't sent a heartbeat in a while.
    """
    # Calculate the threshold timestamp
    threshold = datetime.utcnow() - timedelta(hours=stale_request.hours_threshold)
    
    # Build query for stale targets
    query = select(TargetDevice).filter(
        (TargetDevice.last_heartbeat < threshold) | (TargetDevice.last_heartbeat.is_(None))
    )
    
    if stale_request.gateway_id:
        query = query.filter(TargetDevice.gateway_id == stale_request.gateway_id)
    
    # Execute query
    result = await db.execute(query)
    stale_targets = result.scalars().all()
    
    if not stale_targets:
        return {"message": "No stale targets found", "count": 0}
    
    # Deactivate stale targets
    for target in stale_targets:
        target.is_active = False
        target.status = DeviceStatus.OFFLINE
        target.updated_by = current_user.id
    
    await db.commit()
    
    # Log the event
    notification_manager.log_event(
        EventType.TARGET_REMOVED,
        user_id=current_user.id,
        details={
            "operation": "remove_stale",
            "count": len(stale_targets),
            "hours_threshold": stale_request.hours_threshold,
            "gateway_id": stale_request.gateway_id
        }
    )
    
    return {
        "message": f"Deactivated {len(stale_targets)} stale targets",
        "count": len(stale_targets),
        "target_ids": [target.id for target in stale_targets]
    }

@router.get("/stats")
async def get_target_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get statistics about target devices.
    """
    # Total count
    result = await db.execute(select(func.count(TargetDevice.id)))
    total_count = result.scalar()
    
    # Count by status
    status_counts = {}
    for status in DeviceStatus:
        result = await db.execute(
            select(func.count(TargetDevice.id)).filter(TargetDevice.status == status)
        )
        status_counts[status.value] = result.scalar()
    
    # Count by device type
    type_counts = {}
    for device_type in DeviceType:
        result = await db.execute(
            select(func.count(TargetDevice.id)).filter(TargetDevice.device_type == device_type)
        )
        type_counts[device_type.value] = result.scalar()
    
    # Count by active status
    result = await db.execute(
        select(func.count(TargetDevice.id)).filter(TargetDevice.is_active == True)
    )
    active_count = result.scalar()
    
    # Count by health score ranges
    health_counts = {
        "excellent": 0,
        "good": 0,
        "fair": 0,
        "poor": 0,
        "unknown": 0
    }
    
    result = await db.execute(
        select(func.count(TargetDevice.id)).filter(TargetDevice.health_check_score.is_(None))
    )
    health_counts["unknown"] = result.scalar()
    
    result = await db.execute(
        select(func.count(TargetDevice.id)).filter(TargetDevice.health_check_score >= 90)
    )
    health_counts["excellent"] = result.scalar()
    
    result = await db.execute(
        select(func.count(TargetDevice.id)).filter(
            (TargetDevice.health_check_score >= 70) & (TargetDevice.health_check_score < 90)
        )
    )
    health_counts["good"] = result.scalar()
    
    result = await db.execute(
        select(func.count(TargetDevice.id)).filter(
            (TargetDevice.health_check_score >= 50) & (TargetDevice.health_check_score < 70)
        )
    )
    health_counts["fair"] = result.scalar()
    
    result = await db.execute(
        select(func.count(TargetDevice.id)).filter(
            (TargetDevice.health_check_score < 50) & (TargetDevice.health_check_score.is_not(None))
        )
    )
    health_counts["poor"] = result.scalar()
    
    # Get most common tags
    result = await db.execute(text("""
        SELECT unnest(tags) as tag, count(*) as count
        FROM target_devices
        WHERE tags IS NOT NULL
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 10
    """))
    top_tags = [{"tag": row[0], "count": row[1]} for row in result.fetchall()]
    
    # Get most common purposes
    result = await db.execute(text("""
        SELECT unnest(purpose) as purpose, count(*) as count
        FROM target_devices
        WHERE purpose IS NOT NULL
        GROUP BY purpose
        ORDER BY count DESC
        LIMIT 10
    """))
    top_purposes = [{"purpose": row[0], "count": row[1]} for row in result.fetchall()]
    
    return {
        "total_count": total_count,
        "active_count": active_count,
        "inactive_count": total_count - active_count,
        "status_counts": status_counts,
        "type_counts": type_counts,
        "health_counts": health_counts,
        "top_tags": top_tags,
        "top_purposes": top_purposes
    }
