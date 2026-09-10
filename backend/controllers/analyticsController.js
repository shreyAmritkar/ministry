// ============================================
// controllers/analyticsController.js
// Analytics & Statistics Controller
// ============================================
const Report = require('../models/Report');
const User = require('../models/User');
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/ApiResponse");

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get dashboard statistics
 * @access  Public
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
    const totalReports = await Report.count();

    const statusCounts = await Report.countAllByStatus();

    const activeOfficials = await User.count({ userType: 'official', isActive: true });

    const categoryBreakdown = await Report.countAllByCategory();

    const recentReportsRaw = await Report.findAll({}, { limit: 5, offset: 0 });
    const recentReports = [];
    for (const r of recentReportsRaw) {
        await Report.populateUsers(r, 'name');
        recentReports.push({
            title: r.title, status: r.status, category: r.category,
            createdAt: r.createdAt, reportedBy: r.reportedBy,
        });
    }

    const solvedReports = statusCounts.find(s => s._id === 'Solved')?.count || 0;
    const resolutionRate = totalReports > 0
        ? Math.round((solvedReports / totalReports) * 100)
        : 0;

    return success(
        res,
        {
            totalReports,
            solvedReports,
            activeOfficials,
            resolutionRate,
            statusBreakdown: statusCounts,
            categoryBreakdown,
            recentReports
        },
        'Dashboard statistics retrieved successfully'
    );
});
