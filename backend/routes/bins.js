const express = require('express');
const Bin = require('../models/Bin');
const CollectionLog = require('../models/CollectionLog');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const socketUtils = require('../utils/socket');
const router = express.Router();

// Helper: broadcast all bins to connected clients
const broadcastBins = async () => {
  try {
    const bins = await Bin.find().sort({ fill_level: -1 }).lean();
    socketUtils.broadcast('bins:update', bins);
  } catch (err) {
    console.error('Broadcast bins error:', err.message);
  }
};

// GET /api/bins — list all bins (all authenticated users)
router.get('/', auth, async (req, res, next) => {
  try {
    const bins = await Bin.find().sort({ fill_level: -1 }).lean();
    res.json({ success: true, data: bins, total: bins.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/bins/stats — summary stats (admin/operator)
router.get('/stats', auth, async (req, res, next) => {
  try {
    const totalBins = await Bin.countDocuments();
    const fullBins = await Bin.countDocuments({ status: 'full' });
    const mediumBins = await Bin.countDocuments({ status: 'medium' });
    const lowBins = await Bin.countDocuments({ status: 'low' });
    const needsCollection = await Bin.countDocuments({ needs_collection: true });

    res.json({
      success: true,
      data: { totalBins, fullBins, mediumBins, lowBins, needsCollection }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/bins/full — bins with fill_level > 80% (operator queue)
router.get('/full', auth, async (req, res, next) => {
  try {
    const bins = await Bin.find({
      $or: [{ fill_level: { $gt: 80 } }, { needs_collection: true }]
    }).sort({ fill_level: -1 }).lean();

    res.json({ success: true, data: bins, total: bins.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/bins — add a new bin (admin only)
router.post('/', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { name, latitude, longitude, capacity } = req.body;

    const bin = await Bin.create({
      name,
      latitude,
      longitude,
      capacity: capacity || null,
      fill_level: 0,
      status: 'low'
    });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Added Waste Bin',
      module: 'waste',
      details: `Added bin "${bin.name}" at (${bin.latitude.toFixed(4)}, ${bin.longitude.toFixed(4)})`
    });

    await broadcastBins();
    res.status(201).json({ success: true, data: bin });
  } catch (error) {
    next(error);
  }
});

// POST /api/bins/:id/mark-collection — admin force-mark for collection
router.post('/:id/mark-collection', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) return res.status(404).json({ success: false, message: 'Bin not found.' });

    bin.needs_collection = true;
    await bin.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Marked Bin for Collection',
      module: 'waste',
      details: `Bin "${bin.name}" marked for collection (fill: ${bin.fill_level}%)`
    });

    await broadcastBins();
    res.json({ success: true, data: bin, message: 'Bin marked for collection.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/bins/:id/collected — operator marks bin as collected
router.post('/:id/collected', auth, async (req, res, next) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) return res.status(404).json({ success: false, message: 'Bin not found.' });

    // Reset bin
    bin.fill_level = 0;
    bin.needs_collection = false;
    bin.last_collected_at = new Date();
    await bin.save();

    // Create collection log
    await CollectionLog.create({
      bin_id: bin._id,
      collected_by: req.user.id,
      collected_at: new Date()
    });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Collected Waste Bin',
      module: 'waste',
      details: `Bin "${bin.name}" collected and reset to 0%`
    });

    await broadcastBins();
    res.json({ success: true, data: bin, message: 'Bin collected and reset.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
