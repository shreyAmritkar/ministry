// ============================================
// middleware/sseAuth.js
// Authenticates SSE connections.
//
// The browser's EventSource API cannot set custom request headers, so
// the access token can't travel as `Authorization: Bearer <token>`
// the way every other route expects (see middleware/auth.js). Instead
// the frontend passes it as a query param: /notifications/stream?token=...
//
// Otherwise this mirrors `protect` exactly — same JWT, same
// short-lived access token, same "reject if deactivated" check.
// ============================================
const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protectSSE(req, res, next) {
    const token = req.query.token;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated' });
    }

    req.user = user;
    next();
}

module.exports = { protectSSE };
