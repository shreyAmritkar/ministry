// ============================================
// workers/media.worker.js
// ============================================
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/queue.config');
const hybridMediaService = require('../services/hybridMediaService');
const Report = require('../models/Report');

const mediaProcessingWorker = new Worker(
    'media-processing',
    async (job) => {
        const { reportId, buffer, originalname, mimetype } = job.data;

        console.log(`📤 Processing media upload for report: ${reportId}`);

        try {
            const size = buffer.length;
            const storageType = hybridMediaService.determineStorageType(size, mimetype);

            let mediaData;

            if (storageType === 'cloudinary') {
                const cloudinaryResult = await hybridMediaService.uploadToCloudinary(
                    buffer,
                    originalname,
                    mimetype
                );

                mediaData = {
                    mediaUrl: cloudinaryResult.url,
                    storageType: 'cloudinary',
                    mediaType: mimetype.startsWith('image/') ? 'image' : 'video',
                    cloudinaryId: cloudinaryResult.publicId,
                };
            } else {
                const gridfsResult = await hybridMediaService.uploadToGridFS(
                    buffer,
                    originalname,
                    mimetype
                );

                mediaData = {
                    mediaUrl: `/api/v1/media/stream/${gridfsResult.fileId}`,
                    storageType: 'gridfs',
                    mediaType: 'video',
                    gridfsId: gridfsResult.fileId,
                };
            }

            await Report.findByIdAndUpdate(reportId, mediaData);

            console.log(`✅ Media processed for report: ${reportId}`);

            return { success: true, reportId, mediaData };
        } catch (error) {
            console.error(`❌ Media processing failed for report ${reportId}:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 3,
    }
);

module.exports = mediaProcessingWorker;