// ============================================
// controllers/notificationController.js
// ============================================
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const sseService = require('../services/sseService');

/**
 * @route   GET /api/v1/notifications/stream
 * @desc    Server-Sent Events stream of this user's real-time
 *          notifications (new notification / read / all-read).
 *          Auth via ?token=... — see middleware/sseAuth.js.
 * @access  Private (SSE)
 */
exports.streamNotifications = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Nginx/some proxies buffer responses by default, which breaks streaming.
        'X-Accel-Buffering': 'no',
    });

    // Tell the client we're live before anything else happens.
    res.write(`event: connected\ndata: ${JSON.stringify({ userId: req.user._id })}\n\n`);

    const unregister = sseService.registerConnection(res, {
        userId: String(req.user._id),
        role: req.user.role,
    });

    req.on('close', unregister);
};

exports.getNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const numLimit = Number(limit);
    const isUnreadOnly = unreadOnly === 'true';

    const notifications = await Notification.findByRecipient(req.user._id, {
        unreadOnly: isUnreadOnly,
        limit: numLimit,
        offset: (page - 1) * numLimit,
    });

    const count = await Notification.count(req.user._id, { unreadOnly: isUnreadOnly });

    res.json({
        success: true,
        data: {
            notifications,
            totalPages: Math.ceil(count / numLimit),
            currentPage: page,
            total: count,
        },
    });
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Notification.count(req.user._id, { unreadOnly: true });

    res.json({
        success: true,
        data: { count },
    });
});

exports.markAsRead = asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(req.params.id, req.user._id);

    if (!notification) {
        return res.status(404).json({
            success: false,
            message: 'Notification not found',
        });
    }

    res.json({
        success: true,
        data: { notification },
    });
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
    await notificationService.markAllAsRead(req.user._id);

    res.json({
        success: true,
        message: 'All notifications marked as read',
    });
});

exports.deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.deleteOne(req.params.id, req.user._id);

    if (!notification) {
        return res.status(404).json({
            success: false,
            message: 'Notification not found',
        });
    }

    res.json({
        success: true,
        message: 'Notification deleted',
    });
});
