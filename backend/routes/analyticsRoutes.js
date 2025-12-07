// ============================================
// routes/analyticsRoutes.js (UPDATED)
// ============================================
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { authorizeOfficialOrAdmin } = require('../middleware/authorize');

// Public analytics (for transparency)
router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/ward/:ward/stats', analyticsController.getWardStatistics);
router.get('/reports/trends', analyticsController.getReportTrends);
router.get('/heatmap', analyticsController.getHeatmapData);

// Protected analytics
router.use(protect);
router.use(authorizeOfficialOrAdmin);
router.get('/official/:officialId/performance', analyticsController.getOfficialPerformance);

module.exports = router;
