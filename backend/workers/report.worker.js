// ============================================
// workers/report.worker.js
// ============================================
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/queue.config');
const aiService = require('../services/aiService');
const Report = require('../models/Report');

// AI Analysis Worker
const aiAnalysisWorker = new Worker(
    'report-processing',
    async (job) => {
        const { reportId, title, description } = job.data;

        console.log(`🤖 Processing AI analysis for report: ${reportId}`);

        try {
            const aiAnalysis = await aiService.analyzeReportText(title, description);

            const report = await require('../db/pool').query(
                `UPDATE reports SET
                    category = $1, priority = $2, title = $3, description = $4,
                    ai_reasoning = $5, ai_processed_at = now()
                 WHERE id = $6 RETURNING id`,
                [aiAnalysis.category, aiAnalysis.priority, aiAnalysis.title,
                 aiAnalysis.description, aiAnalysis.reasoning, reportId]
            );

            console.log(`✅ AI analysis completed for report: ${reportId}`);

            return {
                success: true,
                reportId,
                aiAnalysis,
            };
        } catch (error) {
            console.error(`❌ AI analysis failed for report ${reportId}:`, error);
            throw error; // Will trigger retry
        }
    },
    {
        connection: redisConnection,
        concurrency: 5,
    }
);

aiAnalysisWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

aiAnalysisWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
});

aiAnalysisWorker.on('error', (err) => {
    console.error('Worker error:', err);
});

module.exports = aiAnalysisWorker;
