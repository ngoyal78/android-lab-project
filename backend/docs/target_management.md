# Android Target Management Service

This document describes the Android Target Management Service, which is responsible for registering, updating, and tracking the status of physical and virtual Android devices in the Android Lab Platform.

## Overview

The Target Management Service provides a RESTful API for managing Android target devices. It allows users to:

- Register new target devices
- Update device information
- List and filter devices
- Get detailed information about a specific device
- Reserve and release devices for testing
- Deactivate devices (soft delete)

The service stores device metadata in a PostgreSQL database and provides JWT-based authentication for API access. All API calls are logged for audit trail purposes.

## Data Model

The Target Management Service stores the following information about each device:

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique identifier for the device |
| name | String | Name of the device |
| gateway_id | String | ID of the gateway that manages this device |
| device_type | Enum | Type of device: physical or virtual |
| ip_address | String | IP address of the device |
| serial_number | String | Serial number of the device |
| android_version | String | Android OS version |
| api_level | Integer | Android API level |
| manufacturer | String | Device manufacturer |
| model | String | Device model |
| adb_endpoint | String | ADB endpoint for the device |
| ssh_endpoint | String | SSH endpoint for the device |
| hal_support | JSON | HAL support information |
| status | Enum | Current status: available, reserved, offline, maintenance |
| adb_status | Boolean | Whether ADB is available for this device |
| serial_status | Boolean | Whether serial console is available for this device |
| created_at | DateTime | When the device was registered |
| updated_at | DateTime | When the device was last updated |
| last_heartbeat | DateTime | When the device last sent a heartbeat |
| is_active | Boolean | Whether the device is active or deactivated |

## API Endpoints

The Target Management Service provides the following API endpoints:

### Register a new target device

```
POST /targets
```

Registers a new Android target device in the system. Requires admin role.

### List target devices

```
GET /targets
```

Retrieves a list of target devices with optional filtering by status, device type, and active status. Supports pagination.

### Get a specific target device

```
GET /targets/{target_id}
```

Retrieves details of a specific target device by ID.

### Update a target device

```
PUT /targets/{target_id}
```

Updates details of a specific target device. Requires admin role.

### Deactivate a target device

```
POST /targets/{target_id}/deactivate
```

Soft deletes a target device by marking it as inactive. Requires admin role.

### Delete a target device

```
DELETE /targets/{target_id}
```

Hard deletes a target device. Not recommended for normal operations - use deactivate instead. Requires admin role.

### Reserve a target device

```
POST /targets/{target_id}/reserve
```

Reserves a target device for immediate use. Requires developer role.

### Release a target device

```
POST /targets/{target_id}/release
```

Releases a previously reserved target device. Requires developer role.

### Process heartbeat from gateway

```
POST /targets/heartbeat
```

Processes heartbeat from gateway agent with target device status updates. This endpoint is open for gateway agents without authentication.

## Authentication and Authorization

The Target Management Service uses JWT-based authentication for API access. The following roles are supported:

- **Admin**: Can register, update, deactivate, and delete target devices.
- **Developer**: Can list, get, reserve, and release target devices.
- **Anonymous**: Can only access the heartbeat endpoint.

## Audit Logging

All API calls to the Target Management Service are logged for audit trail purposes. The audit log includes:

- Request method and path
- User ID (if authenticated)
- Client IP address
- Response status code
- Response time
- Request and response details

## OpenAPI Documentation

The Target Management Service provides OpenAPI documentation for all endpoints. The documentation is available at:

```
/docs
```

## Database Schema

The Target Management Service uses a PostgreSQL database to store device information. The database schema is defined in the `models/target.py` file.

## Migrations

Database migrations are handled by the `migrations/target_device_update.py` script, which ensures that the database schema is up-to-date with the latest model changes.

## Error Handling

The Target Management Service provides detailed error messages for all API calls. The error responses include:

- Error code
- Error message
- Error details (if available)

## Deployment

The Target Management Service is deployed as part of the Android Lab Platform backend. It can be deployed using Docker Compose or Kubernetes.
