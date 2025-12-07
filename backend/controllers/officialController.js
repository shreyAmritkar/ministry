// ============================================
// controllers/officialController.js
// Official Scorecard Controller
// ============================================
const officialService = require('../services/officialService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

/**
 * @route   GET /api/v1/officials/:id/scorecard
 * @desc    Get official's performance scorecard
 * @access  Public
 */
exports.getOfficialScorecard = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const scorecard = await officialService.getOfficialScorecard(id);

    return ApiResponse.success(
        res,
        scorecard,
        'Scorecard retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/officials/:id/scorecard/comparison
 * @desc    Get official's scorecard with ward comparison
 * @access  Public
 */
exports.getOfficialScorecardWithComparison = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const scorecard = await officialService.compareWithWardAverage(id);

    return ApiResponse.success(
        res,
        scorecard,
        'Scorecard with comparison retrieved successfully'
    );
});
