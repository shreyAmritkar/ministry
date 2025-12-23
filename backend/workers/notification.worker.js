// ============================================
// workers/notification.worker.js
// ============================================
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/queue.config');
const notificationService = require('../services/notificationService');

const notificationWorker = new Worker(
    'notifications',
    async (job) => {
        const { type, recipientId, data } = job.data;

        console.log(`📧 Sending ${type} notification to ${recipientId}`);

        try {
            switch (type) {
                case 'report-created':
                    await notificationService.sendReportCreatedNotification(recipientId, data);
                    break;
                case 'report-assigned':
                    await notificationService.sendAssignmentNotification(recipientId, data);
                    break;
                case 'status-updated':
                    await notificationService.sendStatusUpdateNotification(recipientId, data);
                    break;
                default:
                    console.warn(`Unknown notification type: ${type}`);
            }

            console.log(`✅ Notification sent: ${type}`);
            return { success: true, type };
        } catch (error) {
            console.error(`❌ Notification failed:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 10,
    }
);

module.exports = notificationWorker;