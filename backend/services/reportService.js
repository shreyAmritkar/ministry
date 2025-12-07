// ============================================
// services/reportService.js
// ============================================
const Report = require('../models/Report');
const OfficialTenure = require('../models/OfficialTenure');
const ApiError = require('../utils/ApiError');

class ReportService {
    async createReport(reportData, userId) {
        // Find current official for the ward
        const currentOfficial = await OfficialTenure.findCurrentOfficialForWard(
            reportData.address.ward
        );

        if (currentOfficial) {
            reportData.official_tenure_id = currentOfficial._id;
            reportData.assignedTo = currentOfficial.official;
        }

        reportData.reportedBy = userId;

        const report = await Report.create(reportData);

        // Update tenure metrics
        if (currentOfficial) {
            await currentOfficial.updateMetrics();
        }

        return report;
    }

    async getReportsNearby(longitude, latitude, maxDistance = 5000, filters = {}) {
        const query = Report.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: maxDistance
                }
            }
        });

        // Apply additional filters
        if (filters.status) query.where('status').equals(filters.status);
        if (filters.category) query.where('category').equals(filters.category);
        if (filters.priority) query.where('priority').equals(filters.priority);

        const reports = await query
            .populate('reportedBy', 'name email')
            .populate('assignedTo', 'name officialDetails')
            .populate('official_tenure_id', 'position ward')
            .sort({ createdAt: -1 })
            .limit(50);

        return reports;
    }

    async updateReportStatus(reportId, newStatus, userId, comment) {
        const report = await Report.findById(reportId);

        if (!report) {
            throw new ApiError('Report not found', 404);
        }

        await report.updateStatus(newStatus, userId, comment);

        // Update tenure metrics if resolved
        if (newStatus === 'Solved' && report.official_tenure_id) {
            const tenure = await OfficialTenure.findById(report.official_tenure_id);
            if (tenure) await tenure.updateMetrics();
        }

        return report;
    }

    async assignReportToOfficial(reportId, officialId) {
        const report = await Report.findById(reportId);

        if (!report) {
            throw new ApiError('Report not found', 404);
        }

        report.assignedTo = officialId;
        await report.save();

        return report;
    }
}

module.exports = new ReportService();