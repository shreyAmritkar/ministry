
// ============================================
// routes/mediaRoutes.js (FIXED VERSION)
// ============================================
const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/uploadMiddleware');

// Upload media (protected route) - Use single 'media' field
router.post(
    '/upload',
    protect,
    upload.single('media'),
    mediaController.uploadMedia
);

// Stream video from GridFS (public)
router.get('/stream/:fileId', mediaController.streamVideo);

// Delete media (protected route)
router.delete(
    '/:storageType/:id',
    protect,
    mediaController.deleteMedia
);

module.exports = router;