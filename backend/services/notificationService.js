// ============================================
// services/notificationService.js (MERGED - Email + Socket.IO + In-App)
// ============================================
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
require('dotenv').config();

// Socket.IO will be initialized later
let io = null;

class NotificationService {
    constructor() {
        console.log('🔍 Email Config Check:');
        console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME ? '✅ Set' : '❌ Missing');
        console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
        console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'gmail (default)');

        // Configure email transporter
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    /**
     * Set Socket.IO instance (called from server.js)
     */
    setSocketIO(socketIO) {
        io = socketIO;
        console.log('✅ Socket.IO attached to NotificationService');
    }

    /**
     * Get Socket.IO instance
     */
    getIO() {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized yet');
        }
        return io;
    }

    // ============================================
    // CORE NOTIFICATION METHODS (NEW)
    // ============================================

    /**
     * Create and emit notification (in-app + real-time)
     */
    async createNotification(data) {
        try {
            const notification = await Notification.create({
                recipient: data.recipientId,
                type: data.type,
                title: data.title,
                message: data.message,
                data: data.data || {},
                priority: data.priority || 'normal',
            });

            await notification.populate('recipient', 'name email');

            // Emit via Socket.IO if available
            this.emitToUser(data.recipientId, 'notification', notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Send report created notification
     */
    async sendReportCreatedNotification(userId, reportData) {
        return this.createNotification({
            recipientId: userId,
            type: 'report_created',
            title: 'Report Created Successfully',
            message: `Your report "${reportData.title}" has been submitted and is being processed.`,
            data: {
                reportId: reportData.reportId,
                status: reportData.status,
            },
            priority: 'normal',
        });
    }

    /**
     * Send report assigned notification (to official)
     */
    async sendAssignmentNotification(officialId, reportData) {
        return this.createNotification({
            recipientId: officialId,
            type: 'report_assigned',
            title: 'New Report Assigned',
            message: `You have been assigned a ${reportData.priority} priority report: "${reportData.reportTitle}"`,
            data: {
                reportId: reportData.reportId,
                priority: reportData.priority,
                category: reportData.category,
            },
            priority: reportData.priority === 'urgent' ? 'high' : 'normal',
        });
    }

    /**
     * Send status update notification (to reporter)
     */
    async sendStatusUpdateNotification(userId, reportData) {
        const statusMessages = {
            pending: 'Your report is pending review',
            in_progress: 'Work has started on your report',
            resolved: 'Your report has been resolved',
            rejected: 'Your report has been reviewed',
        };

        return this.createNotification({
            recipientId: userId,
            type: 'status_updated',
            title: 'Report Status Updated',
            message: `"${reportData.reportTitle}": ${statusMessages[reportData.newStatus]}`,
            data: {
                reportId: reportData.reportId,
                oldStatus: reportData.oldStatus,
                newStatus: reportData.newStatus,
            },
            priority: 'normal',
        });
    }

    /**
     * Send AI analysis completed notification
     */
    async sendAIAnalysisCompleted(userId, reportData) {
        return this.createNotification({
            recipientId: userId,
            type: 'ai_analysis_completed',
            title: 'AI Analysis Complete',
            message: `AI analysis completed for "${reportData.reportTitle}". Category: ${reportData.category}, Priority: ${reportData.priority}`,
            data: {
                reportId: reportData.reportId,
                category: reportData.category,
                priority: reportData.priority,
            },
            priority: 'low',
        });
    }

    // ============================================
    // EXISTING EMAIL NOTIFICATION METHODS
    // ============================================

    /**
     * Notify reporter that official claims issue is resolved
     * Start 2-day verification countdown
     */
    async notifyResolutionClaimed(reportId) {
        try {
            const report = await Report.findById(reportId)
                .populate('reportedBy', 'name email')
                .populate('assignedTo', 'name officialDetails');

            if (!report) return;

            const verificationDeadline = new Date();
            verificationDeadline.setDate(verificationDeadline.getDate() + 2); // 2 days

            // Update report
            report.resolutionDetails.verificationDeadline = verificationDeadline;
            report.resolutionDetails.verificationStatus = 'pending_verification';

            // Add notification to report (legacy)
            report.notifications.push({
                type: 'resolution_request',
                sentAt: new Date(),
                sentTo: report.reportedBy._id
            });

            await report.save();

            // Create in-app notification (NEW)
            await this.createNotification({
                recipientId: report.reportedBy._id,
                type: 'status_updated',
                title: '✅ Your Report Has Been Resolved',
                message: `Please verify the resolution of "${report.title}" within 2 days.`,
                data: {
                    reportId: report._id,
                    status: 'resolved',
                    verificationDeadline: verificationDeadline,
                },
                priority: 'high',
            });

            // Send email
            const emailSent = await this.sendEmail({
                to: report.reportedBy.email,
                subject: '✅ Your Report Has Been Resolved - Please Verify',
                html: this.getResolutionEmailTemplate(report)
            });

            console.log(`📧 Resolution notification sent to ${report.reportedBy.email}`);

            return { success: true, emailSent };
        } catch (error) {
            console.error('Failed to send resolution notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send reminder if reporter hasn't responded
     */
    async sendVerificationReminder(reportId) {
        try {
            const report = await Report.findById(reportId)
                .populate('reportedBy', 'name email');

            if (!report || report.resolutionDetails.verificationStatus !== 'pending_verification') {
                return;
            }

            const hoursLeft = Math.round(
                (report.resolutionDetails.verificationDeadline - new Date()) / (1000 * 60 * 60)
            );

            if (hoursLeft <= 24 && hoursLeft > 0) {
                // Create in-app notification (NEW)
                await this.createNotification({
                    recipientId: report.reportedBy._id,
                    type: 'status_updated',
                    title: '⏰ Reminder: Verify Your Report',
                    message: `You have ${hoursLeft} hours left to verify "${report.title}"`,
                    data: {
                        reportId: report._id,
                        hoursLeft,
                    },
                    priority: 'normal',
                });

                // Send reminder email
                await this.sendEmail({
                    to: report.reportedBy.email,
                    subject: '⏰ Reminder: Verify Your Resolved Report',
                    html: this.getReminderEmailTemplate(report, hoursLeft)
                });

                // Add notification to report (legacy)
                report.notifications.push({
                    type: 'verification_reminder',
                    sentAt: new Date(),
                    sentTo: report.reportedBy._id
                });

                await report.save();

                console.log(`⏰ Reminder sent to ${report.reportedBy.email} (${hoursLeft}h left)`);
            }
        } catch (error) {
            console.error('Failed to send reminder:', error);
        }
    }

    /**
     * Auto-verify reports after 2 days
     */
    async autoVerifyExpiredReports() {
        try {
            const now = new Date();

            const expiredReports = await Report.find({
                'resolutionDetails.verificationStatus': 'pending_verification',
                'resolutionDetails.verificationDeadline': { $lte: now }
            }).populate('reportedBy', 'name email');

            console.log(`🤖 Auto-verifying ${expiredReports.length} expired reports...`);

            for (const report of expiredReports) {
                report.status = 'Solved';
                report.resolutionDetails.verificationStatus = 'auto_verified';
                report.resolutionDetails.verifiedAt = new Date();
                report.resolutionDetails.verificationComment = 'Auto-verified: No response from reporter within 2 days';

                await report.save();

                // Send in-app notification (NEW)
                await this.createNotification({
                    recipientId: report.reportedBy._id,
                    type: 'status_updated',
                    title: 'Report Auto-Verified',
                    message: `"${report.title}" has been automatically verified as resolved.`,
                    data: {
                        reportId: report._id,
                        status: 'Solved',
                        autoVerified: true,
                    },
                    priority: 'normal',
                });

                // Update official's metrics
                if (report.official_tenure_id) {
                    const OfficialTenure = require('../models/OfficialTenure');
                    const tenure = await OfficialTenure.findById(report.official_tenure_id);
                    if (tenure) {
                        await tenure.updateMetrics();
                    }
                }

                console.log(`✅ Auto-verified report ${report._id}`);
            }

            return expiredReports.length;
        } catch (error) {
            console.error('Auto-verification failed:', error);
            return 0;
        }
    }

    // ============================================
    // SOCKET.IO REAL-TIME METHODS
    // ============================================

    /**
     * Emit notification to specific user
     */
    emitToUser(userId, event, data) {
        try {
            if (io) {
                io.to(`user:${userId}`).emit(event, data);
                console.log(`📤 Emitted ${event} to user:${userId}`);
            }
        } catch (error) {
            console.error('Error emitting to user:', error);
        }
    }

    /**
     * Emit notification to specific role
     */
    emitToRole(role, event, data) {
        try {
            if (io) {
                io.to(`role:${role}`).emit(event, data);
                console.log(`📤 Emitted ${event} to role:${role}`);
            }
        } catch (error) {
            console.error('Error emitting to role:', error);
        }
    }

    /**
     * Emit report update to all watching that report
     */
    emitReportUpdate(reportId, data) {
        try {
            if (io) {
                io.to(`report:${reportId}`).emit('report-updated', data);
                console.log(`📤 Emitted report-updated to report:${reportId}`);
            }
        } catch (error) {
            console.error('Error emitting report update:', error);
        }
    }

    // ============================================
    // NOTIFICATION MANAGEMENT
    // ============================================

    /**
     * Get user's unread notifications
     */
    async getUnreadNotifications(userId) {
        return Notification.find({
            recipient: userId,
            read: false,
        })
            .sort({ createdAt: -1 })
            .limit(20);
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: userId },
            { read: true, readAt: new Date() },
            { new: true }
        );

        if (notification) {
            this.emitToUser(userId, 'notification-read', { notificationId });
        }

        return notification;
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId) {
        await Notification.updateMany(
            { recipient: userId, read: false },
            { read: true, readAt: new Date() }
        );

        this.emitToUser(userId, 'notifications-cleared', {});
    }

    // ============================================
    // EMAIL METHODS
    // ============================================

    /**
     * Send email helper
     */
    async sendEmail({ to, subject, html }) {
        try {
            await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@civictrack.com',
                to,
                subject,
                html
            });
            return true;
        } catch (error) {
            console.error('Email send failed:', error);
            return false;
        }
    }

    /**
     * Email templates
     */
    getResolutionEmailTemplate(report) {
        const verifyUrl = `${process.env.CLIENT_URL}/reports/${report._id}/verify`;

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .button.reject { background: #ef4444; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Report Resolved!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${report.reportedBy.name}</strong>,</p>
            
            <p>Great news! The official has marked your report as <strong>resolved</strong>.</p>
            
            <div class="info-box">
              <strong>Report:</strong> ${report.title}<br>
              <strong>Category:</strong> ${report.category.replace(/_/g, ' ')}<br>
              <strong>Resolved by:</strong> ${report.assignedTo?.name || 'Official'}<br>
              <strong>Resolution:</strong> ${report.resolutionDetails.description || 'Issue has been fixed'}
            </div>
            
            <p><strong>⏰ Please verify within 2 days</strong></p>
            <p>We need your confirmation that the issue is actually resolved. Please click one of the buttons below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}?action=verify" class="button">✅ Yes, Issue is Resolved</a>
              <a href="${verifyUrl}?action=reject" class="button reject">❌ No, Still Not Fixed</a>
            </div>
            
            <p style="background: #fef3c7; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <strong>⚠️ Important:</strong> If we don't hear from you within 2 days, the report will be automatically marked as resolved.
            </p>
            
            <p>Thank you for helping keep our community better!</p>
          </div>
          <div class="footer">
            <p>© CivicTrack - Building Better Communities</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    }

    getReminderEmailTemplate(report, hoursLeft) {
        const verifyUrl = `${process.env.CLIENT_URL}/reports/${report._id}/verify`;

        return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">⏰ Reminder: ${hoursLeft} Hours Left to Verify</h2>
          
          <p>Hello ${report.reportedBy.name},</p>
          
          <p>This is a friendly reminder that you have <strong>${hoursLeft} hours left</strong> to verify the resolution of your report:</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <strong>${report.title}</strong>
          </div>
          
          <p>Please click below to verify:</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">
              Verify Now
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 12px;">If you don't respond, the report will be automatically marked as resolved.</p>
        </div>
      </body>
      </html>
    `;
    }
}

module.exports = new NotificationService();