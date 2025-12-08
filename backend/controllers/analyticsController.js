// ============================================
// controllers/analyticsController.js (FIXED - Added Imports)
// Analytics & Statistics Controller
// ============================================
const Report = require('../models/Report');
const OfficialTenure = require('../models/OfficialTenure');
const User = require('../models/User');
const asyncHandler = require("../utils/asyncHandler");
const {success} = require("../utils/ApiResponse");
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');


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

/**
 * @route   GET /api/v1/analytics/ward/:ward/stats
 * @desc    Get ward-specific statistics
 * @access  Public
 */
exports.getWardStatistics = asyncHandler(async (req, res) => {
    const { ward } = req.params;

    const totalReports = await Report.countDocuments({ 'address.ward': ward });

    const statusBreakdown = await Report.aggregate([
        { $match: { 'address.ward': ward } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const categoryBreakdown = await Report.aggregate([
        { $match: { 'address.ward': ward } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Current official
    const currentOfficial = await OfficialTenure.findCurrentOfficialForWard(ward);

    return ApiResponse.success(
        res,
        {
            ward,
            totalReports,
            statusBreakdown,
            categoryBreakdown,
            currentOfficial
        },
        'Ward statistics retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/analytics/official/:officialId/performance
 * @desc    Get official performance metrics
 * @access  Public
 */
exports.getOfficialPerformance = asyncHandler(async (req, res) => {
    const { officialId } = req.params;

    const tenures = await OfficialTenure.find({ official: officialId });
    const tenureIds = tenures.map(t => t._id);

    const totalReports = await Report.countDocuments({
        official_tenure_id: { $in: tenureIds }
    });

    const statusBreakdown = await Report.aggregate([
        { $match: { official_tenure_id: { $in: tenureIds } } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const solvedReports = statusBreakdown.find(s => s._id === 'Solved')?.count || 0;
    const efficiencyScore = totalReports > 0
        ? Math.round((solvedReports / totalReports) * 100)
        : 0;

    return success(
        res,
        {
            totalReports,
            solvedReports,
            efficiencyScore,
            statusBreakdown
        },
        'Official performance retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/analytics/reports/trends
 * @desc    Get report trends over time
 * @access  Public
 */
exports.getReportTrends = asyncHandler(async (req, res) => {
    const { period = '6months' } = req.query;

    let startDate = new Date();
    if (period === '6months') {
        startDate.setMonth(startDate.getMonth() - 6);
    } else if (period === '1year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const trends = await Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                total: { $sum: 1 },
                solved: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0]
                    }
                }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    return success(
        res,
        trends,
        'Report trends retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/analytics/heatmap
 * @desc    Get heatmap data for geographic visualization
 * @access  Public
 */
exports.getHeatmapData = asyncHandler(async (req, res) => {
    const reports = await Report.find()
        .select('location status category')
        .lean();

    const heatmapData = reports.map(report => ({
        latitude: report.location.coordinates[1],
        longitude: report.location.coordinates[0],
        status: report.status,
        category: report.category
    }));

    return success(
        res,
        heatmapData,
        'Heatmap data retrieved successfully'
    );
});