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
router.get('/city/:city/current', tenureController.getCurrentOfficialForCity);
router.get('/city/:city/history', tenureController.getCityTenureHistory);
router.get('/city/:city/at-date', tenureController.getOfficialAtDate);
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