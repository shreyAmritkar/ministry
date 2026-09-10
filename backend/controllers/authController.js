// ============================================
// controllers/authController.js
// Authentication Controller
//
// Token architecture:
//   - ACCESS token:  short-lived (15m default), stateless JWT. Signed
//                    with JWT_SECRET, validated purely by signature +
//                    expiry in middleware/auth.js. NEVER written to
//                    the database.
//   - REFRESH token: long-lived (30d default) opaque random string.
//                    Only its SHA-256 hash is persisted, in
//                    `refresh_tokens` (models/RefreshToken.js), which
//                    is what makes it revocable — on logout, on
//                    rotation, or all-at-once via "log out everywhere".
// ============================================

const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const notificationService = require('../services/notificationService');

const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m'
    });
};

const issueRefreshToken = (userId, userAgent) => {
    const days = parseInt(process.env.JWT_REFRESH_EXPIRE_DAYS, 10) || 30;
    return RefreshToken.issue(userId, { expiresInDays: days, userAgent });
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
exports.register = asyncHandler(async (req, res) => {
    const requestingUserRole = req.user?.role;
    const { name, email, phone, password, userType, startDate } = req.body;
    if (startDate) {
        const parsedDate = new Date(startDate);
        if (parsedDate > new Date()) {
            throw new ApiError("Start date cannot be in the future", 400);
        }
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        throw new ApiError('User with this email already exists', 400);
    }

    let finalUserType = 'citizen';
    if (requestingUserRole === 'admin') {
        if (userType === 'official') {
            finalUserType = 'official';
        }
    } else if (userType && userType !== 'citizen') {
        throw new ApiError("You do not have permission to create this user type.", 403);
    }

    let user = await User.create({
        name,
        email,
        phone,
        password,
        userType: finalUserType,
        role: finalUserType,
    });

    const verificationToken = await User.createVerificationToken(user._id);

    notificationService.sendEmail({
        to: user.email,
        subject: 'Verify your CivicTrack account',
        html: notificationService.getVerificationEmailTemplate(user, verificationToken)
    }).catch((error) => {
        console.error('Failed to send verification email:', error);
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await issueRefreshToken(user._id, req.headers['user-agent']);

    return ApiResponse.success(
        res,
        { user, accessToken, refreshToken },
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

    if (!email || !password) {
        throw new ApiError('Please provide email and password', 400);
    }

    const user = await User.findByEmail(email, { withPassword: true });

    if (!user) {
        throw new ApiError('Invalid credentials', 401);
    }

    if (!user.isActive) {
        throw new ApiError('Your account has been deactivated', 403);
    }

    const isPasswordMatch = await User.comparePassword(password, user.password);

    if (!isPasswordMatch) {
        throw new ApiError('Invalid credentials', 401);
    }

    await User.touchLastLogin(user._id);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await issueRefreshToken(user._id, req.headers['user-agent']);

    delete user.password;

    return ApiResponse.success(
        res,
        { user, accessToken, refreshToken },
        'Login successful'
    );
});

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Exchange a valid refresh token for a new access token.
 *          The refresh token is ROTATED on every use: the old one is
 *          revoked and a new one issued, so a stolen-and-replayed
 *          refresh token becomes visibly detectable (both the
 *          attacker's and the legitimate client's next refresh
 *          attempt would fail, since only one "latest" token per
 *          chain is ever valid at a time).
 * @access  Public (the refresh token itself is the credential)
 */
exports.refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new ApiError('Refresh token is required', 400);
    }

    const tokenRecord = await RefreshToken.findValid(refreshToken);

    if (!tokenRecord) {
        throw new ApiError('Invalid or expired refresh token, please log in again', 401);
    }

    const user = await User.findById(tokenRecord.userId);

    if (!user || !user.isActive) {
        await RefreshToken.revoke(refreshToken);
        throw new ApiError('Invalid or expired refresh token, please log in again', 401);
    }

    const newRefreshToken = await issueRefreshToken(user._id, req.headers['user-agent']);
    await RefreshToken.rotate(refreshToken, newRefreshToken);

    const accessToken = generateAccessToken(user._id);

    return ApiResponse.success(
        res,
        { accessToken, refreshToken: newRefreshToken },
        'Token refreshed successfully'
    );
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Revoke the refresh token for this session. The access token
 *          is NOT (and cannot be) invalidated server-side — it's
 *          stateless — but it's short-lived (15m default) and simply
 *          expires on its own shortly after. The client should discard
 *          both tokens immediately regardless.
 * @access  Public (the refresh token itself is the credential; no
 *          access token is required so logout still works even if the
 *          access token has already expired)
 */
exports.logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
        await RefreshToken.revoke(refreshToken);
    }

    return ApiResponse.success(
        res,
        null,
        'Logout successful'
    );
});

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Revoke every refresh token for the current user — "log out
 *          of all devices". Requires a currently-valid access token.
 * @access  Private
 */
exports.logoutAll = asyncHandler(async (req, res) => {
    await RefreshToken.revokeAllForUser(req.user._id);

    return ApiResponse.success(
        res,
        null,
        'Logged out of all devices'
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
 * @desc    Update password. Also revokes every refresh token for this
 *          user (other devices/sessions get logged out), since a
 *          password change is a reasonable trigger to require
 *          everyone to re-authenticate.
 * @access  Private
 */
exports.updatePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new ApiError('Please provide current and new password', 400);
    }

    const user = await User.findById(req.user._id, { withPassword: true });

    const isPasswordMatch = await User.comparePassword(currentPassword, user.password);

    if (!isPasswordMatch) {
        throw new ApiError('Current password is incorrect', 401);
    }

    await User.updatePassword(user._id, newPassword);
    await RefreshToken.revokeAllForUser(user._id);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await issueRefreshToken(user._id, req.headers['user-agent']);

    return ApiResponse.success(
        res,
        { accessToken, refreshToken },
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

    const user = await User.findByEmail(email);

    if (!user) {
        throw new ApiError('No user found with this email', 404);
    }

    const resetToken = await User.setPasswordResetToken(user._id);

    const emailSent = await notificationService.sendEmail({
        to: user.email,
        subject: 'Reset your CivicTrack password',
        html: notificationService.getPasswordResetEmailTemplate(user, resetToken)
    });

    if (!emailSent) {
        await User.clearPasswordResetToken(user._id);
        throw new ApiError('Failed to send password reset email. Please try again later.', 500);
    }

    return ApiResponse.success(
        res,
        null,
        'Password reset instructions have been sent to your email'
    );
});

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password. Also revokes every existing refresh token
 *          for this user — a password reset should end every prior
 *          session, including any an attacker may hold.
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
        throw new ApiError('Please provide a new password', 400);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findByPasswordResetToken(hashedToken);

    if (!user) {
        throw new ApiError('Invalid or expired reset token', 400);
    }

    await User.updatePassword(user._id, password);
    await User.clearPasswordResetToken(user._id);
    await RefreshToken.revokeAllForUser(user._id);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await issueRefreshToken(user._id, req.headers['user-agent']);

    return ApiResponse.success(
        res,
        { accessToken, refreshToken },
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

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findByVerificationToken(hashedToken);

    if (!user) {
        throw new ApiError('Invalid or expired verification token', 400);
    }

    await User.markVerified(user._id);

    return ApiResponse.success(
        res,
        null,
        'Email verified successfully'
    );
});
