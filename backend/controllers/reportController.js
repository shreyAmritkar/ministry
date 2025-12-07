// ============================================
// controllers/reportController.js
// Report Management Controller
// ============================================
const Report = require('../models/Report');
const reportService = require('../services/reportService');
const { assignReportToOfficial } = require('../utils/assignmentHelper');
const asyncHandler = require("../utils/asyncHandler");
const {paginated, success} = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const User = require('../models/User');

/**
 * @route   GET /api/v1/reports
 * @desc    Get all reports with filters
 * @access  Public
 */
exports.getAllReports = asyncHandler(async (req, res) => {
    const { status, category, ward, priority, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (ward) query['address.ward'] = ward;
    if (priority) query.priority = priority;

    const reports = await Report.find(query)
        .populate('reportedBy', 'name email')
        .populate('assignedTo', 'name officialDetails')
        .populate('official_tenure_id', 'position ward')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Report.countDocuments(query);

    return paginated(
        res,
        reports,
        {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        },
        'Reports retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/reports/:id
 * @desc    Get single report by ID
 * @access  Public
 */
exports.getReportById = asyncHandler(async (req, res) => {
    const report = await Report.findById(req.params.id)
        .populate('reportedBy', 'name email phone')
        .populate('assignedTo', 'name email phone officialDetails')
        .populate('official_tenure_id', 'position ward department');

    if (!report) {
        throw new ApiError('Report not found', 404);
    }

    // Increment view count
    report.views += 1;
    await report.save();

    return success(
        res,
        report,
        'Report retrieved successfully'
    );
});

/**
 * @route   POST /api/v1/reports
 * @desc    Create new report
 * @access  Private
 */
exports.createReport = asyncHandler(async (req, res) => {
    const reportData = {
        ...req.body,
        reportedBy: req.user._id
    };

    // Extract coordinates
    const [longitude, latitude] = reportData.location.coordinates;

    // Auto-assign to official
    const assignment = await assignReportToOfficial(
        latitude,
        longitude,
        new Date()
    );

    if (assignment.official_id) {
        reportData.assignedTo = assignment.official_id;
        reportData.official_tenure_id = assignment.tenure_id;
        if (assignment.ward) {
            reportData.address.ward = assignment.ward;
        }
    }

    const report = await reportService.createReport(reportData, req.user._id);

    // Populate relations
    await report.populate('assignedTo', 'name officialDetails');

    return success(
        res,
        { report, assignment: assignment.officialDetails },
        'Report created successfully',
        201
    );
});

/**
 * @route   PATCH /api/v1/reports/:id/status
 * @desc    Update report status
 * @access  Private (Official/Admin)
 */
exports.updateReportStatus = asyncHandler(async (req, res) => {
    const { status, comment } = req.body;

    if (!status) {
        throw new ApiError('Status is required', 400);
    }

    const report = await reportService.updateReportStatus(
        req.params.id,
        status,
        req.user._id,
        comment
    );

    return ApiResponse.success(
        res,
        report,
        'Report status updated successfully'
    );
});

/**
 * @route   PATCH /api/v1/reports/:id/assign
 * @desc    Assign report to official
 * @access  Private (Admin)
 */
exports.assignReport = asyncHandler(async (req, res) => {
    const { officialId } = req.body;

    if (!officialId) {
        throw new ApiError('Official ID is required', 400);
    }

    const report = await reportService.assignReportToOfficial(
        req.params.id,
        officialId
    );

    return success(
        res,
        report,
        'Report assigned successfully'
    );
});

/**
 * @route   GET /api/v1/reports/user/my-reports
 * @desc    Get current user's reports
 * @access  Private
 */
exports.getMyReports = asyncHandler(async (req, res) => {
    const reports = await Report.find({ reportedBy: req.user._id })
        .populate('assignedTo', 'name officialDetails')
        .sort({ createdAt: -1 });

    return ApiResponse.success(
        res,
        reports,
        'User reports retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/reports/nearby
 * @desc    Get reports near a location
 * @access  Public
 */
exports.getReportsNearby = asyncHandler(async (req, res) => {
    const { latitude, longitude, maxDistance = 5000, status, category } = req.query;

    if (!latitude || !longitude) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const filters = {};
    if (status) filters.status = status;
    if (category) filters.category = category;

    const reports = await reportService.getReportsNearby(
        parseFloat(longitude),
        parseFloat(latitude),
        parseInt(maxDistance),
        filters
    );

    return ApiResponse.success(
        res,
        reports,
        'Nearby reports retrieved successfully'
    );
});

/**
 * @route   PATCH /api/v1/reports/:id/upvote
 * @desc    Upvote a report
 * @access  Private
 */
exports.upvoteReport = asyncHandler(async (req, res) => {
    const report = await Report.findById(req.params.id);

    if (!report) {
        throw new ApiError('Report not found', 404);
    }

    await report.addUpvote(req.user._id);

    return success(
        res,
        { upvotes: report.upvotes },
        'Report upvoted successfully'
    );
});

/**
 * @route   DELETE /api/v1/reports/:id
 * @desc    Delete report
 * @access  Private (Admin)
 */
exports.deleteReport = asyncHandler(async (req, res) => {
    const report = await Report.findById(req.params.id);

    if (!report) {
        throw new ApiError('Report not found', 404);
    }

    await report.deleteOne();

    return success(
        res,
        null,
        'Report deleted successfully'
    );
});
