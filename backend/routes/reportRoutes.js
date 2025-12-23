// ============================================
// routes/reportRoutes.js (UPDATED)
// ============================================
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { authorize, authorizeOfficialOrAdmin } = require('../middleware/authorize');

// Public routes
router.get('/', reportController.getAllReports);
router.get('/nearby', reportController.getReportsNearby);
router.get('/:id', reportController.getReportById);

// Protected routes (require authentication)
router.use(protect);
router.post('/', reportController.createReport);
router.post('/bulk', reportController.createBulkReports);
router.patch('/:id/upvote', reportController.upvoteReport);
router.get('/user/my-reports', reportController.getMyReports);
router.patch('/:id/verify-resolution', reportController.verifyResolution);// Reporter verifies resolution
router.patch('/:id/mark-resolved',authorizeOfficialOrAdmin,reportController.markAsResolved);// Official marks as resolved
router.get('/official/my-assigned-reports', reportController.getOfficialAssignedReports);
// Official/Admin only routes
router.patch('/:id/status', authorizeOfficialOrAdmin, reportController.updateReportStatus);
router.patch('/:id/assign', authorize('admin'), reportController.assignReport);
router.delete('/:id', authorize('admin'), reportController.deleteReport);


module.exports = router;