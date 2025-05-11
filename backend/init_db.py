#!/usr/bin/env python3
"""
Initialize the database with an admin user.
Run this script after setting up the backend to create the initial admin user.
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

from models import Base, User, UserRole
from auth import get_password_hash

# Load environment variables
load_dotenv()

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./android_lab.db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=True)

# Create async session factory
async_session = sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)

async def init_db():
    """Initialize the database with tables and an admin user"""
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create admin user
    admin_username = "admin"
    admin_password = "admin123"  # Change this in production!
    admin_email = "admin@example.com"
    
    # Create session
    async with async_session() as session:
        # Check if admin user already exists
        result = await session.execute(f"SELECT * FROM users WHERE username = '{admin_username}'")
        user = result.fetchone()
        
        if user:
            print(f"Admin user '{admin_username}' already exists.")
            return
        
        # Create admin user
        hashed_password = get_password_hash(admin_password)
        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=hashed_password,
            role=UserRole.ADMIN,
            is_active=True
        )
        
        session.add(admin_user)
        await session.commit()
        
        print(f"Created admin user '{admin_username}' with password '{admin_password}'.")
        print("IMPORTANT: Change this password in production!")

if __name__ == "__main__":
    asyncio.run(init_db())
