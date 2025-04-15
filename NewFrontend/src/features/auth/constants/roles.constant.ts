/**
 * Role Constants
 * Defines user roles and their hierarchy for the system
 * This file should be kept in sync with the backend roles.constant.js
 */

// User role enum
export enum UserRole {
  ADMIN = 'admin',
  TEAM_LEAD = 'team_lead',
  TECHNICAL = 'technical',
  SUPPORT = 'support',
  CUSTOMER = 'customer',
}

// Role hierarchy (higher index = higher permissions)
export const ROLE_HIERARCHY = [
  UserRole.CUSTOMER,
  UserRole.SUPPORT,
  UserRole.TECHNICAL,
  UserRole.TEAM_LEAD,
  UserRole.ADMIN,
];

// Role permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'manage:organization',
    'manage:teams',
    'manage:users',
    'manage:invites',
    'view:analytics',
    'manage:settings',
    'manage:tickets',
    'view:tickets',
    'comment:tickets',
  ],
  [UserRole.TEAM_LEAD]: [
    'manage:team',
    'manage:team_invites',
    'view:team_analytics',
    'manage:tickets',
    'view:tickets',
    'comment:tickets',
  ],
  [UserRole.TECHNICAL]: [
    'solve:tickets',
    'view:tickets',
    'comment:tickets',
  ],
  [UserRole.SUPPORT]: [
    'create:tickets',
    'view:tickets',
    'comment:tickets',
  ],
  [UserRole.CUSTOMER]: [
    'create:tickets',
    'view:own_tickets',
    'comment:own_tickets',
  ],
};

// Role display names for UI
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.TEAM_LEAD]: 'Team Lead',
  [UserRole.TECHNICAL]: 'Technical Support',
  [UserRole.SUPPORT]: 'Customer Support',
  [UserRole.CUSTOMER]: 'Customer',
};

// Check if a role has a specific permission
export const hasPermission = (role: UserRole, permission: string): boolean => {
  if (!ROLE_PERMISSIONS[role]) {
    return false;
  }
  return ROLE_PERMISSIONS[role].includes(permission);
};

// Check if a role has higher or equal permissions than another role
export const hasHigherOrEqualRole = (role: UserRole, targetRole: UserRole): boolean => {
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);
  
  if (roleIndex === -1 || targetIndex === -1) {
    return false;
  }
  
  return roleIndex >= targetIndex;
};

// Get all permissions for a role (including inherited permissions)
export const getAllPermissions = (role: UserRole): string[] => {
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  if (roleIndex === -1) {
    return [];
  }
  
  // Get permissions from this role and all lower roles
  const permissions = new Set<string>();
  for (let i = 0; i <= roleIndex; i++) {
    const currentRole = ROLE_HIERARCHY[i];
    ROLE_PERMISSIONS[currentRole].forEach(perm => permissions.add(perm));
  }
  
  return Array.from(permissions);
};

// Map backend role string to frontend UserRole enum
export const mapStringToUserRole = (role: string): UserRole => {
  switch (role.toLowerCase()) {
    case 'admin':
      return UserRole.ADMIN;
    case 'team_lead':
      return UserRole.TEAM_LEAD;
    case 'technical':
      return UserRole.TECHNICAL;
    case 'support':
      return UserRole.SUPPORT;
    case 'customer':
      return UserRole.CUSTOMER;
    default:
      return UserRole.CUSTOMER; // Default to lowest permission level
  }
};
