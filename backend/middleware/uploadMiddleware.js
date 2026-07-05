// ============================================
// middleware/uploadMiddleware.js
// Multer Configuration with Memory Storage
// ============================================
const multer = require('multer');
const ApiError = require('../utils/ApiError');

// File size limits (in bytes), configurable via environment variables
const FILE_SIZE_LIMITS = {
    IMAGE: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 10 * 1024 * 1024,        // default 10MB
    VIDEO_CLOUDINARY: parseInt(process.env.MAX_VIDEO_SIZE, 10) || 10 * 1024 * 1024,  // default 10MB
    VIDEO_GRIDFS: parseInt(process.env.MAX_GRIDFS_VIDEO_SIZE, 10) || 500 * 1024 * 1024      // default 500MB
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
    IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    VIDEO: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm']
};

// Memory storage for streaming
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
    const isImage = ALLOWED_MIME_TYPES.IMAGE.includes(file.mimetype);
    const isVideo = ALLOWED_MIME_TYPES.VIDEO.includes(file.mimetype);

    if (isImage || isVideo) {
        cb(null, true);
    } else {
        cb(new ApiError(
            `Invalid file type. Allowed: ${[...ALLOWED_MIME_TYPES.IMAGE, ...ALLOWED_MIME_TYPES.VIDEO].join(', ')}`,
            400
        ), false);
    }
};

// Multer upload instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: FILE_SIZE_LIMITS.VIDEO_GRIDFS // Max limit
    }
});

module.exports = {
    upload,
    FILE_SIZE_LIMITS,
    ALLOWED_MIME_TYPES
};