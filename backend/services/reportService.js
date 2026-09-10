// ============================================
// services/reportService.js
// Report Management Service Layer
// ============================================
const Report = require('../models/Report');
const OfficialTenure = require('../models/OfficialTenure');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

class ReportService {
    /**
     * Creates a new report and updates the official's tenure metrics.
     * Assumes reportData already contains official_tenure_id if one was found by the controller.
     */
    async createReport(reportData, userId) {
        reportData.reportedBy = userId;

        const report = await Report.create(reportData);

        if (reportData.official_tenure_id) {
            await OfficialTenure.updateMetrics(reportData.official_tenure_id);
        }

        return report;
    }

    /**
     * Fetches reports near a specific coordinate using PostGIS ST_DWithin.
     */
    async getReportsNearby(longitude, latitude, maxDistance = 5000, filters = {}) {
        const reports = await Report.findNearby(longitude, latitude, maxDistance, filters);

        for (const report of reports) {
            await Report.populateUsers(report, 'name email');
            await Report.populateTenure(report, 'position city');
        }

        return reports;
    }

    /**
     * Updates the status of a report and handles metric updates for resolved reports.
     */
    async updateReportStatus(reportId, newStatus, userId, comment) {
        const existing = await Report.findById(reportId);

        if (!existing) {
            throw new ApiError('Report not found', 404);
        }

        const report = await Report.updateStatus(reportId, newStatus, userId, comment);

        if (newStatus === 'Solved' && report.official_tenure_id) {
            await OfficialTenure.updateMetrics(report.official_tenure_id);
        }

        return report;
    }

    /**
     * Admin function to manually assign a report to a specific official.
     */
    async assignReportToOfficial(reportId, officialId) {
        const report = await Report.findById(reportId);

        if (!report) {
            throw new ApiError('Report not found', 404);
        }

        const userOfficial = await User.findById(officialId);
        if (!userOfficial || !userOfficial.officialDetails || !userOfficial.officialDetails.city) {
            throw new ApiError('Official details (city) missing for assignment.', 400);
        }

        const city = userOfficial.officialDetails.city;

        const currentTenure = await OfficialTenure.findCurrentOfficialForCity(city);

        if (!currentTenure) {
            throw new ApiError(`No active tenure found for official in ${city}.`, 404);
        }

        return Report.assignTo(reportId, officialId, currentTenure._id);
    }
}

module.exports = new ReportService();
