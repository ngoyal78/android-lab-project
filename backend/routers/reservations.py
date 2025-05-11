from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func, desc
from typing import List, Any, Optional, Dict
from datetime import datetime, timedelta

from ..database import get_db
from ..models import (
    User, Reservation, TargetDevice, ReservationStatus, DeviceStatus, 
    ReservationPolicy, ReservationPriority
)
from ..schemas import (
    ReservationCreate, ReservationResponse, ReservationUpdate, 
    ReservationWithDetails
)
from ..auth import get_current_active_user, get_admin_user, get_developer_user
from ..notifications import notification_manager, NotificationType, EventType

router = APIRouter(
    prefix="/reservations",
    tags=["reservations"],
    responses={401: {"description": "Unauthorized"}},
)

@router.get("/", response_model=List[ReservationWithDetails])
async def read_reservations(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Retrieve reservations with optional filtering.
    Admin users can see all reservations, other users can only see their own.
    """
    query = select(
        Reservation, 
        TargetDevice.name.label("target_name"),
        TargetDevice.device_type.label("target_type"),
        User.username.label("user_username")
    ).join(
        TargetDevice, Reservation.target_id == TargetDevice.id
    ).join(
        User, Reservation.user_id == User.id
    )
    
    # Apply filters
    if status:
        query = query.filter(Reservation.status == status)
    
    # Non-admin users can only see their own reservations
    if current_user.role != "admin":
        query = query.filter(Reservation.user_id == current_user.id)
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    reservations_data = result.all()
    
    # Construct response with joined data
    reservations = []
    for res, target_name, target_type, username in reservations_data:
        reservation_dict = {
            **ReservationResponse.from_orm(res).dict(),
            "target_name": target_name,
            "target_type": target_type,
            "user_username": username
        }
        reservations.append(reservation_dict)
    
    return reservations

@router.get("/my", response_model=List[ReservationWithDetails])
async def read_my_reservations(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Retrieve current user's reservations with optional filtering.
    """
    query = select(
        Reservation, 
        TargetDevice.name.label("target_name"),
        TargetDevice.device_type.label("target_type"),
        User.username.label("user_username")
    ).join(
        TargetDevice, Reservation.target_id == TargetDevice.id
    ).join(
        User, Reservation.user_id == User.id
    ).filter(
        Reservation.user_id == current_user.id
    )
    
    # Apply filters
    if status:
        query = query.filter(Reservation.status == status)
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    reservations_data = result.all()
    
    # Construct response with joined data
    reservations = []
    for res, target_name, target_type, username in reservations_data:
        reservation_dict = {
            **ReservationResponse.from_orm(res).dict(),
            "target_name": target_name,
            "target_type": target_type,
            "user_username": username
        }
        reservations.append(reservation_dict)
    
    return reservations

@router.get("/{reservation_id}", response_model=ReservationWithDetails)
async def read_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get a specific reservation by id.
    Admin users can see any reservation, other users can only see their own.
    """
    query = select(
        Reservation, 
        TargetDevice.name.label("target_name"),
        TargetDevice.device_type.label("target_type"),
        User.username.label("user_username")
    ).join(
        TargetDevice, Reservation.target_id == TargetDevice.id
    ).join(
        User, Reservation.user_id == User.id
    ).filter(
        Reservation.id == reservation_id
    )
    
    # Non-admin users can only see their own reservations
    if current_user.role != "admin":
        query = query.filter(Reservation.user_id == current_user.id)
    
    result = await db.execute(query)
    reservation_data = result.first()
    
    if not reservation_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found or you don't have permission to view it"
        )
    
    res, target_name, target_type, username = reservation_data
    
    # Construct response with joined data
    reservation_dict = {
        **ReservationResponse.from_orm(res).dict(),
        "target_name": target_name,
        "target_type": target_type,
        "user_username": username
    }
    
    return reservation_dict

@router.post("/", response_model=ReservationResponse)
async def create_reservation(
    reservation_data: ReservationCreate,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Create a new reservation.
    """
    # Check if target exists
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == reservation_data.target_id))
    target = result.scalars().first()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Check for overlapping reservations
    query = select(Reservation).filter(
        Reservation.target_id == reservation_data.target_id,
        Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.ACTIVE]),
        or_(
            # New reservation starts during existing reservation
            and_(
                Reservation.start_time <= reservation_data.start_time,
                Reservation.end_time > reservation_data.start_time
            ),
            # New reservation ends during existing reservation
            and_(
                Reservation.start_time < reservation_data.end_time,
                Reservation.end_time >= reservation_data.end_time
            ),
            # New reservation completely contains existing reservation
            and_(
                Reservation.start_time >= reservation_data.start_time,
                Reservation.end_time <= reservation_data.end_time
            )
        )
    )
    
    result = await db.execute(query)
    overlapping_reservation = result.scalars().first()
    
    if overlapping_reservation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is an overlapping reservation for this target device"
        )
    
    # Create new reservation
    new_reservation = Reservation(
        user_id=current_user.id,
        target_id=reservation_data.target_id,
        start_time=reservation_data.start_time,
        end_time=reservation_data.end_time,
        status=ReservationStatus.PENDING
    )
    
    # If reservation starts now, mark it as active and update target status
    now = datetime.utcnow()
    if new_reservation.start_time <= now and new_reservation.end_time > now:
        new_reservation.status = ReservationStatus.ACTIVE
        target.status = DeviceStatus.RESERVED
    
    db.add(new_reservation)
    await db.commit()
    await db.refresh(new_reservation)
    
    return new_reservation

@router.put("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: int,
    reservation_data: ReservationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Update a reservation.
    Admin users can update any reservation, other users can only update their own.
    """
    # Get the reservation
    query = select(Reservation).filter(Reservation.id == reservation_id)
    
    # Non-admin users can only update their own reservations
    if current_user.role != "admin":
        query = query.filter(Reservation.user_id == current_user.id)
    
    result = await db.execute(query)
    reservation = result.scalars().first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found or you don't have permission to update it"
        )
    
    # If updating time window, check for overlapping reservations
    if reservation_data.start_time or reservation_data.end_time:
        start_time = reservation_data.start_time or reservation.start_time
        end_time = reservation_data.end_time or reservation.end_time
        
        query = select(Reservation).filter(
            Reservation.target_id == reservation.target_id,
            Reservation.id != reservation_id,
            Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.ACTIVE]),
            or_(
                # Updated reservation starts during existing reservation
                and_(
                    Reservation.start_time <= start_time,
                    Reservation.end_time > start_time
                ),
                # Updated reservation ends during existing reservation
                and_(
                    Reservation.start_time < end_time,
                    Reservation.end_time >= end_time
                ),
                # Updated reservation completely contains existing reservation
                and_(
                    Reservation.start_time >= start_time,
                    Reservation.end_time <= end_time
                )
            )
        )
        
        result = await db.execute(query)
        overlapping_reservation = result.scalars().first()
        
        if overlapping_reservation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="There is an overlapping reservation for this target device"
            )
    
    # Update reservation fields
    if reservation_data.start_time:
        reservation.start_time = reservation_data.start_time
    
    if reservation_data.end_time:
        reservation.end_time = reservation_data.end_time
    
    if reservation_data.status:
        old_status = reservation.status
        reservation.status = reservation_data.status
        
        # If status changed to active, update target status
        if old_status != ReservationStatus.ACTIVE and reservation.status == ReservationStatus.ACTIVE:
            result = await db.execute(select(TargetDevice).filter(TargetDevice.id == reservation.target_id))
            target = result.scalars().first()
            if target:
                target.status = DeviceStatus.RESERVED
        
        # If status changed from active, update target status
        if old_status == ReservationStatus.ACTIVE and reservation.status != ReservationStatus.ACTIVE:
            result = await db.execute(select(TargetDevice).filter(TargetDevice.id == reservation.target_id))
            target = result.scalars().first()
            if target:
                target.status = DeviceStatus.AVAILABLE
    
    await db.commit()
    await db.refresh(reservation)
    
    return reservation

@router.delete("/{reservation_id}", response_model=ReservationResponse)
async def delete_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete a reservation.
    Admin users can delete any reservation, other users can only delete their own.
    """
    # Get the reservation
    query = select(Reservation).filter(Reservation.id == reservation_id)
    
    # Non-admin users can only delete their own reservations
    if current_user.role != "admin":
        query = query.filter(Reservation.user_id == current_user.id)
    
    result = await db.execute(query)
    reservation = result.scalars().first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found or you don't have permission to delete it"
        )
    
    # If reservation is active, update target status
    if reservation.status == ReservationStatus.ACTIVE:
        result = await db.execute(select(TargetDevice).filter(TargetDevice.id == reservation.target_id))
        target = result.scalars().first()
        if target:
            target.status = DeviceStatus.AVAILABLE
    
    await db.delete(reservation)
    await db.commit()
    
    return reservation

@router.get("/availability", response_model=Dict[str, Any])
async def check_availability(
    target_id: int = Query(..., description="Target device ID to check availability for"),
    start_time: datetime = Query(..., description="Start time for the reservation"),
    end_time: datetime = Query(..., description="End time for the reservation"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Check if a target is available for reservation during the specified time window.
    Returns availability status and any conflicting reservations.
    """
    # Check if target exists
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Check if target is available (not offline, maintenance, etc.)
    if target.status not in [DeviceStatus.AVAILABLE, DeviceStatus.RESERVED]:
        return {
            "available": False,
            "reason": f"Target is {target.status}",
            "conflicts": []
        }
    
    # Check for overlapping reservations
    query = select(
        Reservation, 
        User.username.label("username")
    ).join(
        User, Reservation.user_id == User.id
    ).filter(
        Reservation.target_id == target_id,
        Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.ACTIVE]),
        or_(
            # New reservation starts during existing reservation
            and_(
                Reservation.start_time <= start_time,
                Reservation.end_time > start_time
            ),
            # New reservation ends during existing reservation
            and_(
                Reservation.start_time < end_time,
                Reservation.end_time >= end_time
            ),
            # New reservation completely contains existing reservation
            and_(
                Reservation.start_time >= start_time,
                Reservation.end_time <= end_time
            )
        )
    )
    
    result = await db.execute(query)
    conflicts = result.all()
    
    if conflicts:
        conflict_details = []
        for reservation, username in conflicts:
            conflict_details.append({
                "id": reservation.id,
                "user": username,
                "start_time": reservation.start_time,
                "end_time": reservation.end_time,
                "priority": reservation.priority,
                "is_admin_override": reservation.is_admin_override
            })
        
        return {
            "available": False,
            "reason": "Conflicting reservations exist",
            "conflicts": conflict_details
        }
    
    # Check if user has reached their daily reservation limit
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Get user's policies
    user_policies_query = select(ReservationPolicy).join(
        User.policies
    ).filter(
        User.id == current_user.id
    )
    user_policies_result = await db.execute(user_policies_query)
    user_policies = user_policies_result.scalars().all()
    
    # Get target's policies
    target_policies_query = select(ReservationPolicy).join(
        TargetDevice.policies
    ).filter(
        TargetDevice.id == target_id
    )
    target_policies_result = await db.execute(target_policies_query)
    target_policies = target_policies_result.scalars().all()
    
    # Combine policies and sort by priority
    all_policies = list(set(user_policies + target_policies))
    all_policies.sort(key=lambda p: p.priority_level, reverse=True)
    
    # If no policies, use default limits
    max_duration_minutes = 240  # 4 hours
    max_reservations_per_day = 3
    cooldown_minutes = 60
    
    if all_policies:
        # Use highest priority policy
        policy = all_policies[0]
        max_duration_minutes = policy.max_duration_minutes
        max_reservations_per_day = policy.max_reservations_per_day
        cooldown_minutes = policy.cooldown_minutes
    
    # Check duration
    requested_duration = (end_time - start_time).total_seconds() / 60
    if requested_duration > max_duration_minutes:
        return {
            "available": False,
            "reason": f"Reservation duration exceeds maximum allowed ({max_duration_minutes} minutes)",
            "conflicts": []
        }
    
    # Check daily limit
    daily_reservations_query = select(func.count()).select_from(Reservation).filter(
        Reservation.user_id == current_user.id,
        Reservation.start_time >= today_start,
        Reservation.start_time < today_end,
        Reservation.status != ReservationStatus.CANCELLED
    )
    daily_reservations_result = await db.execute(daily_reservations_query)
    daily_reservations_count = daily_reservations_result.scalar()
    
    if daily_reservations_count >= max_reservations_per_day:
        return {
            "available": False,
            "reason": f"You have reached your daily reservation limit ({max_reservations_per_day})",
            "conflicts": []
        }
    
    # Check cooldown period
    last_reservation_query = select(Reservation).filter(
        Reservation.user_id == current_user.id,
        Reservation.end_time <= start_time,
        Reservation.status != ReservationStatus.CANCELLED
    ).order_by(desc(Reservation.end_time)).limit(1)
    
    last_reservation_result = await db.execute(last_reservation_query)
    last_reservation = last_reservation_result.scalars().first()
    
    if last_reservation:
        cooldown_end = last_reservation.end_time + timedelta(minutes=cooldown_minutes)
        if start_time < cooldown_end:
            return {
                "available": False,
                "reason": f"Cooldown period of {cooldown_minutes} minutes has not elapsed since your last reservation",
                "conflicts": []
            }
    
    # All checks passed
    return {
        "available": True,
        "reason": "Target is available for reservation",
        "conflicts": []
    }

@router.post("/override", response_model=ReservationResponse)
async def create_override_reservation(
    reservation_data: ReservationCreate,
    override_reason: str = Query(..., description="Reason for the override"),
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Create a reservation with admin override, bypassing conflict checks.
    Only admin users can create override reservations.
    """
    # Check if target exists
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == reservation_data.target_id))
    target = result.scalars().first()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Create new reservation with override flag
    new_reservation = Reservation(
        user_id=current_user.id,
        target_id=reservation_data.target_id,
        start_time=reservation_data.start_time,
        end_time=reservation_data.end_time,
        status=ReservationStatus.PENDING,
        priority=ReservationPriority.CRITICAL,
        is_admin_override=True,
        override_reason=override_reason
    )
    
    # If reservation starts now, mark it as active and update target status
    now = datetime.utcnow()
    if new_reservation.start_time <= now and new_reservation.end_time > now:
        new_reservation.status = ReservationStatus.ACTIVE
        target.status = DeviceStatus.RESERVED
    
    db.add(new_reservation)
    await db.commit()
    await db.refresh(new_reservation)
    
    # Notify about the override
    await notification_manager.send_notification(
        f"Admin override reservation created for {target.name}",
        NotificationType.WARNING,
        data={
            "reservation_id": new_reservation.id,
            "target_id": target.id,
            "reason": override_reason
        }
    )
    
    return new_reservation

@router.post("/expire-stale", response_model=Dict[str, Any])
async def expire_stale_reservations(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Expire stale reservations based on policy settings.
    Only admin users can manually trigger this operation.
    """
    # This would normally run as a scheduled task, but we're providing a manual trigger
    background_tasks.add_task(expire_stale_reservations_task, db)
    
    return {
        "message": "Stale reservation expiration process started",
        "status": "processing"
    }

async def expire_stale_reservations_task(db: AsyncSession):
    """Background task to expire stale reservations."""
    # Get active reservations
    query = select(
        Reservation, 
        TargetDevice,
        ReservationPolicy
    ).join(
        TargetDevice, Reservation.target_id == TargetDevice.id
    ).outerjoin(
        ReservationPolicy, Reservation.policy_id == ReservationPolicy.id
    ).filter(
        Reservation.status == ReservationStatus.ACTIVE
    )
    
    result = await db.execute(query)
    active_reservations = result.all()
    
    now = datetime.utcnow()
    expired_count = 0
    
    for reservation, target, policy in active_reservations:
        # Skip admin override reservations
        if reservation.is_admin_override:
            continue
        
        # Determine auto-expire settings
        auto_expire_enabled = True
        auto_expire_minutes = 15  # Default
        
        if policy:
            auto_expire_enabled = policy.auto_expire_enabled
            auto_expire_minutes = policy.auto_expire_minutes
        
        # Check if reservation has expired
        if auto_expire_enabled and reservation.last_accessed_at:
            expire_time = reservation.last_accessed_at + timedelta(minutes=auto_expire_minutes)
            if now > expire_time:
                # Expire the reservation
                reservation.status = ReservationStatus.EXPIRED
                target.status = DeviceStatus.AVAILABLE
                expired_count += 1
                
                # Notify about expiration
                await notification_manager.send_notification(
                    f"Reservation for {target.name} has expired due to inactivity",
                    NotificationType.WARNING,
                    user_id=reservation.user_id,
                    data={
                        "reservation_id": reservation.id,
                        "target_id": target.id
                    }
                )
    
    await db.commit()
    
    # Log the result
    logger.info(f"Expired {expired_count} stale reservations")

@router.get("/suggestions", response_model=List[Dict[str, Any]])
async def get_reservation_suggestions(
    target_type: Optional[str] = None,
    duration_minutes: int = Query(60, description="Desired reservation duration in minutes"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get smart suggestions for reservations based on past behavior and current availability.
    """
    # Get user's past reservations to analyze patterns
    past_reservations_query = select(
        Reservation, 
        TargetDevice.name.label("target_name"),
        TargetDevice.device_type.label("device_type"),
        TargetDevice.id.label("target_id")
    ).join(
        TargetDevice, Reservation.target_id == TargetDevice.id
    ).filter(
        Reservation.user_id == current_user.id,
        Reservation.status.in_([ReservationStatus.COMPLETED, ReservationStatus.ACTIVE])
    ).order_by(desc(Reservation.start_time)).limit(10)
    
    past_result = await db.execute(past_reservations_query)
    past_reservations = past_result.all()
    
    # Analyze patterns
    favorite_targets = {}
    common_durations = {}
    preferred_times = {}
    
    for res, target_name, device_type, target_id in past_reservations:
        # Track favorite targets
        if target_id not in favorite_targets:
            favorite_targets[target_id] = {
                "count": 0, 
                "name": target_name, 
                "type": device_type,
                "id": target_id
            }
        favorite_targets[target_id]["count"] += 1
        
        # Track common durations
        duration = int((res.end_time - res.start_time).total_seconds() / 60)
        if duration not in common_durations:
            common_durations[duration] = 0
        common_durations[duration] += 1
        
        # Track preferred times
        hour = res.start_time.hour
        if hour not in preferred_times:
            preferred_times[hour] = 0
        preferred_times[hour] += 1
    
    # Sort by frequency
    favorite_targets_list = sorted(
        favorite_targets.values(), 
        key=lambda x: x["count"], 
        reverse=True
    )
    
    # Find available targets similar to user's favorites
    now = datetime.utcnow()
    suggestions = []
    
    # First, check if user's favorite targets are available
    for favorite in favorite_targets_list[:3]:  # Top 3 favorites
        target_id = favorite["id"]
        
        # Check availability for next 24 hours in 1-hour increments
        for hour_offset in range(0, 24):
            start_time = now + timedelta(hours=hour_offset)
            end_time = start_time + timedelta(minutes=duration_minutes)
            
            # Check for conflicts
            conflicts_query = select(func.count()).select_from(Reservation).filter(
                Reservation.target_id == target_id,
                Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.ACTIVE]),
                or_(
                    and_(
                        Reservation.start_time <= start_time,
                        Reservation.end_time > start_time
                    ),
                    and_(
                        Reservation.start_time < end_time,
                        Reservation.end_time >= end_time
                    ),
                    and_(
                        Reservation.start_time >= start_time,
                        Reservation.end_time <= end_time
                    )
                )
            )
            
            conflicts_result = await db.execute(conflicts_query)
            conflicts_count = conflicts_result.scalar()
            
            if conflicts_count == 0:
                # Target is available at this time
                suggestions.append({
                    "target_id": target_id,
                    "target_name": favorite["name"],
                    "device_type": favorite["type"],
                    "start_time": start_time,
                    "end_time": end_time,
                    "reason": "One of your frequently used targets",
                    "score": 100 - (hour_offset * 4)  # Score decreases with time
                })
                break  # Found an available slot for this target
    
    # If we don't have enough suggestions, find other available targets
    if len(suggestions) < 3:
        # Query for available targets
        available_targets_query = select(TargetDevice).filter(
            TargetDevice.status == DeviceStatus.AVAILABLE
        )
        
        if target_type:
            available_targets_query = available_targets_query.filter(
                TargetDevice.device_type == target_type
            )
        
        available_targets_result = await db.execute(available_targets_query)
        available_targets = available_targets_result.scalars().all()
        
        for target in available_targets:
            # Skip targets already in suggestions
            if any(s["target_id"] == target.id for s in suggestions):
                continue
            
            # Check availability for next 24 hours in 1-hour increments
            for hour_offset in range(0, 24):
                start_time = now + timedelta(hours=hour_offset)
                end_time = start_time + timedelta(minutes=duration_minutes)
                
                # Check for conflicts
                conflicts_query = select(func.count()).select_from(Reservation).filter(
                    Reservation.target_id == target.id,
                    Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.ACTIVE]),
                    or_(
                        and_(
                            Reservation.start_time <= start_time,
                            Reservation.end_time > start_time
                        ),
                        and_(
                            Reservation.start_time < end_time,
                            Reservation.end_time >= end_time
                        ),
                        and_(
                            Reservation.start_time >= start_time,
                            Reservation.end_time <= end_time
                        )
                    )
                )
                
                conflicts_result = await db.execute(conflicts_query)
                conflicts_count = conflicts_result.scalar()
                
                if conflicts_count == 0:
                    # Target is available at this time
                    suggestions.append({
                        "target_id": target.id,
                        "target_name": target.name,
                        "device_type": target.device_type,
                        "start_time": start_time,
                        "end_time": end_time,
                        "reason": "Available target matching your criteria",
                        "score": 80 - (hour_offset * 4)  # Score decreases with time
                    })
                    break  # Found an available slot for this target
            
            # If we have enough suggestions, stop
            if len(suggestions) >= 5:
                break
    
    # Sort suggestions by score
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    
    return suggestions
