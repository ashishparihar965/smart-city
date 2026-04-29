const express = require('express');
const WaterData = require('../models/WaterData');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const waterService = require('../services/waterService');
const router = express.Router();

// GET /api/water - Get all water data
router.get('/', auth, async (req, res, next) => {
  try {
    const { zone, leakDetected } = req.query;
    const filter = {};
    if (zone) filter.zone = zone;
    if (leakDetected !== undefined) filter.leakDetected = leakDetected === 'true';

    const data = await WaterData.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/water/stats - Get water statistics
router.get('/stats', auth, async (req, res, next) => {
  try {
    const stats = await WaterData.aggregate([
      {
        $group: {
          _id: '$zone',
          totalUsage: { $sum: '$usage' },
          avgUsage: { $avg: '$usage' },
          avgPressure: { $avg: '$pressure' },
          avgQuality: { $avg: '$qualityIndex' },
          leaks: { $sum: { $cond: ['$leakDetected', 1, 0] } },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const overall = {
      totalAreas: await WaterData.countDocuments(),
      totalLeaks: await WaterData.countDocuments({ leakDetected: true }),
      criticalLeaks: await WaterData.countDocuments({ leakSeverity: 'critical' }),
      avgQuality: 0
    };

    const allAreas = await WaterData.find();
    if (allAreas.length > 0) {
      overall.avgQuality = Math.round(allAreas.reduce((sum, a) => sum + a.qualityIndex, 0) / allAreas.length);
    }

    res.json({ success: true, data: { zoneStats: stats, overall } });
  } catch (error) {
    next(error);
  }
});

// POST /api/water - Create water data
router.post('/', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const data = new WaterData(req.body);
    await data.save(); // Triggers pre-save leak detection

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Created Water Data',
      module: 'water',
      details: `Added water data for ${data.area} (${data.zone})`
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/water/:id - Update water data
router.put('/:id', auth, async (req, res, next) => {
  try {
    const area = await WaterData.findById(req.params.id);
    if (!area) return res.status(404).json({ success: false, message: 'Water data not found.' });

    Object.assign(area, req.body);
    await area.save(); // Triggers pre-save leak detection

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Updated Water Data',
      module: 'water',
      details: `Updated water data for ${area.area} - Usage: ${area.usage}L`
    });

    res.json({ success: true, data: area });
  } catch (error) {
    next(error);
  }
});

// GET /api/water/analytics/:zone - Get zone analytics
router.get('/analytics/:zone', auth, async (req, res, next) => {
  try {
    const analytics = await waterService.getAnalytics(req.params.zone);
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

// POST /api/water/analyze/:zone - Run water analysis
router.post('/analyze/:zone', auth, async (req, res, next) => {
  try {
    const analysis = await waterService.analyzeUsage(req.params.zone);
    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
