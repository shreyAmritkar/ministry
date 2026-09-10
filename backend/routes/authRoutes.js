// ============================================
// routes/authRoutes.js (UPDATED)
// ============================================
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout); // needs only the refresh token, not a valid access token
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);

// Protected routes
router.use(protect);
router.post('/logout-all', authController.logoutAll);
router.get('/me', authController.getMe);
router.patch('/update-password', authController.updatePassword);

module.exports = router;