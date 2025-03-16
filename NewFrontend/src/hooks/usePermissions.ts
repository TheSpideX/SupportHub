import { useSelector } from 'react-redux';

export const usePermissions = () => {
  const { user } = useSelector((state: any) => state.auth);

  // Check if user has a specific permission
  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    
    // Admin has all permissions
    if (user.permissions.includes('*')) return true;
    
    return user.permissions.includes(permission);
  };

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!permissions.length) return true;
    return permissions.some(permission => hasPermission(permission));
  };

  // Check if user has all of the specified permissions
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!permissions.length) return true;
    return permissions.every(permission => hasPermission(permission));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };
};