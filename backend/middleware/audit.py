"""
Audit logging middleware for the Android Lab Platform API.

This middleware logs all API requests and responses for audit trail purposes.
"""

import logging
import time
import json
from typing import Callable, Dict, Any, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ..notifications import notification_manager, EventType

# Set up logging
logger = logging.getLogger(__name__)

class AuditLogMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all API requests and responses for audit trail.
    
    This middleware:
    1. Logs the request method, path, client IP, and user ID (if authenticated)
    2. Measures the response time
    3. Logs the response status code
    4. Records the event in the audit log
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        # Start timer
        start_time = time.time()
        
        # Get request details
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        
        # Get user from request if authenticated
        user_id = None
        if hasattr(request.state, "user"):
            user_id = request.state.user.id
        
        # Log the request
        logger.info(f"API Request: {method} {path} from {client_ip} by user {user_id}")
        
        # Process the request
        try:
            response = await call_next(request)
            
            # Calculate response time
            process_time = time.time() - start_time
            
            # Log the response
            logger.info(
                f"API Response: {method} {path} - Status {response.status_code} - "
                f"Processed in {process_time:.4f}s"
            )
            
            # Record in audit log for non-GET requests (to avoid excessive logging)
            if method != "GET" and not path.startswith(("/docs", "/redoc", "/openapi.json")):
                # Extract path parameters
                path_params = {}
                for route in request.app.routes:
                    match, scope = route.matches({"type": "http", "path": path})
                    if match == match.FULL:
                        path_params = scope.get("path_params", {})
                        break
                
                # Log the event
                event_details = {
                    "method": method,
                    "path": path,
                    "client_ip": client_ip,
                    "status_code": response.status_code,
                    "response_time": process_time,
                    "path_params": path_params
                }
                
                # Determine event type based on path and method
                event_type = EventType.USER_UPDATED  # Default
                
                if "targets" in path:
                    if method == "POST" and path.endswith("/targets"):
                        event_type = EventType.TARGET_REGISTERED
                    elif method == "PUT":
                        event_type = EventType.TARGET_UPDATED
                    elif method == "DELETE":
                        event_type = EventType.TARGET_REMOVED
                    elif "reserve" in path:
                        event_type = EventType.RESERVATION_STARTED
                    elif "release" in path:
                        event_type = EventType.RESERVATION_ENDED
                    elif "deactivate" in path:
                        event_type = EventType.TARGET_REMOVED
                
                notification_manager.log_event(
                    event_type=event_type,
                    user_id=user_id,
                    details=event_details
                )
            
            return response
            
        except Exception as e:
            # Log the error
            logger.error(
                f"API Error: {method} {path} - Error: {str(e)}"
            )
            
            # Re-raise the exception
            raise
