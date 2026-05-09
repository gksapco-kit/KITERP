# app/core/permissions.py
from enum import Enum
from typing import List, Optional


class Permission(str, Enum):
    # Vendor permissions
    VENDOR_READ = "vendor:read"
    VENDOR_UPDATE = "vendor:update"
    VENDOR_DELETE = "vendor:delete"
    
    # Product permissions
    PRODUCT_CREATE = "product:create"
    PRODUCT_READ = "product:read"
    PRODUCT_UPDATE = "product:update"
    PRODUCT_DELETE = "product:delete"
    
    # Service permissions
    SERVICE_CREATE = "service:create"
    SERVICE_READ = "service:read"
    SERVICE_UPDATE = "service:update"
    SERVICE_DELETE = "service:delete"
    
    # Order permissions
    ORDER_READ = "order:read"
    ORDER_UPDATE = "order:update"
    ORDER_CANCEL = "order:cancel"
    
    # Team permissions
    TEAM_INVITE = "team:invite"
    TEAM_MANAGE = "team:manage"
    TEAM_REMOVE = "team:remove"
    
    # Settings permissions
    SETTINGS_READ = "settings:read"
    SETTINGS_UPDATE = "settings:update"
    
    # Finance permissions
    FINANCE_READ = "finance:read"
    FINANCE_MANAGE = "finance:manage"
    
    # Analytics permissions
    ANALYTICS_READ = "analytics:read"


# Role permission mappings
ROLE_PERMISSIONS = {
    "owner": list(Permission),  # All permissions
    "admin": [
        Permission.VENDOR_READ,
        Permission.VENDOR_UPDATE,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_READ,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_DELETE,
        Permission.SERVICE_CREATE,
        Permission.SERVICE_READ,
        Permission.SERVICE_UPDATE,
        Permission.SERVICE_DELETE,
        Permission.ORDER_READ,
        Permission.ORDER_UPDATE,
        Permission.ORDER_CANCEL,
        Permission.TEAM_INVITE,
        Permission.TEAM_MANAGE,
        Permission.SETTINGS_READ,
        Permission.SETTINGS_UPDATE,
        Permission.FINANCE_READ,
        Permission.ANALYTICS_READ,
    ],
    "manager": [
        Permission.VENDOR_READ,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_READ,
        Permission.PRODUCT_UPDATE,
        Permission.SERVICE_CREATE,
        Permission.SERVICE_READ,
        Permission.SERVICE_UPDATE,
        Permission.ORDER_READ,
        Permission.ORDER_UPDATE,
        Permission.SETTINGS_READ,
        Permission.ANALYTICS_READ,
    ],
    "staff": [
        Permission.VENDOR_READ,
        Permission.PRODUCT_READ,
        Permission.SERVICE_READ,
        Permission.ORDER_READ,
        Permission.ORDER_UPDATE,
    ],
}


def get_permissions_for_role(role: str) -> List[Permission]:
    """Get permissions for a role."""
    return ROLE_PERMISSIONS.get(role, [])


def has_permission(
    user_permissions: List[str],
    required_permission: Permission
) -> bool:
    """Check if user has the required permission."""
    return required_permission.value in user_permissions
