const express = require('express');
const TrafficData = require('../models/TrafficData');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const trafficService = require('../services/trafficService');
const router = express.Router();

// GET /api/traffic - Get all traffic data
router.get('/', auth, async (req, res, next) => {
  try {
    const { zone, congestionLevel, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (zone) filter.zone = zone;
    if (congestionLevel) filter.congestionLevel = congestionLevel;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const data = await TrafficData.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await TrafficData.countDocuments(filter);

    res.json({ success: true, data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    next(error);
  }
});

// GET /api/traffic/stats - Get traffic statistics
router.get('/stats', auth, async (req, res, next) => {
  try {
    const stats = await TrafficData.aggregate([
      {
        $group: {
          _id: '$zone',
          avgSpeed: { $avg: '$averageSpeed' },
          avgVehicles: { $avg: '$vehicleCount' },
          highCongestion: { $sum: { $cond: [{ $eq: ['$congestionLevel', 'high'] }, 1, 0] } },
          mediumCongestion: { $sum: { $cond: [{ $eq: ['$congestionLevel', 'medium'] }, 1, 0] } },
          lowCongestion: { $sum: { $cond: [{ $eq: ['$congestionLevel', 'low'] }, 1, 0] } },
          incidents: { $sum: { $cond: ['$incidentReported', 1, 0] } },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const overall = {
      totalLocations: await TrafficData.countDocuments(),
      highCongestion: await TrafficData.countDocuments({ congestionLevel: 'high' }),
      activeIncidents: await TrafficData.countDocuments({ incidentReported: true }),
      emergencyOverrides: await TrafficData.countDocuments({ emergencyOverride: true })
    };

    res.json({ success: true, data: { zoneStats: stats, overall } });
  } catch (error) {
    next(error);
  }
});

// POST /api/traffic - Create traffic data
router.post('/', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const data = await TrafficData.create(req.body);

    // Run prediction after new data
    const predicted = await trafficService.predictCongestion(data.zone);
    data.predictedCongestion = predicted;
    await data.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Created Traffic Data',
      module: 'traffic',
      details: `Added traffic data for ${data.location} (${data.zone})`
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/traffic/:id - Update traffic data
router.put('/:id', auth, async (req, res, next) => {
  try {
    const data = await TrafficData.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Traffic data not found.' });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Updated Traffic Data',
      module: 'traffic',
      details: `Updated traffic data at ${data.location}`
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/traffic/:id/report-incident - Report traffic incident
router.post('/:id/report-incident', auth, async (req, res, next) => {
  try {
    const { incidentType } = req.body;
    const data = await TrafficData.findByIdAndUpdate(
      req.params.id,
      { incidentReported: true, incidentType: incidentType || 'accident' },
      { new: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Traffic data not found.' });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Reported Traffic Incident',
      module: 'traffic',
      details: `Reported ${incidentType || 'accident'} at ${data.location}`
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/traffic/:id/emergency-override - Emergency vehicle override
router.post('/:id/emergency-override', auth, async (req, res, next) => {
  try {
    const data = await trafficService.activateEmergencyOverride(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Traffic data not found.' });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Emergency Override Activated',
      module: 'traffic',
      details: `Override at ${data.location} for emergency vehicle`
    });

    res.json({ success: true, data, message: 'Emergency override activated.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/traffic/:id/clear-override - Clear emergency override
router.post('/:id/clear-override', auth, async (req, res, next) => {
  try {
    const data = await trafficService.deactivateEmergencyOverride(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Traffic data not found.' });

    res.json({ success: true, data, message: 'Emergency override cleared.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/traffic/predict/:zone - Get prediction for zone
router.get('/predict/:zone', auth, async (req, res, next) => {
  try {
    const prediction = await trafficService.predictCongestion(req.params.zone);
    res.json({ success: true, data: { zone: req.params.zone, predictedCongestion: prediction } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
