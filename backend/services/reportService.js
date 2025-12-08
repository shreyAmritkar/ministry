// ============================================
// services/reportService.js
// Report Management Service Layer (MODIFIED FOR CITY-LEVEL)
// ============================================
const Report = require('../models/Report');
const OfficialTenure = require('../models/OfficialTenure');
const ApiError = require('../utils/ApiError');

class ReportService {
    /**
     * Creates a new report and updates the official's metrics.
     * Assumes reportData already contains official_tenure_id if one was found by the controller.
     */
    async createReport(reportData, userId) {

        reportData.reportedBy = userId;

        // Use a transaction if required for atomicity, but for now, rely on standard save.
        const report = await Report.create(reportData);

        // Update tenure metrics ONLY if an official was assigned successfully
        if (reportData.official_tenure_id) {
            const tenure = await OfficialTenure.findById(reportData.official_tenure_id);
            if (tenure) {
                await tenure.updateMetrics();
            }
        }

        // Return the full report object
        return report;
    }

    /**
     * Fetches reports near a specific coordinate using MongoDB's $near operator.
     */
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
            .populate('official_tenure_id', 'position city') // CHANGED: 'ward' to 'city'
            .sort({ createdAt: -1 })
            .limit(50);

        return reports;
    }

    /**
     * Updates the status of a report and handles metric updates for resolved reports.
     */
    async updateReportStatus(reportId, newStatus, userId, comment) {
        const report = await Report.findById(reportId);

        if (!report) {
            throw new ApiError('Report not found', 404);
        }

        // Use the method defined on the Report model
        await report.updateStatus(newStatus, userId, comment);

        // Update tenure metrics if resolved and an official was assigned
        if (newStatus === 'Solved' && report.official_tenure_id) {
            const tenure = await OfficialTenure.findById(report.official_tenure_id);
            if (tenure) {
                await tenure.updateMetrics();
            }
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

        // Find the CURRENT active tenure for this official to ensure accountability metrics track correctly
        // Assuming the 'User' model has a 'officialDetails.city' field that ties to the OfficialTenure model
        const userOfficial = await User.findById(officialId);
        if (!userOfficial || !userOfficial.officialDetails || !userOfficial.officialDetails.city) {
            throw new ApiError('Official details (city) missing for assignment.', 400);
        }

        const city = userOfficial.officialDetails.city;

        // Use the static method to find the current tenure
        const currentTenure = await OfficialTenure.findCurrentOfficialForCity(city);

        if (!currentTenure) {
            throw new ApiError(`No active tenure found for official in ${city}.`, 404);
        }

        // Assign both the User ID and the active Tenure ID
        report.assignedTo = officialId;
        report.official_tenure_id = currentTenure._id;

        await report.save();

        return report;
    }
}

module.exports = new ReportService();