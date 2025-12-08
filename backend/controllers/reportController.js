// ============================================
// controllers/reportController.js
// Report Management Controller (MODIFIED FOR CITY-LEVEL)
// ============================================
const Report = require('../models/Report');
const reportService = require('../services/reportService');
const { assignReportToOfficial } = require('../utils/assignmentHelper'); // Assumes this now returns 'city'
const asyncHandler = require("../utils/asyncHandler");
const {paginated, success, ApiResponse} = require("../utils/ApiResponse"); // Added ApiResponse here
const ApiError = require("../utils/ApiError");
const User = require('../models/User');

/**
 * @route   GET /api/v1/reports
 * @desc    Get all reports with filters (now includes city filter)
 * @access  Public
 */
exports.getAllReports = asyncHandler(async (req, res) => {
    // Replaced 'ward' with 'city' in the destructuring
    const { status, category, city, priority, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (city) query['address.city'] = city; // Updated filter to target city field
    if (priority) query.priority = priority;

    const reports = await Report.find(query)
        .populate('reportedBy', 'name email')
        .populate('assignedTo', 'name officialDetails')
        .populate('official_tenure_id', 'position city') // Updated official_tenure_id population field
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
        .populate('official_tenure_id', 'position city department'); // Updated population field

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

    // Ensure coordinates are available (assuming GeoJSON [longitude, latitude] standard)
    if (!reportData.location || !reportData.location.coordinates || reportData.location.coordinates.length !== 2) {
        throw new ApiError('Valid GeoJSON location coordinates are required.', 400);
    }

    // Extract coordinates
    const [longitude, latitude] = reportData.location.coordinates;

    // Auto-assign to official
    const assignment = await assignReportToOfficial(
        latitude,
        longitude,
        new Date()
    );

    // If a city was determined AND an official was found
    if (assignment.city) {
        // Save the automatically determined city name
        reportData.address.city = assignment.city;
    }

    if (assignment.official_id) {
        reportData.assignedTo = assignment.official_id;
        reportData.official_tenure_id = assignment.tenure_id;
    }


    const report = await reportService.createReport(reportData, req.user._id);

    // Populate relations for the response
    await report.populate('assignedTo', 'name officialDetails');

    return success(
        res,
        { report, assignment: assignment.officialDetails },
        'Report created successfully and assigned (if official found)',
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

    return success(
        res,
        report,
        'Report status updated successfully'
    );
});

/**
 * @route   PATCH /api/v1/reports/:id/assign
 * @desc    Assign report to official
 * @access  Private (Admin)
 * * NOTE: For city-level accountability, this route is less necessary but remains
 * for Admin fallback/reassignment of UNASSIGNED reports.
 */
exports.assignReport = asyncHandler(async (req, res) => {
    const { officialId } = req.body;

    if (!officialId) {
        throw new ApiError('Official ID is required', 400);
    }

    // NOTE: In a city-level system, this function might need to also update the
    // official_tenure_id based on the officialId provided.
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

    return success( // Fixed: Was ApiResponse.success
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

    return success( // Fixed: Was ApiResponse.success
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

    // Assuming the Report model has a method addUpvote
    // NOTE: The original code lacked definition for addUpvote, assuming it exists on the model.
    if (report.addUpvote) {
        await report.addUpvote(req.user._id);
    } else {
        // Fallback or simple logic if model method is missing
        if (!report.upvotes.includes(req.user._id)) {
            report.upvotes.push(req.user._id);
            await report.save();
        }
    }


    return success(
        res,
        { upvotes: report.upvotes.length }, // Return the count
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

    // Check for authorization (e.g., if (req.user.role !== 'admin')) here in a real app

    await report.deleteOne();

    return success(
        res,
        null,
        'Report deleted successfully'
    );
});