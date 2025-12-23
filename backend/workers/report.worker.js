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
            // Perform AI analysis
            const aiAnalysis = await aiService.analyzeReportText(title, description);

            // Update report with AI results
            const report = await Report.findByIdAndUpdate(
                reportId,
                {
                    category: aiAnalysis.category,
                    priority: aiAnalysis.priority,
                    title: aiAnalysis.title,
                    description: aiAnalysis.description,
                    aiReasoning: aiAnalysis.reasoning,
                    aiProcessedAt: new Date(),
                },
                { new: true }
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

// Event listeners for monitoring
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