const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { protectSSE } = require('../middleware/sseAuth');
const notificationController = require('../controllers/notificationController');

// SSE stream — its own auth (token via query param, since EventSource
// can't set an Authorization header), so it's declared before the
// blanket `router.use(protect)` below.
router.get('/stream', protectSSE, notificationController.streamNotifications);

router.use(protect);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;