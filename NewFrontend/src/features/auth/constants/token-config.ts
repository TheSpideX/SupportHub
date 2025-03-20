// Import environment variables if needed
import { API_CONFIG } from '../../../config/api';

// Default value (for backward compatibility)
const DEFAULT_REFRESH_THRESHOLD_SECONDS = 300; // 5 minutes

// Get value from API config or use default
// Convert from milliseconds to seconds if using the existing REFRESH_THRESHOLD property
export const REFRESH_THRESHOLD_SECONDS = 
  (API_CONFIG.AUTH?.REFRESH_THRESHOLD && Math.floor(API_CONFIG.AUTH.REFRESH_THRESHOLD / 1000)) || 
  DEFAULT_REFRESH_THRESHOLD_SECONDS;

// Convert to milliseconds for components that need it
export const REFRESH_THRESHOLD_MS = REFRESH_THRESHOLD_SECONDS * 1000;

// Export as default for backward compatibility
export default {
  REFRESH_THRESHOLD_SECONDS,
  REFRESH_THRESHOLD_MS
};
