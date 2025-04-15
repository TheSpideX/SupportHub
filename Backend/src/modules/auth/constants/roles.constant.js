/**
 * Role Constants
 * Defines user roles and their hierarchy for the system
 */

// User role constants
exports.USER_ROLES = {
  ADMIN: 'admin',
  TEAM_LEAD: 'team_lead',
  TECHNICAL: 'technical',
  SUPPORT: 'support',
  CUSTOMER: 'customer',
};

// Role hierarchy (higher index = higher permissions)
exports.ROLE_HIERARCHY = [
  exports.USER_ROLES.CUSTOMER,
  exports.USER_ROLES.SUPPORT,
  exports.USER_ROLES.TECHNICAL,
  exports.USER_ROLES.TEAM_LEAD,
  exports.USER_ROLES.ADMIN,
];

// Role permissions mapping
exports.ROLE_PERMISSIONS = {
  [exports.USER_ROLES.ADMIN]: [
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
  [exports.USER_ROLES.TEAM_LEAD]: [
    'manage:team',
    'manage:team_invites',
    'view:team_analytics',
    'manage:tickets',
    'view:tickets',
    'comment:tickets',
  ],
  [exports.USER_ROLES.TECHNICAL]: [
    'solve:tickets',
    'view:tickets',
    'comment:tickets',
  ],
  [exports.USER_ROLES.SUPPORT]: [
    'create:tickets',
    'view:tickets',
    'comment:tickets',
  ],
  [exports.USER_ROLES.CUSTOMER]: [
    'create:tickets',
    'view:own_tickets',
    'comment:own_tickets',
  ],
};

// Check if a role has a specific permission
exports.hasPermission = (role, permission) => {
  if (!exports.ROLE_PERMISSIONS[role]) {
    return false;
  }
  return exports.ROLE_PERMISSIONS[role].includes(permission);
};

// Check if a role has higher or equal permissions than another role
exports.hasHigherOrEqualRole = (role, targetRole) => {
  const roleIndex = exports.ROLE_HIERARCHY.indexOf(role);
  const targetIndex = exports.ROLE_HIERARCHY.indexOf(targetRole);
  
  if (roleIndex === -1 || targetIndex === -1) {
    return false;
  }
  
  return roleIndex >= targetIndex;
};

// Get all permissions for a role (including inherited permissions)
exports.getAllPermissions = (role) => {
  const roleIndex = exports.ROLE_HIERARCHY.indexOf(role);
  if (roleIndex === -1) {
    return [];
  }
  
  // Get permissions from this role and all lower roles
  const permissions = new Set();
  for (let i = 0; i <= roleIndex; i++) {
    const currentRole = exports.ROLE_HIERARCHY[i];
    exports.ROLE_PERMISSIONS[currentRole].forEach(perm => permissions.add(perm));
  }
  
  return Array.from(permissions);
};
