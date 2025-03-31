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
  
  // CSRF cookie options
  csrfOptions: {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: 'strict',
    path: '/',
    maxAge: 3600 * 1000 // 1 hour in milliseconds (matches CSRF token expiry)
  }
};

module.exports = cookieConfig;
