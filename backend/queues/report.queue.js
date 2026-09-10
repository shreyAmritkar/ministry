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
 * Add AI analysis job to queue.
 *
 * IMPORTANT: `Queue#add()` on a BullMQ Queue constructed with
 * `connection: null` (i.e. REDIS_URL was never set) doesn't throw or
 * reject — it just hangs forever, waiting for a connection that will
 * never come. reportController wraps this call in try/catch expecting
 * a *rejected* promise on failure, which never happens; without this
 * guard, creating a report with no Redis configured hangs the entire
 * request indefinitely instead of degrading gracefully.
 */
async function queueAIAnalysis(reportId, title, description) {
    if (!redisConnection) {
        console.warn('⚠️  Skipping AI analysis queue — Redis is not configured.');
        return null;
    }
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
 * Add notification job to queue. Same "hangs forever, not rejects"
 * hazard as queueAIAnalysis above without this guard.
 */
async function queueNotification(type, recipientId, data) {
    if (!redisConnection) {
        console.warn('⚠️  Skipping notification queue — Redis is not configured.');
        return null;
    }
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
