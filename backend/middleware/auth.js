// ============================================
// middleware/auth.js
// Validates the ACCESS token only — purely by JWT signature + expiry.
// The access token is never written to the database (see
// controllers/authController.js / models/RefreshToken.js for the
// refresh-token side, which IS persisted and revocable).
// ============================================
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new ApiError('Not authorized to access this route', 401);
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        // Deliberately generic — doesn't distinguish expired vs. malformed
        // vs. bad signature, so a client can't fingerprint why a token
        // failed. An expired access token here is the expected, frequent
        // case: the client should call /auth/refresh-token and retry.
        throw new ApiError('Not authorized to access this route', 401);
    }

    // Still hits the DB, but only to load the CURRENT user record — not
    // to validate the token itself. This is why disabling a user or
    // changing their role takes effect on their very next request
    // instead of waiting for the access token to expire.
    req.user = await User.findById(decoded.id);

    if (!req.user) {
        throw new ApiError('User not found', 404);
    }

    if (!req.user.isActive) {
        throw new ApiError('Your account has been deactivated', 403);
    }

    next();
});
