// ============================================
// routes/tenureRoutes.js (COMPLETE WITH ALL ENDPOINTS)
// ============================================
const express = require('express');
const router = express.Router();
const tenureController = require('../controllers/tenureController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// Public routes
router.get('/', tenureController.getAllTenures);
router.get('/stats', tenureController.getTenureStats);
router.get('/ward/:ward/current', tenureController.getCurrentOfficialForWard);
router.get('/ward/:ward/history', tenureController.getWardTenureHistory);
router.get('/ward/:ward/at-date', tenureController.getOfficialAtDate);
router.get('/official/:officialId', tenureController.getOfficialTenures);
router.get('/:id', tenureController.getTenureById);

// Protected routes - Admin only
router.use(protect);
router.use(authorize('admin'));

router.post('/', tenureController.createTenure);
router.patch('/:id', tenureController.updateTenure);
router.patch('/:id/end', tenureController.endTenure);
router.patch('/:id/metrics', tenureController.updateTenureMetrics);
router.delete('/:id', tenureController.deleteTenure);

module.exports = router;