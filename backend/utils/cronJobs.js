// ============================================
// utils/cronJobs.js (NEW)
// Schedule Auto-verification & Reminders
// ============================================
const cron = require('node-cron');
const notificationService = require('../services/notificationService');

class CronJobs {
    static init() {
        console.log('⏰ Starting cron jobs...');

        // Run every hour - check for reminders & auto-verification
        cron.schedule('0 * * * *', async () => {
            console.log('🔄 Running hourly verification checks...');

            try {
                // Send reminders (24h before deadline)
                const Report = require('../models/Report');
                const reports = await Report.find({
                    'resolutionDetails.verificationStatus': 'pending_verification'
                });

                for (const report of reports) {
                    await notificationService.sendVerificationReminder(report._id);
                }

                // Auto-verify expired reports
                const autoVerifiedCount = await notificationService.autoVerifyExpiredReports();

                if (autoVerifiedCount > 0) {
                    console.log(`✅ Auto-verified ${autoVerifiedCount} reports`);
                }
            } catch (error) {
                console.error('Cron job error:', error);
            }
        });

        console.log('✅ Cron jobs initialized');
    }
}

module.exports = CronJobs;