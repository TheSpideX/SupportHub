const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    // Enhanced error logging with request details
    logger.error({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
        path: req.path,
        method: req.method,
        requestId: req.id || 'unknown',
        query: req.query,
        body: process.env.NODE_ENV === 'production' ? '[REDACTED]' : req.body,
        errorCode: err.code || 'INTERNAL_SERVER_ERROR',
        errorName: err.name,
        statusCode
    });

    res.status(statusCode).json({
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        ...(err.details && { details: err.details })
    });
};

module.exports = {
    notFoundHandler,
    errorHandler
};