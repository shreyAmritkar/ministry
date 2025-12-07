// ============================================
// routes/officialRoutes.js
// Official Routes
// ============================================
const express = require('express');
const router = express.Router();
const officialController = require('../controllers/officialController');

// Public routes for transparency
router.get('/:id/scorecard', officialController.getOfficialScorecard);
router.get('/:id/scorecard/comparison', officialController.getOfficialScorecardWithComparison);

module.exports = router;