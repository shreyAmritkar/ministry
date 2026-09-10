// ============================================
// middleware/errorHandler.js
// ============================================
const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for development
    if (process.env.NODE_ENV === 'development') {
        console.error(err);
    }

    // Invalid UUID passed as an :id param
    if (err.code === '22P02') {
        error = new ApiError('Resource not found', 404);
    }

    // Postgres unique_violation (was Mongoose's duplicate key error 11000)
    if (err.code === '23505') {
        const match = /Key \((.+?)\)=/.exec(err.detail || '');
        const field = match ? match[1] : 'field';
        error = new ApiError(`${field} already exists`, 400);
    }

    // Postgres check_violation / not_null_violation (was Mongoose ValidationError)
    if (err.code === '23514' || err.code === '23502') {
        error = new ApiError(err.detail || err.message || 'Validation failed', 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new ApiError('Invalid token', 401);
    }

    if (err.name === 'TokenExpiredError') {
        error = new ApiError('Token expired', 401);
    }

    res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;