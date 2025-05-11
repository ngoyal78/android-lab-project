from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from ..models.user import UserRole

# Base User Schema
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole = UserRole.DEVELOPER

# Schema for creating a new user
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

# Schema for updating a user
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

# Schema for user response
class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        orm_mode = True

# Schema for token response
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

# Schema for token data
class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None
    exp: Optional[datetime] = None

# Schema for login
class UserLogin(BaseModel):
    username: str
    password: str
