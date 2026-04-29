const express = require('express')
const auth = require('../middleware/auth')
const mapController = require('../controllers/mapController')

const router = express.Router()

// GET /api/map/data — Authenticated users
router.get('/data', auth, mapController.getMapData)

module.exports = router
