/**
 * useTokenService Hook
 * 
 * Provides access to the TokenService singleton instance
 */

import { useEffect, useState } from 'react';
import { TokenService } from '../services/TokenService';

// Create a singleton instance of TokenService
let tokenServiceInstance: TokenService | null = null;

export const useTokenService = (): TokenService | null => {
  const [tokenService, setTokenService] = useState<TokenService | null>(tokenServiceInstance);
  
  useEffect(() => {
    // Initialize TokenService if not already done
    if (!tokenServiceInstance) {
      tokenServiceInstance = new TokenService();
    }
    
    setTokenService(tokenServiceInstance);
    
    // No cleanup needed for singleton
  }, []);
  
  return tokenService;
};
