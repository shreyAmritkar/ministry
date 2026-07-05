// ============================================
// routes/analyticsRoutes.js
// ============================================
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Public analytics (for transparency)
router.get('/dashboard', analyticsController.getDashboardStats);

module.exports = router;
