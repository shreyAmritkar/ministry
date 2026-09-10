// ============================================
// controllers/reportController.js
// Report Management Controller
// ============================================
const Report = require('../models/Report');
const reportService = require('../services/reportService');
const OfficialTenure = require('../models/OfficialTenure');
const { assignReportToOfficial } = require('../utils/assignmentHelper');
const asyncHandler = require("../utils/asyncHandler");
const { paginated, success } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const notificationService = require('../services/notificationService');
const sseService = require('../services/sseService');
const { queueAIAnalysis, queueNotification } = require('../queues/report.queue');

/**
 * @route   PATCH /api/v1/reports/:id/mark-resolved
 * @desc    Official marks report as resolved (triggers verification)
 * @access  Private (Official/Admin)
 */
exports.markAsResolved = asyncHandler(async (req, res) => {
    const { resolutionDescription, verificationMedia } = req.body;

    const existing = await Report.findById(req.params.id);
    if (!existing) {
        throw new ApiError('Report not found', 404);
    }

    const report = await Report.setResolutionClaim(req.params.id, {
        description: resolutionDescription,
        resolvedBy: req.user._id,
        verificationMedia: verificationMedia || [],
    });

    await notificationService.notifyResolutionClaimed(report._id);

    return success(
        res,
        report,
        'Resolution claimed. Verification email sent to reporter.'
    );
});

/**
 * @route   PATCH /api/v1/reports/:id/verify-resolution
 * @desc    Reporter verifies or rejects resolution
 * @access  Private (Reporter only)
 */
exports.verifyResolution = asyncHandler(async (req, res) => {
    const { verified, comment } = req.body;

    const existing = await Report.findById(req.params.id);
    if (!existing) {
        throw new ApiError('Report not found', 404);
    }

    if (existing.reportedBy !== req.user._id) {
        throw new ApiError('Only the reporter can verify resolution', 403);
    }

    const report = await Report.setVerification(req.params.id, {
        verified, userId: req.user._id, comment,
    });

    if (verified && report.official_tenure_id) {
        await OfficialTenure.updateMetrics(report.official_tenure_id);
    }

    return success(
        res,
        report,
        verified ? 'Resolution verified. Thank you!' : 'Resolution rejected. Official will be notified.'
    );
});

/**
 * @route   GET /api/v1/reports
 * @desc    Get all reports with filters
 * @access  Public
 */
exports.getAllReports = asyncHandler(async (req, res) => {
    const { status, category, city, priority, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (city) filters.city = city;
    if (priority) filters.priority = priority;

    const numLimit = Number(limit);
    const reports = await Report.findAll(filters, { limit: numLimit, offset: (page - 1) * numLimit });

    for (const report of reports) {
        await Report.populateUsers(report, 'name email officialDetails');
        await Report.populateTenure(report, 'position city');
    }

    const total = await Report.count(filters);

    return paginated(
        res,
        reports,
        {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / numLimit)
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
    let report = await Report.findById(req.params.id);

    if (!report) {
        throw new ApiError('Report not found', 404);
    }

    report = await Report.incrementViews(report._id);
    await Report.populateUsers(report, 'name email phone officialDetails');
    await Report.populateTenure(report, 'position city department');
    await Report.attachStatusHistory(report);

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
        reportedBy: req.user._id,
    };

    if (!reportData.location?.coordinates || reportData.location.coordinates.length !== 2) {
        throw new ApiError('Valid GeoJSON location coordinates are required.', 400);
    }

    const [longitude, latitude] = reportData.location.coordinates;

    const assignment = await assignReportToOfficial(latitude, longitude, new Date());

    if (assignment.city) {
        reportData.address = { ...reportData.address, city: assignment.city };
    }

    if (assignment.official_id) {
        reportData.assignedTo = assignment.official_id;
        reportData.official_tenure_id = assignment.tenure_id;
    }

    let report = await reportService.createReport(reportData, req.user._id);

    try {
        await queueAIAnalysis(
            report._id.toString(),
            reportData.title,
            reportData.description
        );
        console.log(`🚀 AI analysis queued for report: ${report._id}`);
    } catch (queueError) {
        console.warn('Failed to queue AI analysis:', queueError);
    }

    if (assignment.official_id) {
        try {
            await queueNotification('report-assigned', assignment.official_id, {
                reportId: report._id,
                reportTitle: reportData.title,
                priority: reportData.priority,
            });
        } catch (queueError) {
            console.warn('Failed to queue notification:', queueError);
        }
    }

    await Report.populateUsers(report, 'name officialDetails');

    return success(
        res,
        {
            report,
            assignment: assignment.officialDetails,
            message: 'AI analysis is being processed in the background',
        },
        'Report created successfully',
        201
    );
});

/**
 * @route   POST /api/v1/reports/bulk
 * @desc    Create new reports
 * @access  Private
 */
exports.createBulkReports = asyncHandler(async (req, res) => {
    const { reports } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
        throw new ApiError('Reports array is required and cannot be empty', 400);
    }

    if (reports.length > 100) {
        throw new ApiError('Cannot create more than 100 reports at once', 400);
    }

    const results = { successful: [], failed: [] };

    for (let i = 0; i < reports.length; i++) {
        try {
            const reportData = { ...reports[i], reportedBy: req.user._id };

            if (!reportData.location || !reportData.location.coordinates || reportData.location.coordinates.length !== 2) {
                results.failed.push({
                    index: i,
                    data: reports[i],
                    error: 'Valid GeoJSON location coordinates are required'
                });
                continue;
            }

            const [longitude, latitude] = reportData.location.coordinates;

            const assignment = await assignReportToOfficial(latitude, longitude, new Date());

            if (assignment.city) {
                reportData.address = reportData.address || {};
                reportData.address.city = assignment.city;
            }

            if (assignment.official_id) {
                reportData.assignedTo = assignment.official_id;
                reportData.official_tenure_id = assignment.tenure_id;
            }

            const report = await reportService.createReport(reportData, req.user._id);
            await Report.populateUsers(report, 'name officialDetails');

            results.successful.push({
                index: i,
                reportId: report._id,
                assignment: assignment.officialDetails || null
            });
        } catch (error) {
            results.failed.push({
                index: i,
                data: reports[i],
                error: error.message
            });
        }
    }

    return success(
        res,
        {
            total: reports.length,
            successful: results.successful.length,
            failed: results.failed.length,
            results
        },
        `Bulk creation completed: ${results.successful.length} succeeded, ${results.failed.length} failed`,
        201
    );
});

/**
 * @route   GET /api/v1/reports/:id/stream
 * @desc    Server-Sent Events stream of live updates for one report —
 *          status changes, upvotes — for anyone with the detail page
 *          open. Public, same access model as GET /reports/:id.
 * @access  Public (SSE)
 */
exports.streamReport = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ reportId: req.params.id })}\n\n`);

    const unregister = sseService.registerConnection(res, {
        reportId: String(req.params.id),
    });

    req.on('close', unregister);
};

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

    notificationService.emitReportUpdate(report._id, { status: report.status, updatedAt: report.updatedAt });

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
    const reports = await Report.findAll({ reportedBy: req.user._id }, { limit: 1000, offset: 0 });

    for (const report of reports) {
        await Report.populateUsers(report, 'name officialDetails');
    }

    return success(
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
    const DEFAULT_SEARCH_RADIUS = parseInt(process.env.DEFAULT_SEARCH_RADIUS, 10) || 5000;
    const MAX_SEARCH_RADIUS = parseInt(process.env.MAX_SEARCH_RADIUS, 10) || 50000;

    const { latitude, longitude, maxDistance = DEFAULT_SEARCH_RADIUS, status, category } = req.query;

    if (!latitude || !longitude) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const filters = {};
    if (status) filters.status = status;
    if (category) filters.category = category;

    const requestedDistance = parseInt(maxDistance, 10) || DEFAULT_SEARCH_RADIUS;
    const clampedDistance = Math.min(requestedDistance, MAX_SEARCH_RADIUS);

    const reports = await reportService.getReportsNearby(
        parseFloat(longitude),
        parseFloat(latitude),
        clampedDistance,
        filters
    );

    return success(
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
    const existing = await Report.findById(req.params.id);

    if (!existing) {
        throw new ApiError('Report not found', 404);
    }

    const upvotes = await Report.addUpvote(req.params.id, req.user._id);

    notificationService.emitReportUpdate(req.params.id, { upvotes });

    return success(
        res,
        { upvotes },
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

    await Report.deleteById(req.params.id);

    return success(
        res,
        null,
        'Report deleted successfully'
    );
});

/**
 * @route   GET /api/v1/reports/official/my-assigned-reports
 * @desc    Get all reports assigned to the current official
 * @access  Private (Official)
 */
exports.getOfficialAssignedReports = asyncHandler(async (req, res) => {
    const officialId = req.user._id;

    if (!officialId) {
        throw new ApiError('Authentication error: Official ID not found.', 401);
    }

    const reports = await Report.findByAssignedTo(officialId);

    for (const report of reports) {
        await Report.populateUsers(report, 'name email officialDetails');
    }

    return success(
        res,
        reports,
        'Assigned reports retrieved successfully for official dashboard'
    );
});
