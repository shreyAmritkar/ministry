// ============================================
// controllers/userController.js
// User Management Controller
// ============================================
const asyncHandler = require("../utils/asyncHandler");
const { paginated, success } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const User = require('../models/User');

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
    const { userType, role, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (userType) filters.userType = userType;
    if (role) filters.role = role;

    const numLimit = Number(limit);
    const users = await User.findAll(filters, { limit: numLimit, offset: (page - 1) * numLimit });
    const total = await User.count(filters);

    return paginated(
        res,
        users,
        {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / numLimit)
        },
        'Users retrieved successfully'
    );
});

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
exports.getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    return success(
        res,
        user,
        'User retrieved successfully'
    );
});

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update user profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res) => {
    // Don't allow password update through this route
    if (req.body.password) {
        throw new ApiError('Please use /auth/update-password to change password', 400);
    }

    const allowedFields = ['name', 'phone', 'address', 'avatar'];
    const updates = {};

    allowedFields.forEach(field => {
        if (req.body[field]) {
            updates[field] = req.body[field];
        }
    });

    const user = await User.updateById(req.params.id, updates);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    return success(
        res,
        user,
        'Profile updated successfully'
    );
});

/**
 * @route   PATCH /api/v1/users/:id/role
 * @desc    Update user role
 * @access  Private/Admin
 */
exports.updateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;

    if (!role) {
        throw new ApiError('Role is required', 400);
    }

    const user = await User.updateById(req.params.id, { role });

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    return success(
        res,
        user,
        'User role updated successfully'
    );
});

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user (soft delete - deactivate)
 * @access  Private/Admin
 */
exports.deleteUser = asyncHandler(async (req, res) => {
    const user = await User.updateById(req.params.id, { isActive: false });

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    return success(
        res,
        null,
        'User deactivated successfully'
    );
});
