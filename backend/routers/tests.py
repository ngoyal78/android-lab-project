from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
import asyncio
import json
import os
import uuid
import subprocess
from datetime import datetime

from ..database import get_db
from ..models import User, TargetDevice, Artifact, TestJob, TestStatus, DeviceStatus
from ..schemas import TestJobCreate, TestJobResponse, TestJobWithDetails
from ..auth import get_current_active_user, get_developer_user

router = APIRouter(
    prefix="/tests",
    tags=["tests"],
    responses={401: {"description": "Unauthorized"}},
)

# Store active test jobs
class TestJobManager:
    def __init__(self):
        # job_id -> {process, websocket, status}
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
    
    def add_job(self, job_id: str, process: asyncio.subprocess.Process, websocket: Optional[WebSocket] = None):
        """Add a new test job"""
        self.active_jobs[job_id] = {
            "process": process,
            "websocket": websocket,
            "status": TestStatus.RUNNING
        }
    
    def get_job(self, job_id: str) -> Dict[str, Any]:
        """Get a test job by ID"""
        return self.active_jobs.get(job_id)
    
    def set_websocket(self, job_id: str, websocket: WebSocket):
        """Set the WebSocket for a test job"""
        if job_id in self.active_jobs:
            self.active_jobs[job_id]["websocket"] = websocket
    
    def set_status(self, job_id: str, status: TestStatus):
        """Set the status for a test job"""
        if job_id in self.active_jobs:
            self.active_jobs[job_id]["status"] = status
    
    def remove_job(self, job_id: str):
        """Remove a test job"""
        if job_id in self.active_jobs:
            # Kill process if it's still running
            process = self.active_jobs[job_id]["process"]
            try:
                process.kill()
            except:
                pass
            
            # Remove job
            del self.active_jobs[job_id]

job_manager = TestJobManager()

@router.get("/", response_model=List[TestJobWithDetails])
async def read_test_jobs(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Retrieve test jobs with optional filtering.
    Admin users can see all test jobs, other users can only see their own.
    """
    query = select(
        TestJob,
        TargetDevice.name.label("target_name"),
        Artifact.original_filename.label("artifact_filename"),
        User.username.label("user_username")
    ).join(
        TargetDevice, TestJob.target_id == TargetDevice.id
    ).join(
        User, TestJob.user_id == User.id
    ).outerjoin(
        Artifact, TestJob.artifact_id == Artifact.id
    )
    
    # Apply filters
    if status:
        query = query.filter(TestJob.status == status)
    
    # Non-admin users can only see their own test jobs
    if current_user.role != "admin":
        query = query.filter(TestJob.user_id == current_user.id)
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    jobs_data = result.all()
    
    # Construct response with joined data
    jobs = []
    for job, target_name, artifact_filename, username in jobs_data:
        job_dict = {
            **TestJobResponse.from_orm(job).dict(),
            "target_name": target_name,
            "artifact_filename": artifact_filename,
            "user_username": username
        }
        jobs.append(job_dict)
    
    return jobs

@router.get("/{job_id}", response_model=TestJobWithDetails)
async def read_test_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get a specific test job by id.
    Admin users can see any test job, other users can only see their own.
    """
    query = select(
        TestJob,
        TargetDevice.name.label("target_name"),
        Artifact.original_filename.label("artifact_filename"),
        User.username.label("user_username")
    ).join(
        TargetDevice, TestJob.target_id == TargetDevice.id
    ).join(
        User, TestJob.user_id == User.id
    ).outerjoin(
        Artifact, TestJob.artifact_id == Artifact.id
    ).filter(
        TestJob.id == job_id
    )
    
    # Non-admin users can only see their own test jobs
    if current_user.role != "admin":
        query = query.filter(TestJob.user_id == current_user.id)
    
    result = await db.execute(query)
    job_data = result.first()
    
    if not job_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test job not found or you don't have permission to view it"
        )
    
    job, target_name, artifact_filename, username = job_data
    
    # Construct response with joined data
    job_dict = {
        **TestJobResponse.from_orm(job).dict(),
        "target_name": target_name,
        "artifact_filename": artifact_filename,
        "user_username": username
    }
    
    return job_dict

@router.post("/", response_model=TestJobResponse)
async def create_test_job(
    job_data: TestJobCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_developer_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Create a new test job.
    """
    # Check if target exists
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == job_data.target_id))
    target = result.scalars().first()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Check if target is available
    if target.status != DeviceStatus.AVAILABLE and target.status != DeviceStatus.RESERVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target device is not available (status: {target.status})"
        )
    
    # Check if artifact exists (if provided)
    artifact = None
    if job_data.artifact_id:
        result = await db.execute(select(Artifact).filter(Artifact.id == job_data.artifact_id))
        artifact = result.scalars().first()
        
        if not artifact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Artifact not found"
            )
    
    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    
    # Create new test job
    new_job = TestJob(
        id=job_id,
        user_id=current_user.id,
        target_id=job_data.target_id,
        artifact_id=job_data.artifact_id,
        command=job_data.command,
        test_type=job_data.test_type,
        status=TestStatus.PENDING,
        result_data={}
    )
    
    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)
    
    # Start test job in background
    background_tasks.add_task(run_test_job, new_job.id, db)
    
    return new_job

@router.delete("/{job_id}", response_model=TestJobResponse)
async def cancel_test_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Cancel a test job.
    Admin users can cancel any test job, other users can only cancel their own.
    """
    # Get the test job
    query = select(TestJob).filter(TestJob.id == job_id)
    
    # Non-admin users can only cancel their own test jobs
    if current_user.role != "admin":
        query = query.filter(TestJob.user_id == current_user.id)
    
    result = await db.execute(query)
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test job not found or you don't have permission to cancel it"
        )
    
    # Check if job is running
    if job.status == TestStatus.RUNNING:
        # Stop the job
        active_job = job_manager.get_job(job_id)
        if active_job:
            try:
                active_job["process"].kill()
            except:
                pass
    
    # Update job status
    job.status = TestStatus.CANCELLED
    job.end_time = datetime.utcnow()
    
    await db.commit()
    await db.refresh(job)
    
    # Remove job from manager
    job_manager.remove_job(job_id)
    
    return job

@router.websocket("/logs/{job_id}")
async def test_logs(
    websocket: WebSocket,
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """WebSocket endpoint for test job logs"""
    # In a real implementation, we would authenticate the WebSocket connection
    # For now, we'll assume the user is authenticated
    
    await websocket.accept()
    
    try:
        # Check if job exists
        result = await db.execute(select(TestJob).filter(TestJob.id == job_id))
        job = result.scalars().first()
        
        if not job:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Test job not found"
            }))
            await websocket.close()
            return
        
        # Check if job is running
        active_job = job_manager.get_job(job_id)
        if active_job:
            # Set WebSocket for the job
            job_manager.set_websocket(job_id, websocket)
            
            # Send welcome message
            await websocket.send_text(json.dumps({
                "type": "system",
                "message": f"Connected to test job {job_id}"
            }))
            
            # Keep connection open until job completes or client disconnects
            try:
                while True:
                    # Check if job is still running
                    if job_id not in job_manager.active_jobs:
                        await websocket.send_text(json.dumps({
                            "type": "system",
                            "message": "Test job completed"
                        }))
                        break
                    
                    # Wait for a short time
                    await asyncio.sleep(1)
            except WebSocketDisconnect:
                # Client disconnected, but keep the job running
                if job_id in job_manager.active_jobs:
                    job_manager.active_jobs[job_id]["websocket"] = None
        else:
            # Job is not running, send error message
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Test job is not running"
            }))
            
            # If job has completed, send the logs from the database
            if job.status in [TestStatus.COMPLETED, TestStatus.FAILED, TestStatus.ERROR]:
                # Get logs from result_data
                logs = job.result_data.get("logs", [])
                
                # Send logs
                for log in logs:
                    await websocket.send_text(json.dumps({
                        "type": "output",
                        "message": log
                    }))
                
                # Send final status
                await websocket.send_text(json.dumps({
                    "type": "system",
                    "message": f"Test job {job.status}"
                }))
    
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error: {str(e)}"
            }))
        except:
            pass
    
    finally:
        # Close WebSocket
        try:
            await websocket.close()
        except:
            pass

async def run_test_job(job_id: str, db: AsyncSession):
    """Run a test job in the background"""
    # Get the test job
    async with db.begin():
        result = await db.execute(select(
            TestJob,
            TargetDevice,
            Artifact
        ).join(
            TargetDevice, TestJob.target_id == TargetDevice.id
        ).outerjoin(
            Artifact, TestJob.artifact_id == Artifact.id
        ).filter(
            TestJob.id == job_id
        ))
        
        job_data = result.first()
        
        if not job_data:
            print(f"Test job {job_id} not found")
            return
        
        job, target, artifact = job_data
        
        # Update job status
        job.status = TestStatus.RUNNING
        job.start_time = datetime.utcnow()
        
        # Initialize result data
        job.result_data = {
            "logs": [],
            "exit_code": None
        }
        
        await db.commit()
        await db.refresh(job)
    
    try:
        # Prepare command
        command = job.command
        
        # If artifact is provided, add it to the command
        if artifact:
            # Replace {artifact} placeholder with actual path
            command = command.replace("{artifact}", artifact.file_path)
        
        # Replace {target} placeholder with actual target serial
        command = command.replace("{target}", target.serial_number)
        
        # In a real implementation, we would send this command to the gateway agent
        # For now, we'll just run it locally
        
        # Start process
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Add job to manager
        job_manager.add_job(job_id, process)
        
        # Handle process output
        logs = []
        
        async def read_output():
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                
                log_line = line.decode()
                logs.append(log_line)
                
                # Send log to WebSocket if connected
                active_job = job_manager.get_job(job_id)
                if active_job and active_job["websocket"]:
                    try:
                        await active_job["websocket"].send_text(json.dumps({
                            "type": "output",
                            "message": log_line
                        }))
                    except:
                        pass
        
        async def read_errors():
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                
                log_line = f"ERROR: {line.decode()}"
                logs.append(log_line)
                
                # Send log to WebSocket if connected
                active_job = job_manager.get_job(job_id)
                if active_job and active_job["websocket"]:
                    try:
                        await active_job["websocket"].send_text(json.dumps({
                            "type": "error",
                            "message": log_line
                        }))
                    except:
                        pass
        
        # Start reading output and errors
        output_task = asyncio.create_task(read_output())
        error_task = asyncio.create_task(read_errors())
        
        # Wait for process to complete
        exit_code = await process.wait()
        
        # Wait for output and error tasks to complete
        await output_task
        await error_task
        
        # Determine job status based on exit code
        job_status = TestStatus.COMPLETED
        if exit_code != 0:
            job_status = TestStatus.FAILED
        
        # Update job in database
        async with db.begin():
            result = await db.execute(select(TestJob).filter(TestJob.id == job_id))
            job = result.scalars().first()
            
            if job:
                job.status = job_status
                job.end_time = datetime.utcnow()
                job.result_data = {
                    "logs": logs,
                    "exit_code": exit_code
                }
                
                await db.commit()
        
        # Send completion message to WebSocket if connected
        active_job = job_manager.get_job(job_id)
        if active_job and active_job["websocket"]:
            try:
                await active_job["websocket"].send_text(json.dumps({
                    "type": "system",
                    "message": f"Test job completed with status: {job_status}"
                }))
            except:
                pass
        
        # Remove job from manager
        job_manager.remove_job(job_id)
    
    except Exception as e:
        # Handle exceptions
        error_message = f"Error running test job: {str(e)}"
        print(error_message)
        
        # Update job in database
        async with db.begin():
            result = await db.execute(select(TestJob).filter(TestJob.id == job_id))
            job = result.scalars().first()
            
            if job:
                job.status = TestStatus.ERROR
                job.end_time = datetime.utcnow()
                job.result_data = {
                    "logs": logs if 'logs' in locals() else [],
                    "error": str(e)
                }
                
                await db.commit()
        
        # Send error message to WebSocket if connected
        active_job = job_manager.get_job(job_id)
        if active_job and active_job["websocket"]:
            try:
                await active_job["websocket"].send_text(json.dumps({
                    "type": "error",
                    "message": error_message
                }))
            except:
                pass
        
        # Remove job from manager
        job_manager.remove_job(job_id)
