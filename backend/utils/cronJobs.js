// ============================================
// utils/cronJobs.js
// Schedule Auto-verification & Reminders
// ============================================
const cron = require('node-cron');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const RefreshToken = require('../models/RefreshToken');

class CronJobs {
    static init() {
        console.log('⏰ Starting cron jobs...');

        // Run every hour - check for reminders & auto-verification
        cron.schedule('0 * * * *', async () => {
            console.log('🔄 Running hourly verification checks...');

            try {
                const Report = require('../models/Report');
                const reports = await Report.findPendingVerification();

                for (const report of reports) {
                    await notificationService.sendVerificationReminder(report._id);
                }

                const autoVerifiedCount = await notificationService.autoVerifyExpiredReports();

                if (autoVerifiedCount > 0) {
                    console.log(`✅ Auto-verified ${autoVerifiedCount} reports`);
                }
            } catch (error) {
                console.error('Cron job error:', error);
            }
        });

        // Run once a day - replaces Mongo's `expireAfterSeconds` TTL index,
        // which has no direct Postgres equivalent.
        cron.schedule('30 2 * * *', async () => {
            try {
                const deleted = await Notification.deleteOlderThan30Days();
                if (deleted > 0) {
                    console.log(`🗑️  Purged ${deleted} notifications older than 30 days`);
                }
            } catch (error) {
                console.error('Notification purge cron error:', error);
            }

            try {
                // Housekeeping only — revoked/expired rows are never
                // treated as valid regardless of whether this has run.
                const purged = await RefreshToken.deleteExpired();
                if (purged > 0) {
                    console.log(`🗑️  Purged ${purged} expired refresh tokens`);
                }
            } catch (error) {
                console.error('Refresh token purge cron error:', error);
            }
        });

        console.log('✅ Cron jobs initialized');
    }
}

module.exports = CronJobs;
