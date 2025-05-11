"""
Migration script to update the target_devices table with new fields.

This script adds the following fields to the target_devices table:
- adb_endpoint: String field for ADB endpoint
- ssh_endpoint: String field for SSH endpoint
- hal_support: JSON field for HAL support information
- is_active: Boolean field for active status
- location: String field for device location
- cpu_info, gpu_info: JSON fields for hardware specifications
- memory_mb, storage_gb: Integer fields for hardware specifications
- screen_size_inch: Float field for screen size
- screen_resolution: String field for screen resolution
- network_capabilities: Array field for network capabilities
- tags, purpose: Array fields for tagging and categorization
- health_check_timestamp, health_check_status, health_check_score: Fields for health monitoring
- heartbeat_interval_seconds: Integer field for heartbeat configuration
- created_by, updated_by: Integer fields for audit trail

It also updates the device_status enum to include 'maintenance' and 'unhealthy' statuses,
and the device_type enum to include 'emulator' type.
"""

import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/android_lab")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=True)

async def run_migration():
    """Run the migration to update the target_devices table."""
    logger.info("Starting migration for target_devices table")
    
    async with engine.begin() as conn:
        # Check if the table exists
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'target_devices')"
        ))
        table_exists = result.scalar()
        
        if not table_exists:
            logger.info("target_devices table does not exist, skipping migration")
            return
        
        # Update device_status enum
        # Check if the device_status enum has 'maintenance' value
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid "
            "WHERE t.typname = 'devicestatus' AND e.enumlabel = 'maintenance')"
        ))
        has_maintenance = result.scalar()
        
        if not has_maintenance:
            logger.info("Adding 'maintenance' to DeviceStatus enum")
            await conn.execute(text(
                "ALTER TYPE devicestatus ADD VALUE IF NOT EXISTS 'maintenance'"
            ))
        
        # Check if the device_status enum has 'unhealthy' value
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid "
            "WHERE t.typname = 'devicestatus' AND e.enumlabel = 'unhealthy')"
        ))
        has_unhealthy = result.scalar()
        
        if not has_unhealthy:
            logger.info("Adding 'unhealthy' to DeviceStatus enum")
            await conn.execute(text(
                "ALTER TYPE devicestatus ADD VALUE IF NOT EXISTS 'unhealthy'"
            ))
        
        # Update device_type enum
        # Check if the device_type enum has 'emulator' value
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid "
            "WHERE t.typname = 'devicetype' AND e.enumlabel = 'emulator')"
        ))
        has_emulator = result.scalar()
        
        if not has_emulator:
            logger.info("Adding 'emulator' to DeviceType enum")
            await conn.execute(text(
                "ALTER TYPE devicetype ADD VALUE IF NOT EXISTS 'emulator'"
            ))
        
        # Create NetworkCapability enum if it doesn't exist
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'networkcapability')"
        ))
        has_network_capability = result.scalar()
        
        if not has_network_capability:
            logger.info("Creating NetworkCapability enum")
            await conn.execute(text(
                "CREATE TYPE networkcapability AS ENUM ('wifi', 'ethernet', 'cellular', 'bluetooth', 'nfc')"
            ))
        
        # Check if columns exist before adding them
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'target_devices'"
        ))
        existing_columns = [row[0] for row in result.fetchall()]
        
        # Add basic columns from original migration
        if 'adb_endpoint' not in existing_columns:
            logger.info("Adding adb_endpoint column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN adb_endpoint VARCHAR"
            ))
        
        if 'ssh_endpoint' not in existing_columns:
            logger.info("Adding ssh_endpoint column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN ssh_endpoint VARCHAR"
            ))
        
        if 'hal_support' not in existing_columns:
            logger.info("Adding hal_support column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN hal_support JSONB DEFAULT '{}'::jsonb"
            ))
        
        if 'is_active' not in existing_columns:
            logger.info("Adding is_active column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN is_active BOOLEAN DEFAULT TRUE"
            ))
            
            # Set all existing records to active
            await conn.execute(text(
                "UPDATE target_devices SET is_active = TRUE"
            ))
        
        # Add location information
        if 'location' not in existing_columns:
            logger.info("Adding location column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN location VARCHAR"
            ))
        
        # Add hardware specifications
        if 'cpu_info' not in existing_columns:
            logger.info("Adding cpu_info column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN cpu_info JSONB DEFAULT '{}'::jsonb"
            ))
        
        if 'gpu_info' not in existing_columns:
            logger.info("Adding gpu_info column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN gpu_info JSONB DEFAULT '{}'::jsonb"
            ))
        
        if 'memory_mb' not in existing_columns:
            logger.info("Adding memory_mb column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN memory_mb INTEGER"
            ))
        
        if 'storage_gb' not in existing_columns:
            logger.info("Adding storage_gb column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN storage_gb INTEGER"
            ))
        
        if 'screen_size_inch' not in existing_columns:
            logger.info("Adding screen_size_inch column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN screen_size_inch FLOAT"
            ))
        
        if 'screen_resolution' not in existing_columns:
            logger.info("Adding screen_resolution column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN screen_resolution VARCHAR"
            ))
        
        # Add network capabilities
        if 'network_capabilities' not in existing_columns:
            logger.info("Adding network_capabilities column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN network_capabilities networkcapability[]"
            ))
        
        # Add tags and purpose
        if 'tags' not in existing_columns:
            logger.info("Adding tags column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN tags VARCHAR[] DEFAULT '{}'::varchar[]"
            ))
        
        if 'purpose' not in existing_columns:
            logger.info("Adding purpose column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN purpose VARCHAR[] DEFAULT '{}'::varchar[]"
            ))
        
        # Add health check information
        if 'health_check_timestamp' not in existing_columns:
            logger.info("Adding health_check_timestamp column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN health_check_timestamp TIMESTAMP WITH TIME ZONE"
            ))
        
        if 'health_check_status' not in existing_columns:
            logger.info("Adding health_check_status column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN health_check_status JSONB DEFAULT '{}'::jsonb"
            ))
        
        if 'health_check_score' not in existing_columns:
            logger.info("Adding health_check_score column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN health_check_score INTEGER"
            ))
        
        # Add heartbeat configuration
        if 'heartbeat_interval_seconds' not in existing_columns:
            logger.info("Adding heartbeat_interval_seconds column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN heartbeat_interval_seconds INTEGER DEFAULT 10"
            ))
        
        # Add audit fields
        if 'created_by' not in existing_columns:
            logger.info("Adding created_by column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN created_by INTEGER REFERENCES users(id)"
            ))
        
        if 'updated_by' not in existing_columns:
            logger.info("Adding updated_by column to target_devices table")
            await conn.execute(text(
                "ALTER TABLE target_devices ADD COLUMN updated_by INTEGER REFERENCES users(id)"
            ))
        
        logger.info("Migration completed successfully")

if __name__ == "__main__":
    asyncio.run(run_migration())
