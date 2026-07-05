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

module.exports = {
    reportQueue,
    notificationQueue,
    queueAIAnalysis,
    queueNotification,
};
