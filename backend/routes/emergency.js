const express = require('express')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')
const validate = require('../middleware/validate')
const { createEmergencySchema } = require('../validations/iotSchemas')
const emergencyController = require('../controllers/emergencyController')

const router = express.Router()

// POST /api/emergency/sos — Any authenticated user
router.post('/sos', auth, validate(createEmergencySchema), emergencyController.createSOS)

// GET /api/emergency/feed — Admin/Operator
router.get('/feed', auth, roleCheck('admin', 'operator'), emergencyController.getFeed)

// PUT /api/emergency/:id/respond — Admin/Operator
router.put('/:id/respond', auth, roleCheck('admin', 'operator'), emergencyController.respond)

// PUT /api/emergency/:id/resolve — Admin/Operator
router.put('/:id/resolve', auth, roleCheck('admin', 'operator'), emergencyController.resolve)

module.exports = router
