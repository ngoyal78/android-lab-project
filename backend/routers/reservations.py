from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func
from typing import List, Any
from datetime import datetime

from ..database import get_db
from ..models import User, Reservation, TargetDevice, ReservationStatus, DeviceStatus
from ..schemas import ReservationCreate, ReservationResponse, ReservationUpdate, ReservationWithDetails
from ..auth import get_current_active_user, get_admin_user, get_developer_user

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
