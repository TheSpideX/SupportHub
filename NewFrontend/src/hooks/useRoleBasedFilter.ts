import { useAuth } from '../features/auth/hooks/useAuth';

export const useRoleBasedFilter = () => {
  const { user } = useAuth();
  
  // Filter content based on user role
  const filterByRole = <T>(
    items: T[], 
    roleAccessMap: Record<string, string[]>,
    itemKeyExtractor: (item: T) => string
  ): T[] => {
    if (!user || !user.role) return [];
    
    // Admin can see everything
    if (user.role === 'admin') return items;
    
    // Get allowed keys for user role
    const allowedKeys = roleAccessMap[user.role] || [];
    
    // Filter items based on allowed keys
    return items.filter(item => 
      allowedKeys.includes(itemKeyExtractor(item))
    );
  };

  return { filterByRole, userRole: user?.role };
};