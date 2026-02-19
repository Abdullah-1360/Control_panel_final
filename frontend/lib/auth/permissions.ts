/**
 * Permission checking utilities
 */

import { useAuthStore } from './store';

export interface Permission {
  resource: string;
  action: string;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  userPermissions: string[],
  resource: string,
  action: string
): boolean {
  // Check for wildcard permissions
  if (userPermissions.includes('*.*')) {
    return true; // SUPER_ADMIN has all permissions
  }

  // Check for resource wildcard (e.g., "users.*")
  if (userPermissions.includes(`${resource}.*`)) {
    return true;
  }

  // Check for action wildcard (e.g., "*.read")
  if (userPermissions.includes(`*.${action}`)) {
    return true;
  }

  // Check for exact permission match
  if (userPermissions.includes(`${resource}.${action}`)) {
    return true;
  }

  return false;
}

/**
 * Hook to check if current user has a permission
 */
export function usePermission(resource: string, action: string): boolean {
  const { user } = useAuthStore();
  
  if (!user) {
    return false;
  }

  // Get permissions from JWT token (stored in user object after login)
  // Note: In a real app, you'd decode the JWT to get permissions
  // For now, we'll use a workaround by checking the role
  
  // SUPER_ADMIN has all permissions
  if (user.role.name === 'SUPER_ADMIN') {
    return true;
  }

  // For other roles, we need to check against their permissions
  // Since we don't store permissions in the user object, we'll use role-based checks
  return checkRolePermission(user.role.name, resource, action);
}

/**
 * Check permission based on role name (temporary solution)
 * TODO: Store permissions in user object or fetch from API
 */
function checkRolePermission(roleName: string, resource: string, action: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    SUPER_ADMIN: ['*.*'],
    ADMIN: [
      'users.read', 'users.create', 'users.update', 'users.delete',
      'roles.read',
      'sessions.read',
      'servers.*',
      'sites.*',
      'incidents.*',
      'settings.read', 'settings.update',
      'audit.read',
    ],
    ENGINEER: [
      'incidents.*',
      'sites.read',
      'servers.read',
      'audit.read',
      'roles.read',
      'sessions.read',
    ],
    VIEWER: [
      'users.read',
      'roles.read',
      'sessions.read',
      'audit.read',
      'servers.read',
      'sites.read',
      'incidents.read',
      'settings.read',
    ],
  };

  const permissions = rolePermissions[roleName] || [];
  return hasPermission(permissions, resource, action);
}

/**
 * Hook to check multiple permissions (user must have ALL)
 */
export function usePermissions(requiredPermissions: Permission[]): boolean {
  const { user } = useAuthStore();
  
  if (!user) {
    return false;
  }

  return requiredPermissions.every(perm => 
    usePermission(perm.resource, perm.action)
  );
}

/**
 * Hook to check if user has ANY of the permissions
 */
export function useAnyPermission(requiredPermissions: Permission[]): boolean {
  const { user } = useAuthStore();
  
  if (!user) {
    return false;
  }

  return requiredPermissions.some(perm => 
    usePermission(perm.resource, perm.action)
  );
}

/**
 * Check if user has a specific role
 */
export function useRole(roleName: string): boolean {
  const { user } = useAuthStore();
  return user?.role.name === roleName;
}

/**
 * Check if user has any of the specified roles
 */
export function useAnyRole(roleNames: string[]): boolean {
  const { user } = useAuthStore();
  return roleNames.includes(user?.role.name || '');
}
