// ============================================
// controllers/tenureController.js
// Official Tenure Management Controller
// ============================================
const OfficialTenure = require('../models/OfficialTenure');
const User = require('../models/User');
const tenureService = require('../services/tenureService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @route   GET /api/v1/tenures
 * @desc    Get all tenures with filters
 * @access  Public
 */
exports.getAllTenures = asyncHandler(async (req, res) => {
    const { ward, isActive, position, page = 1, limit = 20 } = req.query;

    const query = {};

    if (ward) query.ward = ward;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (position) query.position = position;

    const tenures = await OfficialTenure.find(query)
        .populate('official', 'name email phone officialDetails')
        .populate('appointedBy', 'name')
        .sort({ startDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await OfficialTenure.countDocuments(query);

    return ApiResponse.paginated(
        res,
        tenures,
        {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        },
        'Tenures retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/:id
 * @desc    Get single tenure by ID
 * @access  Public
 */
exports.getTenureById = asyncHandler(async (req, res) => {
    const tenure = await OfficialTenure.findById(req.params.id)
        .populate('official', 'name email phone officialDetails')
        .populate('appointedBy', 'name email')
        .populate({
            path: 'reports',
            select: 'title status category createdAt',
            options: { limit: 10, sort: { createdAt: -1 } }
        });

    if (!tenure) {
        throw new ApiError('Tenure not found', 404);
    }

    return ApiResponse.success(
        res,
        tenure,
        'Tenure retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/ward/:ward/current
 * @desc    Get current official for a specific ward
 * @access  Public
 */
exports.getCurrentOfficialForWard = asyncHandler(async (req, res) => {
    const { ward } = req.params;

    const tenure = await OfficialTenure.findCurrentOfficialForWard(ward);

    if (!tenure) {
        throw new ApiError(`No active official found for ${ward}`, 404);
    }

    return ApiResponse.success(
        res,
        tenure,
        'Current official retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/ward/:ward/history
 * @desc    Get tenure history for a ward
 * @access  Public
 */
exports.getWardTenureHistory = asyncHandler(async (req, res) => {
    const { ward } = req.params;

    const tenures = await OfficialTenure.find({ ward })
        .populate('official', 'name email officialDetails')
        .sort({ startDate: -1 });

    return ApiResponse.success(
        res,
        tenures,
        'Ward tenure history retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/official/:officialId
 * @desc    Get all tenures for a specific official
 * @access  Public
 */
exports.getOfficialTenures = asyncHandler(async (req, res) => {
    const { officialId } = req.params;

    // Verify official exists
    const official = await User.findById(officialId);
    if (!official || official.userType !== 'official') {
        throw new ApiError('Official not found', 404);
    }

    const tenures = await OfficialTenure.find({ official: officialId })
        .sort({ startDate: -1 });

    return ApiResponse.success(
        res,
        tenures,
        'Official tenures retrieved successfully'
    );
});

/**
 * @route   POST /api/v1/tenures
 * @desc    Create new tenure (assign official to ward)
 * @access  Private/Admin
 */
exports.createTenure = asyncHandler(async (req, res) => {
    const {
        official,
        ward,
        wardNumber,
        zone,
        position,
        department,
        startDate,
        endDate,
        contactInfo,
        responsibilities
    } = req.body;

    // Validate required fields
    if (!official || !ward || !wardNumber || !zone || !position || !department || !startDate) {
        throw new ApiError('Please provide all required fields', 400);
    }

    // Verify official exists and is of type 'official'
    const officialUser = await User.findById(official);
    if (!officialUser || officialUser.userType !== 'official') {
        throw new ApiError('Invalid official reference', 400);
    }

    // Check for overlapping tenures
    const overlapping = await tenureService.checkOverlappingTenures(
        ward,
        new Date(startDate),
        endDate ? new Date(endDate) : null
    );

    if (overlapping) {
        throw new ApiError(
            'Another official is already assigned to this ward for the specified period',
            400
        );
    }

    // Create tenure
    const tenure = await OfficialTenure.create({
        official,
        ward,
        wardNumber,
        zone,
        position,
        department,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        contactInfo,
        responsibilities,
        appointedBy: req.user._id,
        isActive: true
    });

    // Populate official details
    await tenure.populate('official', 'name email phone officialDetails');

    return ApiResponse.success(
        res,
        tenure,
        'Tenure created successfully',
        201
    );
});

/**
 * @route   PATCH /api/v1/tenures/:id
 * @desc    Update tenure details
 * @access  Private/Admin
 */
exports.updateTenure = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow changing official or ward through update
    delete updates.official;
    delete updates.ward;
    delete updates.wardNumber;

    const tenure = await OfficialTenure.findById(id);

    if (!tenure) {
        throw new ApiError('Tenure not found', 404);
    }

    // Update fields
    Object.keys(updates).forEach(key => {
        tenure[key] = updates[key];
    });

    await tenure.save();

    await tenure.populate('official', 'name email phone officialDetails');

    return ApiResponse.success(
        res,
        tenure,
        'Tenure updated successfully'
    );
});

/**
 * @route   PATCH /api/v1/tenures/:id/end
 * @desc    End a tenure
 * @access  Private/Admin
 */
exports.endTenure = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason, endDate } = req.body;

    if (!reason) {
        throw new ApiError('Termination reason is required', 400);
    }

    const tenure = await OfficialTenure.findById(id);

    if (!tenure) {
        throw new ApiError('Tenure not found', 404);
    }

    if (!tenure.isActive) {
        throw new ApiError('Tenure is already ended', 400);
    }

    // End tenure
    await tenure.endTenure(
        reason,
        endDate ? new Date(endDate) : new Date()
    );

    await tenure.populate('official', 'name email phone officialDetails');

    return ApiResponse.success(
        res,
        tenure,
        'Tenure ended successfully'
    );
});

/**
 * @route   DELETE /api/v1/tenures/:id
 * @desc    Delete tenure (admin only, use with caution)
 * @access  Private/Admin
 */
exports.deleteTenure = asyncHandler(async (req, res) => {
    const tenure = await OfficialTenure.findById(req.params.id);

    if (!tenure) {
        throw new ApiError('Tenure not found', 404);
    }

    // Check if there are reports linked to this tenure
    const Report = require('../models/Report');
    const linkedReports = await Report.countDocuments({
        official_tenure_id: tenure._id
    });

    if (linkedReports > 0) {
        throw new ApiError(
            `Cannot delete tenure. ${linkedReports} reports are linked to this tenure. Please end the tenure instead.`,
            400
        );
    }

    await tenure.deleteOne();

    return ApiResponse.success(
        res,
        null,
        'Tenure deleted successfully'
    );
});

/**
 * @route   PATCH /api/v1/tenures/:id/metrics
 * @desc    Update tenure performance metrics
 * @access  Private/Admin
 */
exports.updateTenureMetrics = asyncHandler(async (req, res) => {
    const tenure = await OfficialTenure.findById(req.params.id);

    if (!tenure) {
        throw new ApiError('Tenure not found', 404);
    }

    // Recalculate metrics
    await tenure.updateMetrics();

    return ApiResponse.success(
        res,
        {
            metrics: tenure.metrics
        },
        'Tenure metrics updated successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/ward/:ward/at-date
 * @desc    Get official responsible for a ward at a specific date
 * @access  Public
 */
exports.getOfficialAtDate = asyncHandler(async (req, res) => {
    const { ward } = req.params;
    const { date } = req.query;

    if (!date) {
        throw new ApiError('Date parameter is required', 400);
    }

    const tenure = await tenureService.getOfficialAtSpecificDate(
        ward,
        new Date(date)
    );

    if (!tenure) {
        throw new ApiError(
            `No official was assigned to ${ward} on ${date}`,
            404
        );
    }

    return ApiResponse.success(
        res,
        tenure,
        'Historical official retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/stats
 * @desc    Get tenure statistics
 * @access  Public
 */
exports.getTenureStats = asyncHandler(async (req, res) => {
    const totalTenures = await OfficialTenure.countDocuments();
    const activeTenures = await OfficialTenure.countDocuments({ isActive: true });

    const tenuresByPosition = await OfficialTenure.aggregate([
        {
            $group: {
                _id: '$position',
                count: { $sum: 1 },
                active: {
                    $sum: { $cond: ['$isActive', 1, 0] }
                }
            }
        },
        { $sort: { count: -1 } }
    ]);

    const tenuresByZone = await OfficialTenure.aggregate([
        {
            $group: {
                _id: '$zone',
                count: { $sum: 1 },
                active: {
                    $sum: { $cond: ['$isActive', 1, 0] }
                }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Average tenure duration
    const completedTenures = await OfficialTenure.find({
        isActive: false,
        endDate: { $exists: true }
    });

    let avgDurationDays = 0;
    if (completedTenures.length > 0) {
        const totalDays = completedTenures.reduce((sum, tenure) => {
            const duration = tenure.endDate - tenure.startDate;
            return sum + (duration / (1000 * 60 * 60 * 24));
        }, 0);
        avgDurationDays = Math.round(totalDays / completedTenures.length);
    }

    return ApiResponse.success(
        res,
        {
            totalTenures,
            activeTenures,
            completedTenures: totalTenures - activeTenures,
            avgDurationDays,
            byPosition: tenuresByPosition,
            byZone: tenuresByZone
        },
        'Tenure statistics retrieved successfully'
    );
});

module.exports = exports;