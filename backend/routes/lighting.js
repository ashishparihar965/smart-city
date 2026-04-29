const express = require('express');
const LightingData = require('../models/LightingData');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const lightingService = require('../services/lightingService');
const router = express.Router();

// GET /api/lighting - Get all lighting data
router.get('/', auth, async (req, res, next) => {
  try {
    const { zone, status, faultDetected } = req.query;
    const filter = {};
    if (zone) filter.zone = zone;
    if (status) filter.status = status;
    if (faultDetected !== undefined) filter.faultDetected = faultDetected === 'true';

    const data = await LightingData.find(filter).sort({ zone: 1, lightId: 1 });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/lighting/stats - Get lighting statistics
router.get('/stats', auth, async (req, res, next) => {
  try {
    const energyStats = await lightingService.getEnergyStats();
    
    const overall = {
      totalLights: await LightingData.countDocuments(),
      onLights: await LightingData.countDocuments({ status: 'on' }),
      faultyLights: await LightingData.countDocuments({ faultDetected: true }),
      autoModeLights: await LightingData.countDocuments({ autoMode: true })
    };

    res.json({ success: true, data: { zoneStats: energyStats, overall } });
  } catch (error) {
    next(error);
  }
});

// POST /api/lighting - Create lighting data
router.post('/', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const data = await LightingData.create(req.body);

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Created Light',
      module: 'lighting',
      details: `Added light ${data.lightId} at ${data.location}`
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/lighting/:id/toggle - Toggle light on/off
router.put('/:id/toggle', auth, async (req, res, next) => {
  try {
    const light = await LightingData.findById(req.params.id);
    if (!light) return res.status(404).json({ success: false, message: 'Light not found.' });

    light.status = light.status === 'on' ? 'off' : 'on';
    light.autoMode = false; // Manual toggle disables auto mode
    await light.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: `Toggled Light ${light.status.toUpperCase()}`,
      module: 'lighting',
      details: `Light ${light.lightId} at ${light.location} manually turned ${light.status}`
    });

    res.json({ success: true, data: light });
  } catch (error) {
    next(error);
  }
});

// PUT /api/lighting/:id/auto-mode - Toggle auto mode
router.put('/:id/auto-mode', auth, async (req, res, next) => {
  try {
    const light = await LightingData.findById(req.params.id);
    if (!light) return res.status(404).json({ success: false, message: 'Light not found.' });

    light.autoMode = !light.autoMode;
    await light.save();

    res.json({ success: true, data: light });
  } catch (error) {
    next(error);
  }
});

// POST /api/lighting/:id/report-fault - Report a fault
router.post('/:id/report-fault', auth, async (req, res, next) => {
  try {
    const { faultType } = req.body;
    const light = await LightingData.findById(req.params.id);
    if (!light) return res.status(404).json({ success: false, message: 'Light not found.' });

    light.faultDetected = true;
    light.faultType = faultType || 'power-issue';
    await light.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Reported Light Fault',
      module: 'lighting',
      details: `Fault ${faultType} reported for light ${light.lightId}`
    });

    res.json({ success: true, data: light });
  } catch (error) {
    next(error);
  }
});

// POST /api/lighting/:id/resolve-fault - Resolve a fault
router.post('/:id/resolve-fault', auth, async (req, res, next) => {
  try {
    const light = await LightingData.findById(req.params.id);
    if (!light) return res.status(404).json({ success: false, message: 'Light not found.' });

    light.faultDetected = false;
    light.faultType = 'none';
    light.lastMaintenanceDate = new Date();
    await light.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Resolved Light Fault',
      module: 'lighting',
      details: `Fault resolved for light ${light.lightId} at ${light.location}`
    });

    res.json({ success: true, data: light, message: 'Fault resolved.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/lighting/auto-toggle - Run auto toggle for all lights
router.post('/auto-toggle', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const result = await lightingService.autoToggleLights();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
