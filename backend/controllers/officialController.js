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
 * @route   GET /api/v1/officials/my-scorecard
 * @desc    Get official's scorecard
 * @access  Private
 */
exports.getAuthenticatedOfficialScorecard = asyncHandler(async (req, res, next) => {
    // 1. Get the official ID from the authenticated user
    // console.log(req.user);
    const officialId = req.user._id;

    if (!officialId || req.user.role !== 'official') {
        throw new ApiError('Unauthorized access to official scorecard.', 403);
    }

    // 2. Reuse the logic to fetch the scorecard
    const scorecard = await officialService.getOfficialScorecard(officialId);

    if (!scorecard) {
        // This likely means the official hasn't been added to the scorecard system yet.
        throw new ApiError('Official Scorecard not found for the logged-in user.', 404);
    }
    // console.log("scorecard : ",scorecard);
    return ApiResponse.success(
        res,
        scorecard,
        'Official dashboard scorecard retrieved successfully');
});