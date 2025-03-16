import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  children: ReactNode;
  permissions: string[];
  requireAll?: boolean;
}

export const PermissionGuard = ({ 
  children, 
  permissions, 
  requireAll = false 
}: PermissionGuardProps) => {
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  
  const hasAccess = requireAll 
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!hasAccess) return null;
  
  return <>{children}</>;
};