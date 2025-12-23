// ============================================
// controllers/notificationController.js (NEW)
// ============================================
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');

exports.getNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { recipient: req.user._id };
    if (unreadOnly === 'true') {
        query.read = false;
    }

    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const count = await Notification.countDocuments(query);

    res.json({
        success: true,
        data: {
            notifications,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count,
        },
    });
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({
        recipient: req.user._id,
        read: false,
    });

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
    const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        recipient: req.user._id,
    });

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