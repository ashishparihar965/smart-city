const express = require('express');
const auth = require('../middleware/auth');
const { getCityHealthData } = require('../services/cityHealthService');
const router = express.Router();

// GET /api/city-health - Get current weather & AQI data
router.get('/', auth, async (req, res, next) => {
  try {
    const data = await getCityHealthData();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
