const express = require('express')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')
const analyticsController = require('../controllers/analyticsController')

const router = express.Router()

// GET /api/analytics/complaints — Admin only
router.get('/complaints', auth, roleCheck('admin'), analyticsController.complaintTrends)

// GET /api/analytics/modules — Admin/Operator
router.get('/modules', auth, roleCheck('admin', 'operator'), analyticsController.moduleStats)

// GET /api/analytics/performance — Admin only
router.get('/performance', auth, roleCheck('admin'), analyticsController.operatorPerformance)

// GET /api/analytics/overview — Public (for landing page live stats)
router.get('/overview', analyticsController.overview)

module.exports = router
