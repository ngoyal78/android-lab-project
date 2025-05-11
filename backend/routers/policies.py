from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Any
from datetime import datetime

from ..database import get_db
from ..models import User, ReservationPolicy, TargetDevice
from ..schemas import (
    ReservationPolicyCreate, ReservationPolicyUpdate, ReservationPolicyResponse,
    TargetPolicyAssignment, UserPolicyAssignment
)
from ..auth import get_current_active_user, get_admin_user

router = APIRouter(
    prefix="/policies",
    tags=["policies"],
    responses={401: {"description": "Unauthorized"}},
)

@router.get("/", response_model=List[ReservationPolicyResponse])
async def read_policies(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Retrieve all reservation policies.
    """
    query = select(ReservationPolicy).offset(skip).limit(limit)
    result = await db.execute(query)
    policies = result.scalars().all()
    return policies

@router.get("/{policy_id}", response_model=ReservationPolicyResponse)
async def read_policy(
    policy_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get a specific reservation policy by id.
    """
    query = select(ReservationPolicy).filter(ReservationPolicy.id == policy_id)
    result = await db.execute(query)
    policy = result.scalars().first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation policy not found"
        )
    
    return policy

@router.post("/", response_model=ReservationPolicyResponse)
async def create_policy(
    policy_data: ReservationPolicyCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Create a new reservation policy.
    Only admin users can create policies.
    """
    # Check if policy with same name already exists
    query = select(ReservationPolicy).filter(ReservationPolicy.name == policy_data.name)
    result = await db.execute(query)
    existing_policy = result.scalars().first()
    
    if existing_policy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Policy with name '{policy_data.name}' already exists"
        )
    
    # Create new policy
    new_policy = ReservationPolicy(**policy_data.dict())
    db.add(new_policy)
    await db.commit()
    await db.refresh(new_policy)
    
    return new_policy

@router.put("/{policy_id}", response_model=ReservationPolicyResponse)
async def update_policy(
    policy_id: int,
    policy_data: ReservationPolicyUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Update a reservation policy.
    Only admin users can update policies.
    """
    query = select(ReservationPolicy).filter(ReservationPolicy.id == policy_id)
    result = await db.execute(query)
    policy = result.scalars().first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation policy not found"
        )
    
    # Check if updating name and if it conflicts with existing policy
    if policy_data.name and policy_data.name != policy.name:
        name_query = select(ReservationPolicy).filter(
            ReservationPolicy.name == policy_data.name,
            ReservationPolicy.id != policy_id
        )
        name_result = await db.execute(name_query)
        existing_policy = name_result.scalars().first()
        
        if existing_policy:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Policy with name '{policy_data.name}' already exists"
            )
    
    # Update policy fields
    update_data = policy_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)
    
    await db.commit()
    await db.refresh(policy)
    
    return policy

@router.delete("/{policy_id}", response_model=ReservationPolicyResponse)
async def delete_policy(
    policy_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete a reservation policy.
    Only admin users can delete policies.
    """
    query = select(ReservationPolicy).filter(ReservationPolicy.id == policy_id)
    result = await db.execute(query)
    policy = result.scalars().first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation policy not found"
        )
    
    await db.delete(policy)
    await db.commit()
    
    return policy

@router.post("/assign-to-targets", response_model=dict)
async def assign_policy_to_targets(
    assignment: TargetPolicyAssignment,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Assign a policy to multiple targets.
    Only admin users can assign policies.
    """
    # Check if policy exists
    policy_query = select(ReservationPolicy).filter(ReservationPolicy.id == assignment.policy_id)
    policy_result = await db.execute(policy_query)
    policy = policy_result.scalars().first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation policy not found"
        )
    
    # Get all targets
    targets_query = select(TargetDevice).filter(TargetDevice.id.in_(assignment.target_ids))
    targets_result = await db.execute(targets_query)
    targets = targets_result.scalars().all()
    
    found_target_ids = [target.id for target in targets]
    missing_target_ids = [tid for tid in assignment.target_ids if tid not in found_target_ids]
    
    if missing_target_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target devices with ids {missing_target_ids} not found"
        )
    
    # Assign policy to targets
    for target in targets:
        if policy not in target.policies:
            target.policies.append(policy)
    
    await db.commit()
    
    return {
        "message": f"Policy '{policy.name}' assigned to {len(targets)} targets",
        "policy_id": policy.id,
        "target_ids": found_target_ids
    }

@router.post("/assign-to-users", response_model=dict)
async def assign_policy_to_users(
    assignment: UserPolicyAssignment,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Assign a policy to multiple users.
    Only admin users can assign policies.
    """
    # Check if policy exists
    policy_query = select(ReservationPolicy).filter(ReservationPolicy.id == assignment.policy_id)
    policy_result = await db.execute(policy_query)
    policy = policy_result.scalars().first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation policy not found"
        )
    
    # Get all users
    users_query = select(User).filter(User.id.in_(assignment.user_ids))
    users_result = await db.execute(users_query)
    users = users_result.scalars().all()
    
    found_user_ids = [user.id for user in users]
    missing_user_ids = [uid for uid in assignment.user_ids if uid not in found_user_ids]
    
    if missing_user_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Users with ids {missing_user_ids} not found"
        )
    
    # Assign policy to users
    for user in users:
        if policy not in user.policies:
            user.policies.append(policy)
    
    await db.commit()
    
    return {
        "message": f"Policy '{policy.name}' assigned to {len(users)} users",
        "policy_id": policy.id,
        "user_ids": found_user_ids
    }

@router.delete("/remove-from-targets", response_model=dict)
async def remove_policy_from_targets(
    assignment: TargetPolicyAssignment,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Remove a policy from multiple targets.
    Only admin users can remove policies.
    """
    # Check if policy exists
    policy_query = select(ReservationPolicy).filter(ReservationPolicy.id == assignment.policy_id)
    policy_result = await db.execute(policy_query)
    policy = policy_result.scalars().first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation policy not found"
        )
    
    # Get all targets
    targets_query = select(TargetDevice).filter(TargetDevice.id.in_(assignment.target_ids))
    targets_result = await db.execute(targets_query)
    targets = targets_result.scalars().all()
    
    found_target_ids = [target.id for target in targets]
    
    # Remove policy from targets
    for target in targets:
        if policy in target.policies:
            target.policies.remove(policy)
    
    await db.commit()
    
    return {
        "message": f"Policy '{policy.name}' removed from {len(targets)} targets",
        "policy_id": policy.id,
        "target_ids": found_target_ids
    }

@router.delete("/remove-from-users", response_model=dict)
async def remove_policy_from_users(
    assignment: UserPolicyAssignment,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Remove a policy from multiple users.
    Only admin users can remove policies.
    """
    # Check if policy exists
    policy_query = select(ReservationPolicy).filter(ReservationPolicy.id == assignment.policy_id)
    policy_result = await db.execute(policy_query)
    policy = policy_result.scalars().first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation policy not found"
        )
    
    # Get all users
    users_query = select(User).filter(User.id.in_(assignment.user_ids))
    users_result = await db.execute(users_query)
    users = users_result.scalars().all()
    
    found_user_ids = [user.id for user in users]
    
    # Remove policy from users
    for user in users:
        if policy in user.policies:
            user.policies.remove(policy)
    
    await db.commit()
    
    return {
        "message": f"Policy '{policy.name}' removed from {len(users)} users",
        "policy_id": policy.id,
        "user_ids": found_user_ids
    }
