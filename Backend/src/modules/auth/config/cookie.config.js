/**
 * Cookie configuration - single source of truth
 * Match these with frontend expectations
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const cookieConfig = {
  // Cookie names
  names: {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    CSRF_TOKEN: 'csrf_token',
    SESSION_ID: 'session_id'
  },
  
  // Base cookie options
  baseOptions: {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: 'strict',
    path: '/'
  },
  
  // CSRF cookie options (not httpOnly so JS can access it)
  csrfOptions: {
    httpOnly: false,
    secure: !isDevelopment,
    sameSite: 'strict',
    path: '/'
  },
  
  // Cookie expiry times (inherited from token config)
  // These will be set dynamically based on token expiry times
};

module.exports = cookieConfig;
