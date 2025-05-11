"""
Notification system for the Android Lab Platform.

This module provides functionality for sending real-time notifications to users
and maintaining an audit log of system events.
"""

import json
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Any, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)

class NotificationType(str, Enum):
    """Types of notifications that can be sent to users."""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"

class EventType(str, Enum):
    """Types of events that can be logged in the audit log."""
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    
    TARGET_REGISTERED = "target_registered"
    TARGET_UPDATED = "target_updated"
    TARGET_REMOVED = "target_removed"
    TARGET_CONNECTED = "target_connected"
    TARGET_DISCONNECTED = "target_disconnected"
    TARGET_EXPORTED = "target_exported"
    TARGET_IMPORTED = "target_imported"
    TARGET_TAGGED = "target_tagged"
    TARGET_REFRESH_REQUESTED = "target_refresh_requested"
    TARGET_HEALTH_CHANGED = "target_health_changed"
    
    RESERVATION_CREATED = "reservation_created"
    RESERVATION_UPDATED = "reservation_updated"
    RESERVATION_DELETED = "reservation_deleted"
    RESERVATION_STARTED = "reservation_started"
    RESERVATION_ENDED = "reservation_ended"
    
    ARTIFACT_UPLOADED = "artifact_uploaded"
    ARTIFACT_DELETED = "artifact_deleted"
    
    TEST_STARTED = "test_started"
    TEST_COMPLETED = "test_completed"
    TEST_FAILED = "test_failed"
    
    ADB_SHELL_STARTED = "adb_shell_started"
    ADB_SHELL_ENDED = "adb_shell_ended"
    
    SERIAL_CONSOLE_STARTED = "serial_console_started"
    SERIAL_CONSOLE_ENDED = "serial_console_ended"
    
    GATEWAY_CONNECTED = "gateway_connected"
    GATEWAY_DISCONNECTED = "gateway_disconnected"

class NotificationManager:
    """
    Manages notifications and audit logging for the Android Lab Platform.
    
    This class provides methods for:
    - Sending real-time notifications to users
    - Logging events to the audit log
    - Managing WebSocket connections for real-time updates
    """
    
    def __init__(self):
        # user_id -> Set[WebSocket]
        self.connections: Dict[int, Set[WebSocket]] = {}
        # List of recent notifications for new connections
        self.recent_notifications: List[Dict[str, Any]] = []
        # Maximum number of recent notifications to keep
        self.max_recent = 100
        # Audit log entries
        self.audit_log: List[Dict[str, Any]] = []
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """
        Register a new WebSocket connection for a user.
        
        Args:
            websocket: The WebSocket connection
            user_id: The ID of the user
        """
        await websocket.accept()
        
        if user_id not in self.connections:
            self.connections[user_id] = set()
        
        self.connections[user_id].add(websocket)
        
        # Send recent notifications to the new connection
        for notification in self.recent_notifications:
            # Only send if the notification is for all users or this specific user
            if notification.get("user_id") is None or notification.get("user_id") == user_id:
                await websocket.send_text(json.dumps(notification))
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        """
        Remove a WebSocket connection for a user.
        
        Args:
            websocket: The WebSocket connection
            user_id: The ID of the user
        """
        if user_id in self.connections:
            self.connections[user_id].discard(websocket)
            
            if not self.connections[user_id]:
                del self.connections[user_id]
    
    async def send_notification(
        self,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
        user_id: Optional[int] = None,
        data: Optional[Dict[str, Any]] = None
    ):
        """
        Send a notification to one or all users.
        
        Args:
            message: The notification message
            notification_type: The type of notification
            user_id: The ID of the user to send to, or None for all users
            data: Additional data to include with the notification
        """
        notification = {
            "type": "notification",
            "notification_type": notification_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
        if data:
            notification["data"] = data
        
        # Add to recent notifications
        self.recent_notifications.append(notification)
        if len(self.recent_notifications) > self.max_recent:
            self.recent_notifications.pop(0)
        
        # Send to connected users
        if user_id is None:
            # Send to all users
            for user_connections in self.connections.values():
                for websocket in user_connections:
                    try:
                        await websocket.send_text(json.dumps(notification))
                    except Exception as e:
                        logger.error(f"Error sending notification: {str(e)}")
        elif user_id in self.connections:
            # Send to specific user
            for websocket in self.connections[user_id]:
                try:
                    await websocket.send_text(json.dumps(notification))
                except Exception as e:
                    logger.error(f"Error sending notification: {str(e)}")
    
    def log_event(
        self,
        event_type: EventType,
        user_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        target_id: Optional[int] = None,
        reservation_id: Optional[int] = None,
        artifact_id: Optional[int] = None,
        test_id: Optional[int] = None,
        gateway_id: Optional[str] = None
    ):
        """
        Log an event to the audit log.
        
        Args:
            event_type: The type of event
            user_id: The ID of the user who performed the action
            details: Additional details about the event
            target_id: The ID of the target device involved
            reservation_id: The ID of the reservation involved
            artifact_id: The ID of the artifact involved
            test_id: The ID of the test involved
            gateway_id: The ID of the gateway involved
        """
        event = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id
        }
        
        if details:
            event["details"] = details
        
        if target_id is not None:
            event["target_id"] = target_id
        
        if reservation_id is not None:
            event["reservation_id"] = reservation_id
        
        if artifact_id is not None:
            event["artifact_id"] = artifact_id
        
        if test_id is not None:
            event["test_id"] = test_id
        
        if gateway_id is not None:
            event["gateway_id"] = gateway_id
        
        # Add to audit log
        self.audit_log.append(event)
        
        # In a real implementation, we would also persist this to a database
        logger.info(f"Audit log: {event}")
    
    async def notify_target_status_change(self, target_id: int, target_name: str, status: str, gateway_id: Optional[str] = None):
        """
        Send a notification when a target's status changes.
        
        Args:
            target_id: The ID of the target
            target_name: The name of the target
            status: The new status
            gateway_id: The ID of the gateway reporting the status change
        """
        message = f"Target {target_name} is now {status}"
        notification_type = NotificationType.INFO
        
        if status == "online":
            notification_type = NotificationType.SUCCESS
        elif status == "offline":
            notification_type = NotificationType.WARNING
        
        data = {
            "target_id": target_id,
            "status": status
        }
        
        if gateway_id:
            data["gateway_id"] = gateway_id
            self.log_event(
                EventType.TARGET_UPDATED if status == "online" else EventType.TARGET_DISCONNECTED,
                details={"status": status},
                target_id=target_id,
                gateway_id=gateway_id
            )
        else:
            self.log_event(
                EventType.TARGET_UPDATED if status == "online" else EventType.TARGET_DISCONNECTED,
                details={"status": status},
                target_id=target_id
            )
        
        await self.send_notification(message, notification_type, data=data)
    
    async def notify_reservation_change(self, reservation_id: int, user_id: int, target_id: int, target_name: str, action: str):
        """
        Send a notification when a reservation is created, started, or ended.
        
        Args:
            reservation_id: The ID of the reservation
            user_id: The ID of the user who made the reservation
            target_id: The ID of the target
            target_name: The name of the target
            action: The action (created, started, ended)
        """
        message = f"Reservation for {target_name} {action}"
        notification_type = NotificationType.INFO
        
        if action == "started":
            notification_type = NotificationType.SUCCESS
            event_type = EventType.RESERVATION_STARTED
        elif action == "ended":
            notification_type = NotificationType.INFO
            event_type = EventType.RESERVATION_ENDED
        else:  # created
            notification_type = NotificationType.INFO
            event_type = EventType.RESERVATION_CREATED
        
        data = {
            "reservation_id": reservation_id,
            "target_id": target_id,
            "action": action
        }
        
        self.log_event(
            event_type,
            user_id=user_id,
            target_id=target_id,
            reservation_id=reservation_id
        )
        
        # Notify the user who made the reservation
        await self.send_notification(message, notification_type, user_id=user_id, data=data)
        
        # Also notify all users about the reservation change
        await self.send_notification(
            f"User {user_id} {action} a reservation for {target_name}",
            notification_type,
            data=data
        )
    
    async def notify_test_status(self, test_id: int, user_id: int, target_id: int, target_name: str, status: str, details: Optional[Dict[str, Any]] = None):
        """
        Send a notification when a test status changes.
        
        Args:
            test_id: The ID of the test
            user_id: The ID of the user who started the test
            target_id: The ID of the target
            target_name: The name of the target
            status: The status (started, completed, failed)
            details: Additional details about the test
        """
        message = f"Test {test_id} on {target_name} {status}"
        notification_type = NotificationType.INFO
        
        if status == "completed":
            notification_type = NotificationType.SUCCESS
            event_type = EventType.TEST_COMPLETED
        elif status == "failed":
            notification_type = NotificationType.ERROR
            event_type = EventType.TEST_FAILED
        else:  # started
            notification_type = NotificationType.INFO
            event_type = EventType.TEST_STARTED
        
        data = {
            "test_id": test_id,
            "target_id": target_id,
            "status": status
        }
        
        if details:
            data["details"] = details
        
        self.log_event(
            event_type,
            user_id=user_id,
            target_id=target_id,
            test_id=test_id,
            details=details
        )
        
        # Notify the user who started the test
        await self.send_notification(message, notification_type, user_id=user_id, data=data)
    
    async def notify_gateway_status(self, gateway_id: str, status: str):
        """
        Send a notification when a gateway's status changes.
        
        Args:
            gateway_id: The ID of the gateway
            status: The status (connected, disconnected)
        """
        message = f"Gateway {gateway_id} {status}"
        notification_type = NotificationType.INFO
        
        if status == "connected":
            notification_type = NotificationType.SUCCESS
            event_type = EventType.GATEWAY_CONNECTED
        else:  # disconnected
            notification_type = NotificationType.WARNING
            event_type = EventType.GATEWAY_DISCONNECTED
        
        data = {
            "gateway_id": gateway_id,
            "status": status
        }
        
        self.log_event(
            event_type,
            gateway_id=gateway_id
        )
        
        # Notify all users
        await self.send_notification(message, notification_type, data=data)

# Create a global instance of the notification manager
notification_manager = NotificationManager()
