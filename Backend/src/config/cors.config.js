/**
 * CORS configuration
 * Ensures frontend can make authenticated requests to backend
 */
const corsConfig = {
  // Allow requests from frontend origins - support multiple origins
  origin: process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',') : 
    ['http://localhost:3000', 'http://localhost:5173'],
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Cache preflight requests for 1 hour (3600 seconds)
  maxAge: 3600,
  
  // Allow these headers in requests
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  
  // Expose these headers to the frontend
  exposedHeaders: [
    'Content-Length',
    'X-CSRF-Token'
  ],
  
  // Allow these HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
};

module.exports = corsConfig;
