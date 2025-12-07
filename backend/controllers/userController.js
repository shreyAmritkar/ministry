// ============================================
// controllers/userController.js
// User Management Controller
// ============================================
const asyncHandler = require("../utils/asyncHandler");
const {paginated, success} = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const {findByIdAndUpdate, findByIdAndUpdate} = require("../models/User");
/**
 * @route   GET /api/v1/users
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
    const { userType, role, page = 1, limit = 20 } = req.query;

    const query = {};
    if (userType) query.userType = userType;
    if (role) query.role = role;

    const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    return paginated(
        res,
        users,
        {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
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
    const user = await User.findById(req.params.id).select('-password');

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

    const user = await findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
    ).select('-password');

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

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true, runValidators: true }
    ).select('-password');

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
    const user = await findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
    );

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    return success(
        res,
        null,
        'User deactivated successfully'
    );
});