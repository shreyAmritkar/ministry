// ============================================
// queues/report.queue.js
// ============================================
const { Queue } = require('bullmq');
const { redisConnection, defaultJobOptions } = require('../config/queue.config');

// Create queues for different tasks
const reportQueue = new Queue('report-processing', {
    connection: redisConnection,
    defaultJobOptions,
});

const mediaQueue = new Queue('media-processing', {
    connection: redisConnection,
    defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 2, // Media uploads are more expensive, fewer retries
    },
});

const notificationQueue = new Queue('notifications', {
    connection: redisConnection,
    defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 5, // Notifications should retry more
    },
});

// ============================================
// Queue Job Handlers
// ============================================

/**
 * Add AI analysis job to queue
 */
async function queueAIAnalysis(reportId, title, description) {
    return await reportQueue.add(
        'ai-analysis',
        {
            reportId,
            title,
            description,
        },
        {
            priority: 1, // High priority
        }
    );
}

/**
 * Add media processing job to queue
 */
async function queueMediaProcessing(reportId, mediaFile, mediaType) {
    return await mediaQueue.add(
        'process-media',
        {
            reportId,
            mediaFile,
            mediaType,
        },
        {
            priority: 2,
        }
    );
}

/**
 * Add notification job to queue
 */
async function queueNotification(type, recipientId, data) {
    return await notificationQueue.add(
        'send-notification',
        {
            type,
            recipientId,
            data,
        },
        {
            priority: 3,
        }
    );
}

/**
 * Add assignment notification job
 */
async function queueAssignmentNotification(reportId, officialId, reportData) {
    return await notificationQueue.add(
        'assignment-notification',
        {
            reportId,
            officialId,
            reportData,
        },
        {
            priority: 2,
            delay: 2000, // Delay 2 seconds to ensure report is saved
        }
    );
}

module.exports = {
    reportQueue,
    mediaQueue,
    notificationQueue,
    queueAIAnalysis,
    queueMediaProcessing,
    queueNotification,
    queueAssignmentNotification,
};
