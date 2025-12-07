// ============================================
// controllers/mediaController.js
// Main Upload Controller
// ============================================
const hybridMediaService = require('../services/hybridMediaService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { FILE_SIZE_LIMITS } = require('../middleware/uploadMiddleware');
const User = require('../models/User');

/**
 * @route   POST /api/v1/media/upload
 * @desc    Upload media (image or video) with hybrid storage
 * @access  Private
 */
exports.uploadMedia = asyncHandler(async (req, res, next) => {
    // Validate file existence
    if (!req.file) {
        throw new ApiError('No file uploaded', 400);
    }

    const { buffer, originalname, mimetype, size } = req.file;

    // Additional file size validation
    const isImage = mimetype.startsWith('image/');
    const isVideo = mimetype.startsWith('video/');

    if (isImage && size > FILE_SIZE_LIMITS.IMAGE) {
        throw new ApiError(
            `Image size exceeds limit of ${FILE_SIZE_LIMITS.IMAGE / 1024 / 1024}MB`,
            400
        );
    }

    if (isVideo && size > FILE_SIZE_LIMITS.VIDEO_GRIDFS) {
        throw new ApiError(
            `Video size exceeds limit of ${FILE_SIZE_LIMITS.VIDEO_GRIDFS / 1024 / 1024}MB`,
            400
        );
    }

    try {
        // Determine storage strategy
        const storageType = hybridMediaService.determineStorageType(size, mimetype);

        let mediaData;
        let mediaUrl;
        let mediaType;

        // Route to appropriate storage
        if (storageType === 'cloudinary') {
            console.log(`📤 Uploading to Cloudinary: ${originalname} (${(size / 1024 / 1024).toFixed(2)}MB)`);

            const cloudinaryResult = await hybridMediaService.uploadToCloudinary(
                buffer,
                originalname,
                mimetype
            );

            mediaUrl = cloudinaryResult.url;
            mediaType = isImage ? 'image' : 'video';
            mediaData = {
                mediaUrl: cloudinaryResult.url,
                storageType: 'cloudinary',
                mediaType: mediaType,
                cloudinaryId: cloudinaryResult.publicId,
                format: cloudinaryResult.format,
                size: cloudinaryResult.size,
                dimensions: {
                    width: cloudinaryResult.width,
                    height: cloudinaryResult.height
                },
                ...(cloudinaryResult.duration && {
                    duration: cloudinaryResult.duration
                })
            };

            console.log(`✅ Cloudinary upload successful: ${cloudinaryResult.publicId}`);
        }
        else if (storageType === 'gridfs') {
            console.log(`📤 Uploading to GridFS: ${originalname} (${(size / 1024 / 1024).toFixed(2)}MB)`);

            const gridfsResult = await hybridMediaService.uploadToGridFS(
                buffer,
                originalname,
                mimetype
            );

            mediaUrl = `/api/v1/media/stream/${gridfsResult.fileId}`;
            mediaType = 'video';
            mediaData = {
                mediaUrl: mediaUrl,
                storageType: 'gridfs',
                mediaType: mediaType,
                gridfsId: gridfsResult.fileId,
                fileName: gridfsResult.fileName,
                size: gridfsResult.size,
                contentType: gridfsResult.contentType
            };

            console.log(`✅ GridFS upload successful: ${gridfsResult.fileId}`);
        }

        // Return success response
        return ApiResponse.success(
            res,
            mediaData,
            'Media uploaded successfully',
            201
        );

    } catch (error) {
        console.error('Media upload error:', error);

        // Pass error to global error handler
        throw new ApiError(
            error.message || 'Media upload failed',
            error.statusCode || 500
        );
    }
});

/**
 * @route   GET /api/v1/media/stream/:fileId
 * @desc    Stream video from GridFS
 * @access  Public
 */
exports.streamVideo = asyncHandler(async (req, res, next) => {
    const { fileId } = req.params;

    if (!fileId) {
        throw new ApiError('File ID is required', 400);
    }

    try {
        // Get file metadata
        const metadata = await hybridMediaService.getGridFSMetadata(fileId);

        // Set response headers
        res.set({
            'Content-Type': metadata.contentType || 'video/mp4',
            'Content-Length': metadata.length,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000'
        });

        // Handle range requests for video seeking
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : metadata.length - 1;
            const chunksize = (end - start) + 1;

            res.status(206); // Partial Content
            res.set({
                'Content-Range': `bytes ${start}-${end}/${metadata.length}`,
                'Content-Length': chunksize
            });
        }

        // Stream the file
        const downloadStream = hybridMediaService.getGridFSStream(fileId);

        downloadStream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                throw new ApiError('Failed to stream video', 500);
            }
        });

        downloadStream.pipe(res);

    } catch (error) {
        console.error('Video streaming error:', error);
        throw new ApiError(
            error.message || 'Failed to stream video',
            error.statusCode || 500
        );
    }
});

/**
 * @route   DELETE /api/v1/media/:storageType/:id
 * @desc    Delete media from storage
 * @access  Private (Admin/Owner)
 */
exports.deleteMedia = asyncHandler(async (req, res, next) => {
    const { storageType, id } = req.params;

    if (!['cloudinary', 'gridfs'].includes(storageType)) {
        throw new ApiError('Invalid storage type', 400);
    }

    try {
        if (storageType === 'cloudinary') {
            // Determine resource type from publicId
            const resourceType = id.includes('/videos/') ? 'video' : 'image';
            await hybridMediaService.deleteFromCloudinary(id, resourceType);
        } else {
            await hybridMediaService.deleteFromGridFS(id);
        }

        return ApiResponse.success(
            res,
            null,
            'Media deleted successfully',
            200
        );
    } catch (error) {
        console.error('Media deletion error:', error);
        throw new ApiError(
            error.message || 'Failed to delete media',
            error.statusCode || 500
        );
    }
});