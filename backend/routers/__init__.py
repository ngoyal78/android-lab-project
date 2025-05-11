"""
Router package for the Android Lab Platform API.

This package contains all the routers for the API.
"""

from .auth import router as auth_router
from .users import router as users_router
from .targets import router as targets_router
from .reservations import router as reservations_router
from .artifacts import router as artifacts_router
from .ws import router as ws_router
from .tests import router as tests_router
from .target_management import router as target_management_router
from .remote_access import router as remote_access_router
from .policies import router as policies_router
from .gateways import router as gateways_router
from .target_gateway_associations import router as target_gateway_associations_router

__all__ = [
    "auth_router",
    "users_router",
    "targets_router",
    "reservations_router",
    "artifacts_router",
    "ws_router",
    "tests_router",
    "target_management_router",
    "remote_access_router",
    "policies_router",
    "gateways_router",
    "target_gateway_associations_router"
]
