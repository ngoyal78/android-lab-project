from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Any, Optional
from datetime import datetime
import logging

from ..database import get_db
from ..models import User, TargetDevice, DeviceStatus, DeviceType
from ..schemas import (
    TargetDeviceResponse, 
    TargetDeviceUpdate, 
    HeartbeatRequest, 
    TargetDeviceCreate,
    TargetDeviceDeactivate
)
from ..auth import get_current_active_user, get_admin_user, get_developer_user
from ..notifications import notification_manager, EventType

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/targets",
    tags=["targets"],
    responses={401: {"description": "Unauthorized"}},
)

# Log API calls using a dependency instead of middleware
async def log_request(request: Request):
    """
    Log API requests for audit trail
    """
    # Get request details
    method = request.method
    path = request.url.path
    
    # Get user from request if authenticated
    user_id = None
    if hasattr(request.state, "user"):
        user_id = request.state.user.id
    
    # Log the request
    logger.info(f"API Request: {method} {path} by user {user_id}")

@router.post("/", response_model=TargetDeviceResponse, status_code=status.HTTP_201_CREATED)
async def register_target(
    target_data: TargetDeviceCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Register a new target device.
    """
    # Check if device with same serial number already exists
    if target_data.serial_number:
        result = await db.execute(
            select(TargetDevice).filter(TargetDevice.serial_number == target_data.serial_number)
        )
        existing_device = result.scalars().first()
        if existing_device:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target device with this serial number already exists"
            )
    
    # Create new device
    new_device = TargetDevice(**target_data.dict(), status=DeviceStatus.OFFLINE)
    db.add(new_device)
    await db.commit()
    await db.refresh(new_device)
    
    # Log the event
    notification_manager.log_event(
        EventType.TARGET_REGISTERED,
        user_id=current_user.id,
        target_id=new_device.id,
        details={"name": new_device.name, "device_type": new_device.device_type}
    )
    
    return new_device

@router.get("/", response_model=List[TargetDeviceResponse])
async def list_targets(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    is_active: Optional[bool] = True,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Retrieve target devices with optional filtering.
    """
    query = select(TargetDevice)
    
    # Apply filters if provided
    if status:
        query = query.filter(TargetDevice.status == status)
    
    if device_type:
        query = query.filter(TargetDevice.device_type == device_type)
    
    if is_active is not None:
        query = query.filter(TargetDevice.is_active == is_active)
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    targets = result.scalars().all()
    
    return targets

@router.get("/{target_id}", response_model=TargetDeviceResponse)
async def read_target(
    target_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get a specific target device by id.
    """
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    return target

@router.put("/{target_id}", response_model=TargetDeviceResponse)
async def update_target(
    target_id: int,
    target_data: TargetDeviceUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Update a target device. Only accessible to admin users.
    """
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Store original values for audit logging
    original_values = {
        "name": target.name,
        "device_type": target.device_type,
        "status": target.status
    }
    
    # Update target fields if provided
    update_data = target_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(target, field, value)
    
    await db.commit()
    await db.refresh(target)
    
    # Log the update event
    notification_manager.log_event(
        EventType.TARGET_UPDATED,
        user_id=current_user.id,
        target_id=target.id,
        details={
            "original": original_values,
            "updated": update_data
        }
    )
    
    return target

@router.post("/{target_id}/deactivate", response_model=TargetDeviceResponse)
async def deactivate_target(
    target_id: int,
    deactivate_data: TargetDeviceDeactivate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Deactivate a target device. This is a soft delete operation.
    Only accessible to admin users.
    """
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Deactivate the target
    target.is_active = False
    target.status = DeviceStatus.MAINTENANCE
    
    await db.commit()
    await db.refresh(target)
    
    # Log the deactivation event
    notification_manager.log_event(
        EventType.TARGET_REMOVED,
        user_id=current_user.id,
        target_id=target.id,
        details={"reason": deactivate_data.reason} if deactivate_data.reason else None
    )
    
    return target

@router.delete("/{target_id}", response_model=TargetDeviceResponse)
async def delete_target(
    target_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Hard delete a target device. Only accessible to admin users.
    This is not recommended for normal operations - use deactivate instead.
    """
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Store target info for audit log
    target_info = {
        "id": target.id,
        "name": target.name,
        "device_type": target.device_type,
        "serial_number": target.serial_number
    }
    
    await db.delete(target)
    await db.commit()
    
    # Log the deletion event
    notification_manager.log_event(
        EventType.TARGET_REMOVED,
        user_id=current_user.id,
        details=target_info
    )
    
    return target

@router.post("/heartbeat", response_model=List[TargetDeviceResponse])
async def process_heartbeat(
    heartbeat_data: HeartbeatRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Process heartbeat from gateway agent with target device status updates.
    This endpoint is open for gateway agents to report device status.
    """
    updated_targets = []
    new_targets = []
    status_changed_targets = []
    
    for device_data in heartbeat_data.devices:
        # Check if device already exists by serial number or combination of gateway_id and name
        query = select(TargetDevice).filter(
            (TargetDevice.serial_number == device_data.serial_number) |
            ((TargetDevice.gateway_id == device_data.gateway_id) & (TargetDevice.name == device_data.name))
        )
        result = await db.execute(query)
        device = result.scalars().first()
        
        if device:
            # Store original status for audit logging
            original_status = device.status
            
            # Update existing device
            for field, value in device_data.dict().items():
                if field != "status":  # Don't override reservation status
                    setattr(device, field, value)
            
            # Update status only if not reserved
            if device.status != DeviceStatus.RESERVED and device.status != DeviceStatus.MAINTENANCE:
                device.status = DeviceStatus.AVAILABLE
                
                # Track status changes for audit logging
                if original_status != device.status:
                    status_changed_targets.append({
                        "id": device.id,
                        "name": device.name,
                        "original_status": original_status,
                        "new_status": device.status
                    })
            
            device.last_heartbeat = datetime.utcnow()
            updated_targets.append(device)
        else:
            # Create new device
            new_device = TargetDevice(
                **device_data.dict(), 
                status=DeviceStatus.AVAILABLE, 
                last_heartbeat=datetime.utcnow(),
                is_active=True
            )
            db.add(new_device)
            updated_targets.append(new_device)
            new_targets.append(new_device)
    
    # Mark devices not in heartbeat as offline
    gateway_id = heartbeat_data.gateway_id
    current_device_names = [device.name for device in heartbeat_data.devices]
    
    query = select(TargetDevice).filter(
        (TargetDevice.gateway_id == gateway_id) & 
        (TargetDevice.name.not_in(current_device_names)) &
        (TargetDevice.is_active == True)  # Only consider active devices
    )
    result = await db.execute(query)
    missing_devices = result.scalars().all()
    
    for device in missing_devices:
        if device.status != DeviceStatus.RESERVED and device.status != DeviceStatus.MAINTENANCE:
            # Store original status for audit logging
            original_status = device.status
            
            device.status = DeviceStatus.OFFLINE
            device.adb_status = False
            device.serial_status = False
            updated_targets.append(device)
            
            # Track status changes for audit logging
            if original_status != device.status:
                status_changed_targets.append({
                    "id": device.id,
                    "name": device.name,
                    "original_status": original_status,
                    "new_status": device.status
                })
    
    await db.commit()
    
    # Refresh all devices to get updated data
    for device in updated_targets:
        await db.refresh(device)
    
    # Log events for new devices
    for device in new_targets:
        notification_manager.log_event(
            EventType.TARGET_REGISTERED,
            target_id=device.id,
            gateway_id=gateway_id,
            details={
                "name": device.name,
                "device_type": device.device_type,
                "auto_registered": True
            }
        )
    
    # Log events for status changes
    for status_change in status_changed_targets:
        event_type = EventType.TARGET_CONNECTED if status_change["new_status"] == DeviceStatus.AVAILABLE else EventType.TARGET_DISCONNECTED
        notification_manager.log_event(
            event_type,
            target_id=status_change["id"],
            gateway_id=gateway_id,
            details={
                "name": status_change["name"],
                "original_status": status_change["original_status"],
                "new_status": status_change["new_status"]
            }
        )
    
    # Log the heartbeat event
    logger.info(f"Heartbeat from gateway {gateway_id}: {len(updated_targets)} devices updated")
    
    return updated_targets

@router.post("/{target_id}/reserve", response_model=TargetDeviceResponse)
async def reserve_target(
    target_id: int,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Reserve a target device for immediate use.
    This is a simplified reservation for immediate use, not scheduled.
    """
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    if target.status != DeviceStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target device is not available (current status: {target.status})"
        )
    
    # Reserve the device
    target.status = DeviceStatus.RESERVED
    # In a real implementation, we would store the user who reserved it
    # and create a proper reservation record
    
    await db.commit()
    await db.refresh(target)
    
    # Log the reservation event
    notification_manager.log_event(
        EventType.RESERVATION_STARTED,
        user_id=current_user.id,
        target_id=target.id,
        details={
            "target_name": target.name,
            "device_type": target.device_type,
            "immediate": True
        }
    )
    
    # Send notification about the reservation
    await notification_manager.notify_reservation_change(
        reservation_id=0,  # Placeholder for immediate reservations
        user_id=current_user.id,
        target_id=target.id,
        target_name=target.name,
        action="started"
    )
    
    return target

@router.post("/{target_id}/release", response_model=TargetDeviceResponse)
async def release_target(
    target_id: int,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Release a reserved target device.
    """
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    if target.status != DeviceStatus.RESERVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target device is not reserved"
        )
    
    # In a real implementation, we would check if the current user is the one who reserved it
    # or has admin privileges
    
    # Release the device
    target.status = DeviceStatus.AVAILABLE
    
    await db.commit()
    await db.refresh(target)
    
    # Log the release event
    notification_manager.log_event(
        EventType.RESERVATION_ENDED,
        user_id=current_user.id,
        target_id=target.id,
        details={
            "target_name": target.name,
            "device_type": target.device_type,
            "immediate": True
        }
    )
    
    # Send notification about the release
    await notification_manager.notify_reservation_change(
        reservation_id=0,  # Placeholder for immediate reservations
        user_id=current_user.id,
        target_id=target.id,
        target_name=target.name,
        action="ended"
    )
    
    return target
