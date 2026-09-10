// ============================================
// controllers/tenureController.js
// Official Tenure Management Controller
// ============================================
const OfficialTenure = require('../models/OfficialTenure');
const Report = require('../models/Report');
const User = require('../models/User');
const tenureService = require('../services/tenureService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

async function populateOfficialAndAppointer(tenure) {
    if (!tenure) return tenure;
    const official = await User.findById(tenure.official);
    tenure.official = official
        ? { _id: official._id, name: official.name, email: official.email, phone: official.phone, officialDetails: official.officialDetails }
        : null;
    if (tenure.appointedBy) {
        const appointer = await User.findById(tenure.appointedBy);
        tenure.appointedBy = appointer ? { _id: appointer._id, name: appointer.name, email: appointer.email } : null;
    }
    return tenure;
}

/**
 * @route   GET /api/v1/tenures
 * @desc    Get all tenures with filters
 * @access  Public
 */
exports.getAllTenures = asyncHandler(async (req, res) => {
    const { city, isActive, position, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (city) filters.city = city;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (position) filters.position = position;

    const numLimit = Number(limit);
    const tenures = await OfficialTenure.findAll(filters, { limit: numLimit, offset: (page - 1) * numLimit });
    for (const tenure of tenures) {
        await populateOfficialAndAppointer(tenure);
    }

    const total = await OfficialTenure.count(filters);

    return ApiResponse.paginated(
        res,
        tenures,
        { total, page: parseInt(page), pages: Math.ceil(total / numLimit) },
        'Tenures retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/:id
 * @desc    Get single tenure by ID
 * @access  Public
 */
exports.getTenureById = asyncHandler(async (req, res) => {
    const tenure = await OfficialTenure.findById(req.params.id);

    if (!tenure) {
        throw new ApiError('Tenure not found', 404);
    }
    await populateOfficialAndAppointer(tenure);

    const reports = await Report.findAll(
        { official_tenure_id_in: [tenure._id] },
        { limit: 10, offset: 0 }
    );
    tenure.reports = reports.map(r => ({
        title: r.title, status: r.status, category: r.category, createdAt: r.createdAt,
    }));

    return ApiResponse.success(
        res,
        tenure,
        'Tenure retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/city/:city/current
 * @desc    Get current official for a specific city
 * @access  Public
 */
exports.getCurrentOfficialForCity = asyncHandler(async (req, res) => {
    const { city } = req.params;

    const tenure = await OfficialTenure.findCurrentOfficialForCity(city);

    if (!tenure) {
        throw new ApiError(`No active official found for ${city}`, 404);
    }

    return ApiResponse.success(
        res,
        tenure,
        'Current official retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/city/:city/history
 * @desc    Get tenure history for a city
 * @access  Public
 */
exports.getCityTenureHistory = asyncHandler(async (req, res) => {
    const { city } = req.params;

    const tenures = await OfficialTenure.findAll({ city }, { limit: 1000, offset: 0 });
    for (const tenure of tenures) {
        await populateOfficialAndAppointer(tenure);
    }

    return ApiResponse.success(
        res,
        tenures,
        'city tenure history retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/official/:officialId
 * @desc    Get all tenures for a specific official
 * @access  Public
 */
exports.getOfficialTenures = asyncHandler(async (req, res) => {
    const { officialId } = req.params;

    const official = await User.findById(officialId);
    if (!official || official.userType !== 'official') {
        throw new ApiError('Official not found', 404);
    }

    const tenures = await OfficialTenure.findByOfficial(officialId);

    return ApiResponse.success(
        res,
        tenures,
        'Official tenures retrieved successfully'
    );
});

/**
 * @route   POST /api/v1/tenures
 * @desc    Create new tenure (assign official to city)
 * @access  Private/Admin
 */
exports.createTenure = asyncHandler(async (req, res) => {
    const { official, city, position, department, startDate, endDate } = req.body;

    if (!official || !city || !position || !department || !startDate) {
        throw new ApiError('Please provide all required fields', 400);
    }

    const officialUser = await User.findById(official);
    if (!officialUser || officialUser.userType !== 'official') {
        throw new ApiError('Invalid official reference', 400);
    }

    const overlapping = await tenureService.checkOverlappingTenures(
        city,
        new Date(startDate),
        endDate ? new Date(endDate) : null
    );

    if (overlapping) {
        throw new ApiError(
            'Another official is already assigned to this city for the specified period',
            400
        );
    }

    const tenure = await OfficialTenure.create({
        official,
        city,
        position,
        department,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        appointedBy: req.user._id,
        isActive: true
    });

    await populateOfficialAndAppointer(tenure);

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
    const updates = { ...req.body };

    delete updates.official;
    delete updates.city;

    const existing = await OfficialTenure.findById(id);
    if (!existing) {
        throw new ApiError('Tenure not found', 404);
    }

    const tenure = await OfficialTenure.updateById(id, updates);
    await populateOfficialAndAppointer(tenure);

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

    const existing = await OfficialTenure.findById(id);
    if (!existing) {
        throw new ApiError('Tenure not found', 404);
    }

    if (!existing.isActive) {
        throw new ApiError('Tenure is already ended', 400);
    }

    const tenure = await OfficialTenure.endTenure(
        id,
        reason,
        endDate ? new Date(endDate) : new Date()
    );
    await populateOfficialAndAppointer(tenure);

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

    const linkedReports = await Report.count({ official_tenure_id_in: [tenure._id] });

    if (linkedReports > 0) {
        throw new ApiError(
            `Cannot delete tenure. ${linkedReports} reports are linked to this tenure. Please end the tenure instead.`,
            400
        );
    }

    await OfficialTenure.deleteById(req.params.id);

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
    const existing = await OfficialTenure.findById(req.params.id);

    if (!existing) {
        throw new ApiError('Tenure not found', 404);
    }

    const tenure = await OfficialTenure.updateMetrics(req.params.id);

    return ApiResponse.success(
        res,
        { metrics: tenure.metrics },
        'Tenure metrics updated successfully'
    );
});

/**
 * @route   GET /api/v1/tenures/city/:city/at-date
 * @desc    Get official responsible for a city at a specific date
 * @access  Public
 */
exports.getOfficialAtDate = asyncHandler(async (req, res) => {
    const { city } = req.params;
    const { date } = req.query;

    if (!date) {
        throw new ApiError('Date parameter is required', 400);
    }

    const tenure = await tenureService.getOfficialAtSpecificDate(
        city,
        new Date(date)
    );

    if (!tenure) {
        throw new ApiError(
            `No official was assigned to ${city} on ${date}`,
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
    const totalTenures = await OfficialTenure.count();
    const activeTenures = await OfficialTenure.count({ isActive: true });

    const tenuresByPosition = await OfficialTenure.aggregateByPosition();
    const tenuresByCity = await OfficialTenure.aggregateByCity();

    const completedTenures = await OfficialTenure.findCompletedDurations();

    let avgDurationDays = 0;
    if (completedTenures.length > 0) {
        const totalDays = completedTenures.reduce((sum, tenure) => {
            const duration = new Date(tenure.end_date) - new Date(tenure.start_date);
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
            byCity: tenuresByCity
        },
        'Tenure statistics retrieved successfully'
    );
});

module.exports = exports;
