import authReducer from "./authSlice";
import sessionReducer from "./sessionSlice";
import securityReducer from "./securitySlice";

export {
  // Auth actions and selectors
  setAuthState,
  setUser,
  setLoading,
  setError,
  setInitialized,
  setInitialized as setAuthInitialized,
  updateUserData,
  updateOrganizationContext,
  clearAuthState,
  setLastVerified,
  selectAuthState,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
  selectIsInitialized,
} from "./authSlice";

export {
  // Session actions and selectors
  setSessionState,
  setSessionStatus,
  setSessionData,
  updateSessionData,
  setLastActivity,
  setWarningIssued,
  clearSessionData,
  selectSessionState,
  selectSessionStatus,
  selectSessionData,
  selectLastActivity,
} from "./sessionSlice";

export {
  // Security actions and selectors
  setSecurityContext,
  updateSecurityContext,
  setSecurityEvents,
  addSecurityEvent,
  resolveSecurityEvent,
  setThreatLevel,
  setLockoutUntil,
  setFailedAttempts,
  incrementFailedAttempts,
  clearSecurityEvents,
  clearSecurityContext,
  selectSecurityState,
  selectSecurityContext,
  selectSecurityEvents,
  selectThreatLevel,
  selectLockoutUntil,
  selectFailedAttempts,
} from "./securitySlice";

// Export reducers for store configuration
export const authReducers = {
  auth: authReducer,
  session: sessionReducer,
  security: securityReducer,
};

export default authReducers;
