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

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        error = new ApiError('Resource not found', 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        error = new ApiError(`${field} already exists`, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new ApiError(message, 400);
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