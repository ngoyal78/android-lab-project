import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
import os
import yaml
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Try to import using relative imports first (when running as a module)
# If that fails, fall back to local imports (when running directly from backend directory)
try:
    from backend.routers import auth_router, users_router, targets_router, reservations_router, artifacts_router, ws_router, tests_router, target_management_router
    from backend.database import Base, engine
    from backend.middleware import AuditLogMiddleware
except ModuleNotFoundError:
    # When running from the backend directory
    from routers import auth_router, users_router, targets_router, reservations_router, artifacts_router, ws_router, tests_router, target_management_router
    from database import Base, engine
    from middleware import AuditLogMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api.log")
    ]
)

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Android Lab Platform API",
    description="Backend API for Android Lab Platform",
    version="0.1.0"
)

# Function to load OpenAPI schemas from YAML files
def load_openapi_schemas():
    schemas = {}
    openapi_dir = Path(__file__).parent / "openapi"
    
    if not openapi_dir.exists():
        return schemas
    
    for yaml_file in openapi_dir.glob("*.yaml"):
        try:
            with open(yaml_file, "r") as f:
                schema = yaml.safe_load(f)
                schemas[yaml_file.stem] = schema
        except Exception as e:
            print(f"Error loading OpenAPI schema from {yaml_file}: {e}")
    
    return schemas

# Custom OpenAPI schema generator that incorporates external schemas
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # Load external OpenAPI schemas
    external_schemas = load_openapi_schemas()
    
    # Merge components from external schemas
    for schema_name, schema in external_schemas.items():
        if "components" in schema and "schemas" in schema["components"]:
            if "components" not in openapi_schema:
                openapi_schema["components"] = {}
            if "schemas" not in openapi_schema["components"]:
                openapi_schema["components"]["schemas"] = {}
            
            # Add schemas from external file
            for name, definition in schema["components"]["schemas"].items():
                openapi_schema["components"]["schemas"][name] = definition
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Override the default OpenAPI schema generator
app.openapi = custom_openapi

# Add audit logging middleware
app.add_middleware(AuditLogMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(targets_router)
app.include_router(target_management_router)
app.include_router(reservations_router)
app.include_router(artifacts_router)
app.include_router(ws_router)
app.include_router(tests_router)

@app.get("/health")
async def health_check():
    """Health check endpoint for the API"""
    return {"status": "healthy", "service": "android-lab-platform-api"}

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Welcome to Android Lab Platform API",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.on_event("startup")
async def startup():
    """Create tables on startup if they don't exist"""
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
