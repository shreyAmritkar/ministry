// ============================================
// controllers/analyticsController.js
// Analytics & Statistics Controller
// ============================================
const Report = require('../models/Report');
const User = require('../models/User');
const asyncHandler = require("../utils/asyncHandler");
const {success} = require("../utils/ApiResponse");


/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get dashboard statistics
 * @access  Public
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
    // Total reports
    const totalReports = await Report.countDocuments();

    // Reports by status
    const statusCounts = await Report.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    // Active officials
    const activeOfficials = await User.countDocuments({
        userType: 'official',
        isActive: true
    });

    // Reports by category
    const categoryBreakdown = await Report.aggregate([
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Recent reports
    const recentReports = await Report.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('reportedBy', 'name')
        .select('title status category createdAt');

    // Calculate resolution rate
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