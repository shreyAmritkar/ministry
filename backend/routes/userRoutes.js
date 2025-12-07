// ============================================
// routes/userRoutes.js (NEW)
// ============================================
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// All routes require authentication
router.use(protect);

// User can view and update their own profile
router.get('/:id', userController.getUserById);
router.patch('/:id', userController.updateProfile);

// Admin only routes
router.get('/', authorize('admin'), userController.getAllUsers);
router.patch('/:id/role', authorize('admin'), userController.updateUserRole);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
