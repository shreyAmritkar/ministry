// ============================================
// controllers/authController.js
// Authentication Controller
// ============================================
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
exports.register = asyncHandler(async (req, res) => {
    const { name, email, phone, password, userType } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError('User with this email already exists', 400);
    }

    // Create user
    const user = await User.create({
        name,
        email,
        phone,
        password,
        userType: userType || 'citizen'
    });

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    user.password = undefined;

    return ApiResponse.success(
        res,
        { user, token },
        'User registered successfully',
        201
    );
});

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        throw new ApiError('Please provide email and password', 400);
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new ApiError('Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.isActive) {
        throw new ApiError('Your account has been deactivated', 403);
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
        throw new ApiError('Invalid credentials', 401);
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    user.password = undefined;

    return ApiResponse.success(
        res,
        { user, token },
        'Login successful'
    );
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res) => {
    return ApiResponse.success(
        res,
        null,
        'Logout successful'
    );
});

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    return ApiResponse.success(
        res,
        user,
        'User details retrieved successfully'
    );
});

/**
 * @route   PATCH /api/v1/auth/update-password
 * @desc    Update password
 * @access  Private
 */
exports.updatePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new ApiError('Please provide current and new password', 400);
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isPasswordMatch = await user.comparePassword(currentPassword);

    if (!isPasswordMatch) {
        throw new ApiError('Current password is incorrect', 401);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    return ApiResponse.success(
        res,
        { token },
        'Password updated successfully'
    );
});

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError('No user found with this email', 404);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    user.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    user.passwordResetExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes

    await user.save({ validateBeforeSave: false });

    // In production, send email here
    // For now, return token directly (NOT SECURE - only for development)

    return ApiResponse.success(
        res,
        {
            resetToken,
            message: 'Password reset token generated. In production, this would be sent via email.'
        },
        'Password reset token generated'
    );
});

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
        throw new ApiError('Please provide a new password', 400);
    }

    // Hash token
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError('Invalid or expired reset token', 400);
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();

    // Generate new token
    const authToken = generateToken(user._id);

    return ApiResponse.success(
        res,
        { token: authToken },
        'Password reset successful'
    );
});

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;

    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        verificationToken: hashedToken,
        verificationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError('Invalid or expired verification token', 400);
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    return ApiResponse.success(
        res,
        null,
        'Email verified successfully'
    );
});