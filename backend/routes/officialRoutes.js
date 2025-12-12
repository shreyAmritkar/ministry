// ============================================
// routes/officialRoutes.js
// Official Routes
// ============================================
const express = require('express');
const router = express.Router();
const officialController = require('../controllers/officialController');
const {protect} = require("../middleware/auth");

// Public routes for transparency
router.get('/:id/scorecard', officialController.getOfficialScorecard);
router.get('/:id/scorecard/comparison', officialController.getOfficialScorecardWithComparison);
router.use(protect);
router.get('/my-scorecard', officialController.getAuthenticatedOfficialScorecard);
module.exports = router;