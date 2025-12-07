// ============================================
// services/gridfsService.js
// ============================================
const { getGridFSBucket } = require('../config/gridfs');
const { Readable } = require('stream');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

class GridFSService {
    async uploadVideo(fileBuffer, filename, metadata = {}) {
        const bucket = getGridFSBucket();

        return new Promise((resolve, reject) => {
            const readableStream = Readable.from(fileBuffer);
            const uploadStream = bucket.openUploadStream(filename, {
                metadata: {
                    ...metadata,
                    uploadDate: new Date()
                }
            });

            readableStream.pipe(uploadStream);

            uploadStream.on('finish', () => {
                resolve({
                    gridfsId: uploadStream.id,
                    filename: filename
                });
            });

            uploadStream.on('error', (error) => {
                reject(new ApiError('Video upload to GridFS failed', 500));
            });
        });
    }

    async getVideoStream(fileId) {
        const bucket = getGridFSBucket();

        try {
            const objectId = new mongoose.Types.ObjectId(fileId);
            return bucket.openDownloadStream(objectId);
        } catch (error) {
            throw new ApiError('Video not found', 404);
        }
    }

    async deleteVideo(fileId) {
        const bucket = getGridFSBucket();

        try {
            const objectId = new mongoose.Types.ObjectId(fileId);
            await bucket.delete(objectId);
            return true;
        } catch (error) {
            throw new ApiError('Failed to delete video', 500);
        }
    }

    async getVideoMetadata(fileId) {
        const bucket = getGridFSBucket();

        try {
            const objectId = new mongoose.Types.ObjectId(fileId);
            const files = await bucket.find({ _id: objectId }).toArray();

            if (files.length === 0) {
                throw new ApiError('Video not found', 404);
            }

            return files[0];
        } catch (error) {
            throw new ApiError('Failed to get video metadata', 500);
        }
    }
}

module.exports = new GridFSService();