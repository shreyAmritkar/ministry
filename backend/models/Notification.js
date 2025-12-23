const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                'report_created',
                'report_assigned',
                'status_updated',
                'ai_analysis_completed',
                'report_commented',
                'report_resolved',
                'report_rejected',
                'system_announcement',
            ],
            required: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        message: {
            type: String,
            required: true,
            maxlength: 500,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        priority: {
            type: String,
            enum: ['low', 'normal', 'high'],
            default: 'normal',
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);