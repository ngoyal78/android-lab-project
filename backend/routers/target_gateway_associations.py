from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, distinct, case
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import csv
import io

from ..database import get_db
from ..models.target_gateway_association import TargetGatewayAssociation, AssociationStatus
from ..models.target import TargetDevice
from ..models.gateway import Gateway
from ..schemas.target_gateway_association import (
    TargetGatewayAssociation as AssociationSchema,
    TargetGatewayAssociationCreate,
    TargetGatewayAssociationUpdate,
    TargetGatewayAssociationWithDetails,
    TargetGatewayAssociationBulkCreate,
    TargetGatewayAssociationBulkDelete,
    TargetGatewayAssociationFilter
)
from ..auth import get_current_user, get_current_active_user, get_admin_user
from ..models.user import User

router = APIRouter(
    prefix="/api/target-gateway-associations",
    tags=["target-gateway-associations"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[TargetGatewayAssociationWithDetails])
async def get_associations(
    skip: int = 0,
    limit: int = 100,
    target_id: Optional[int] = None,
    gateway_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all target-gateway associations with optional filtering.
    """
    query = db.query(TargetGatewayAssociation)
    
    if target_id:
        query = query.filter(TargetGatewayAssociation.target_id == target_id)
    if gateway_id:
        query = query.filter(TargetGatewayAssociation.gateway_id == gateway_id)
    if status:
        query = query.filter(TargetGatewayAssociation.status == status)
    
    associations = query.offset(skip).limit(limit).all()
    
    # Enhance with target and gateway details
    result = []
    for assoc in associations:
        target = db.query(TargetDevice).filter(TargetDevice.id == assoc.target_id).first()
        gateway = db.query(Gateway).filter(Gateway.gateway_id == assoc.gateway_id).first()
        
        assoc_dict = {
            "id": assoc.id,
            "target_id": assoc.target_id,
            "gateway_id": assoc.gateway_id,
            "status": assoc.status,
            "health_status": assoc.health_status,
            "connection_details": assoc.connection_details,
            "tunnel_id": assoc.tunnel_id,
            "tunnel_port": assoc.tunnel_port,
            "tunnel_status": assoc.tunnel_status,
            "created_at": assoc.created_at,
            "updated_at": assoc.updated_at,
            "created_by": assoc.created_by,
            "updated_by": assoc.updated_by,
            "target_name": target.name if target else None,
            "target_serial": target.serial_number if target else None,
            "target_model": target.model if target else None,
            "target_status": target.status if target else None,
            "gateway_name": gateway.name if gateway else None,
            "gateway_status": gateway.status if gateway else None,
            "gateway_location": gateway.location if gateway else None
        }
        result.append(assoc_dict)
    
    return result

@router.post("/", response_model=AssociationSchema, status_code=status.HTTP_201_CREATED)
async def create_association(
    association: TargetGatewayAssociationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new target-gateway association.
    """
    # Check if target exists
    target = db.query(TargetDevice).filter(TargetDevice.id == association.target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Check if gateway exists
    gateway = db.query(Gateway).filter(Gateway.gateway_id == association.gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")
    
    # Check if target is already associated with a gateway
    existing_association = db.query(TargetGatewayAssociation).filter(
        TargetGatewayAssociation.target_id == association.target_id
    ).first()
    
    if existing_association:
        raise HTTPException(
            status_code=400, 
            detail=f"Target is already associated with gateway {existing_association.gateway_id}"
        )
    
    # Create new association
    db_association = TargetGatewayAssociation(
        target_id=association.target_id,
        gateway_id=association.gateway_id,
        status=association.status,
        health_status=association.health_status,
        connection_details=association.connection_details,
        tunnel_id=association.tunnel_id,
        tunnel_port=association.tunnel_port,
        tunnel_status=association.tunnel_status,
        created_by=current_user.id
    )
    
    try:
        db.add(db_association)
        db.commit()
        db.refresh(db_association)
        
        # Update target's gateway_id field
        target.gateway_id = association.gateway_id
        target.association_timestamp = datetime.now()
        target.association_status = "connected"
        db.commit()
        
        return db_association
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create association due to constraint violation")

@router.put("/{association_id}", response_model=AssociationSchema)
async def update_association(
    association_id: int,
    association_update: TargetGatewayAssociationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update an existing target-gateway association.
    """
    db_association = db.query(TargetGatewayAssociation).filter(
        TargetGatewayAssociation.id == association_id
    ).first()
    
    if not db_association:
        raise HTTPException(status_code=404, detail="Association not found")
    
    # Update fields
    update_data = association_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_association, key, value)
    
    db_association.updated_by = current_user.id
    
    try:
        db.commit()
        db.refresh(db_association)
        
        # Update target's association status if needed
        if "status" in update_data:
            target = db.query(TargetDevice).filter(TargetDevice.id == db_association.target_id).first()
            if target:
                target.association_status = update_data["status"]
                db.commit()
        
        return db_association
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update association due to constraint violation")

@router.delete("/{association_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_association(
    association_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a target-gateway association.
    """
    db_association = db.query(TargetGatewayAssociation).filter(
        TargetGatewayAssociation.id == association_id
    ).first()
    
    if not db_association:
        raise HTTPException(status_code=404, detail="Association not found")
    
    # Get target for updating
    target = db.query(TargetDevice).filter(TargetDevice.id == db_association.target_id).first()
    
    try:
        db.delete(db_association)
        db.commit()
        
        # Update target's association status
        if target:
            target.association_status = "disconnected"
            db.commit()
        
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not delete association: {str(e)}")

@router.post("/bulk", response_model=List[AssociationSchema], status_code=status.HTTP_201_CREATED)
async def bulk_create_associations(
    bulk_create: TargetGatewayAssociationBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Create multiple target-gateway associations in bulk.
    Requires admin privileges.
    """
    # Check if gateway exists
    gateway = db.query(Gateway).filter(Gateway.gateway_id == bulk_create.gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")
    
    created_associations = []
    errors = []
    
    for target_id in bulk_create.target_ids:
        # Check if target exists
        target = db.query(TargetDevice).filter(TargetDevice.id == target_id).first()
        if not target:
            errors.append(f"Target ID {target_id} not found")
            continue
        
        # Check if target is already associated
        existing_association = db.query(TargetGatewayAssociation).filter(
            TargetGatewayAssociation.target_id == target_id
        ).first()
        
        if existing_association:
            errors.append(f"Target ID {target_id} is already associated with gateway {existing_association.gateway_id}")
            continue
        
        # Create new association
        db_association = TargetGatewayAssociation(
            target_id=target_id,
            gateway_id=bulk_create.gateway_id,
            status=AssociationStatus.PENDING,
            created_by=current_user.id
        )
        
        try:
            db.add(db_association)
            db.commit()
            db.refresh(db_association)
            
            # Update target's gateway_id field
            target.gateway_id = bulk_create.gateway_id
            target.association_timestamp = datetime.now()
            target.association_status = "connected"
            db.commit()
            
            created_associations.append(db_association)
        except IntegrityError:
            db.rollback()
            errors.append(f"Could not create association for target ID {target_id} due to constraint violation")
    
    if not created_associations and errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    return created_associations

@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_associations(
    bulk_delete: TargetGatewayAssociationBulkDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Delete multiple target-gateway associations in bulk.
    Requires admin privileges.
    """
    query = db.query(TargetGatewayAssociation).filter(
        TargetGatewayAssociation.target_id.in_(bulk_delete.target_ids)
    )
    
    if bulk_delete.gateway_id:
        query = query.filter(TargetGatewayAssociation.gateway_id == bulk_delete.gateway_id)
    
    associations = query.all()
    
    if not associations:
        raise HTTPException(status_code=404, detail="No matching associations found")
    
    # Get targets for updating
    target_ids = [assoc.target_id for assoc in associations]
    targets = db.query(TargetDevice).filter(TargetDevice.id.in_(target_ids)).all()
    target_map = {target.id: target for target in targets}
    
    try:
        for assoc in associations:
            db.delete(assoc)
            
            # Update target's association status
            if assoc.target_id in target_map:
                target_map[assoc.target_id].association_status = "disconnected"
        
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not delete associations: {str(e)}")

@router.get("/health-check", response_model=List[AssociationSchema])
async def check_association_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Check the health of all active associations and update their status.
    """
    # Get all active associations
    associations = db.query(TargetGatewayAssociation).filter(
        TargetGatewayAssociation.status.in_([
            AssociationStatus.CONNECTED,
            AssociationStatus.CONNECTING
        ])
    ).all()
    
    updated_associations = []
    
    for assoc in associations:
        # In a real implementation, this would perform actual health checks
        # For now, we'll simulate by randomly updating health status
        import random
        
        # Check if the last health check was more than 5 minutes ago
        if not assoc.last_health_check or (datetime.now() - assoc.last_health_check) > timedelta(minutes=5):
            # Simulate health check
            health_score = random.randint(0, 100)
            
            # Update status based on health score
            if health_score < 30:
                assoc.status = AssociationStatus.FAILED
            elif health_score < 60:
                assoc.status = AssociationStatus.DISCONNECTED
            else:
                assoc.status = AssociationStatus.CONNECTED
            
            assoc.health_status = health_score
            assoc.last_health_check = datetime.now()
            
            # Update target's association status
            target = db.query(TargetDevice).filter(TargetDevice.id == assoc.target_id).first()
            if target:
                target.association_status = assoc.status
                target.association_health = health_score
            
            updated_associations.append(assoc)
    
    if updated_associations:
        db.commit()
    
    return updated_associations

@router.get("/auto-cleanup", status_code=status.HTTP_200_OK)
async def auto_cleanup_inactive_associations(
    inactivity_hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Automatically clean up associations that have been inactive for a specified period.
    Requires admin privileges.
    """
    cutoff_time = datetime.now() - timedelta(hours=inactivity_hours)
    
    # Find associations with disconnected or failed status that haven't been updated recently
    associations = db.query(TargetGatewayAssociation).filter(
        TargetGatewayAssociation.status.in_([
            AssociationStatus.DISCONNECTED,
            AssociationStatus.FAILED
        ]),
        TargetGatewayAssociation.updated_at < cutoff_time
    ).all()
    
    if not associations:
        return {"message": "No inactive associations found to clean up"}
    
    # Get targets for updating
    target_ids = [assoc.target_id for assoc in associations]
    targets = db.query(TargetDevice).filter(TargetDevice.id.in_(target_ids)).all()
    target_map = {target.id: target for target in targets}
    
    deleted_count = 0
    
    try:
        for assoc in associations:
            db.delete(assoc)
            
            # Update target's association status
            if assoc.target_id in target_map:
                target_map[assoc.target_id].association_status = "disconnected"
            
            deleted_count += 1
        
        db.commit()
        return {"message": f"Successfully cleaned up {deleted_count} inactive associations"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not clean up associations: {str(e)}")

@router.get("/stats")
async def get_association_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get statistics about target-gateway associations.
    """
    # Count total associations
    total_associations = db.query(func.count(TargetGatewayAssociation.id)).scalar()
    
    # Count active associations
    active_associations = db.query(func.count(TargetGatewayAssociation.id)).filter(
        TargetGatewayAssociation.status == AssociationStatus.CONNECTED
    ).scalar()
    
    # Count failed associations
    failed_associations = db.query(func.count(TargetGatewayAssociation.id)).filter(
        TargetGatewayAssociation.status == AssociationStatus.FAILED
    ).scalar()
    
    # Calculate average health
    avg_health = db.query(func.avg(TargetGatewayAssociation.health_status)).scalar() or 0
    avg_health = round(float(avg_health), 1)
    
    # Count total targets and gateways
    total_targets = db.query(func.count(distinct(TargetDevice.id))).scalar()
    total_gateways = db.query(func.count(distinct(Gateway.gateway_id))).scalar()
    
    # Get target status distribution
    target_status_query = db.query(
        TargetDevice.status,
        func.count(TargetDevice.id)
    ).group_by(TargetDevice.status).all()
    
    targets_by_status = {status: count for status, count in target_status_query}
    
    # Get gateway status distribution
    gateway_status_query = db.query(
        Gateway.status,
        func.count(Gateway.gateway_id)
    ).group_by(Gateway.status).all()
    
    gateways_by_status = {status: count for status, count in gateway_status_query}
    
    return {
        "total_targets": total_targets,
        "total_gateways": total_gateways,
        "total_associations": total_associations,
        "active_associations": active_associations,
        "failed_associations": failed_associations,
        "average_health": avg_health,
        "targets_by_status": targets_by_status,
        "gateways_by_status": gateways_by_status
    }

@router.get("/export")
async def export_associations_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Export all target-gateway associations as a CSV file.
    """
    # Get all associations with details
    associations = db.query(TargetGatewayAssociation).all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Association ID",
        "Target ID",
        "Target Name",
        "Target Serial",
        "Target Model",
        "Target Status",
        "Gateway ID",
        "Gateway Name",
        "Gateway Status",
        "Gateway Location",
        "Association Status",
        "Health Status",
        "Tunnel ID",
        "Tunnel Port",
        "Tunnel Status",
        "Created At",
        "Updated At"
    ])
    
    # Write data rows
    for assoc in associations:
        target = db.query(TargetDevice).filter(TargetDevice.id == assoc.target_id).first()
        gateway = db.query(Gateway).filter(Gateway.gateway_id == assoc.gateway_id).first()
        
        writer.writerow([
            assoc.id,
            assoc.target_id,
            target.name if target else "N/A",
            target.serial_number if target else "N/A",
            target.model if target else "N/A",
            target.status if target else "N/A",
            assoc.gateway_id,
            gateway.name if gateway else "N/A",
            gateway.status if gateway else "N/A",
            gateway.location if gateway else "N/A",
            assoc.status,
            assoc.health_status or "N/A",
            assoc.tunnel_id or "N/A",
            assoc.tunnel_port or "N/A",
            assoc.tunnel_status or "N/A",
            assoc.created_at.isoformat() if assoc.created_at else "N/A",
            assoc.updated_at.isoformat() if assoc.updated_at else "N/A"
        ])
    
    # Prepare response
    output.seek(0)
    content = output.getvalue()
    
    response = Response(content=content)
    response.headers["Content-Disposition"] = f"attachment; filename=target-gateway-associations-{datetime.now().strftime('%Y-%m-%d')}.csv"
    response.headers["Content-Type"] = "text/csv"
    
    return response
