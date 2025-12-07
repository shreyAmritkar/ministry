// ============================================
// services/hybridMediaService.js
// Core Media Upload Logic
// ============================================
const cloudinary = require('../config/cloudinary');
const { getGridFSBucket } = require('../config/gridfs');
const { Readable } = require('stream');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

class HybridMediaService {
    /**
     * Determine storage type based on file size and type
     */
    determineStorageType(fileSize, mimeType) {
        const isImage = mimeType.startsWith('image/');
        const isVideo = mimeType.startsWith('video/');
        const SIZE_THRESHOLD = 10 * 1024 * 1024; // 10MB

        if (isImage) {
            return 'cloudinary';
        }

        if (isVideo) {
            if (fileSize < SIZE_THRESHOLD) {
                return 'cloudinary';
            } else {
                return 'gridfs';
            }
        }

        throw new ApiError('Unsupported file type', 400);
    }

    /**
     * Upload to Cloudinary (Images & Videos < 10MB)
     */
    async uploadToCloudinary(fileBuffer, fileName, mimeType) {
        const isImage = mimeType.startsWith('image/');
        const resourceType = isImage ? 'image' : 'video';

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `civictrack/${resourceType}s`,
                    resource_type: resourceType,
                    public_id: `${Date.now()}_${fileName.split('.')[0]}`,
                    ...(isImage && {
                        transformation: [
                            { width: 1920, height: 1080, crop: 'limit' },
                            { quality: 'auto:good', fetch_format: 'auto' }
                        ]
                    }),
                    ...(resourceType === 'video' && {
                        chunk_size: 6000000, // 6MB chunks
                        eager: [
                            { width: 640, height: 480, crop: 'pad', format: 'mp4' }
                        ]
                    })
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        return reject(new ApiError(
                            `Cloudinary upload failed: ${error.message}`,
                            500
                        ));
                    }

                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        format: result.format,
                        size: result.bytes,
                        width: result.width,
                        height: result.height,
                        ...(result.duration && { duration: result.duration })
                    });
                }
            );

            // Convert buffer to stream and pipe
            const readableStream = Readable.from(fileBuffer);
            readableStream.pipe(uploadStream);
        });
    }

    /**
     * Upload to GridFS (Videos > 10MB)
     */
    async uploadToGridFS(fileBuffer, fileName, mimeType) {
        try {
            const bucket = getGridFSBucket();

            return new Promise((resolve, reject) => {
                const readableStream = Readable.from(fileBuffer);

                const uploadStream = bucket.openUploadStream(fileName, {
                    contentType: mimeType,
                    metadata: {
                        originalName: fileName,
                        mimeType: mimeType,
                        uploadDate: new Date(),
                        size: fileBuffer.length
                    }
                });

                // Pipe the buffer stream to GridFS
                readableStream.pipe(uploadStream);

                uploadStream.on('finish', () => {
                    resolve({
                        fileId: uploadStream.id.toString(),
                        fileName: fileName,
                        size: fileBuffer.length,
                        contentType: mimeType
                    });
                });

                uploadStream.on('error', (error) => {
                    console.error('GridFS upload error:', error);
                    reject(new ApiError(
                        `GridFS upload failed: ${error.message}`,
                        500
                    ));
                });
            });
        } catch (error) {
            console.error('GridFS initialization error:', error);
            throw new ApiError('Failed to initialize GridFS storage', 500);
        }
    }

    /**
     * Delete from Cloudinary
     */
    async deleteFromCloudinary(publicId, resourceType = 'image') {
        try {
            await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType
            });
            return true;
        } catch (error) {
            console.error('Cloudinary deletion error:', error);
            throw new ApiError('Failed to delete from Cloudinary', 500);
        }
    }

    /**
     * Delete from GridFS
     */
    async deleteFromGridFS(fileId) {
        try {
            const bucket = getGridFSBucket();
            const objectId = new mongoose.Types.ObjectId(fileId);
            await bucket.delete(objectId);
            return true;
        } catch (error) {
            console.error('GridFS deletion error:', error);
            throw new ApiError('Failed to delete from GridFS', 500);
        }
    }

    /**
     * Get video stream from GridFS
     */
    getGridFSStream(fileId) {
        try {
            const bucket = getGridFSBucket();
            const objectId = new mongoose.Types.ObjectId(fileId);
            return bucket.openDownloadStream(objectId);
        } catch (error) {
            console.error('GridFS stream error:', error);
            throw new ApiError('Failed to retrieve video stream', 404);
        }
    }

    /**
     * Get GridFS file metadata
     */
    async getGridFSMetadata(fileId) {
        try {
            const bucket = getGridFSBucket();
            const objectId = new mongoose.Types.ObjectId(fileId);
            const files = await bucket.find({ _id: objectId }).toArray();

            if (files.length === 0) {
                throw new ApiError('File not found', 404);
            }

            return files[0];
        } catch (error) {
            throw new ApiError('Failed to retrieve file metadata', 500);
        }
    }
}

module.exports = new HybridMediaService();