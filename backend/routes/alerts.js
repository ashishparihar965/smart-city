const express = require('express');
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/alerts - Get all alerts
router.get('/', auth, async (req, res, next) => {
  try {
    const { module, type, read, priority, limit = 50 } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (type) filter.type = type;
    if (read !== undefined) filter.read = read === 'true';
    if (priority) filter.priority = priority;

    const data = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    const unreadCount = await Alert.countDocuments({ read: false });

    res.json({ success: true, data, total: data.length, unreadCount });
  } catch (error) {
    next(error);
  }
});

// PUT /api/alerts/:id/read - Mark alert as read
router.put('/:id/read', auth, async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
});

// PUT /api/alerts/:id/acknowledge - Acknowledge alert
router.put('/:id/acknowledge', auth, async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true, acknowledgedBy: req.user.id, read: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
});

// PUT /api/alerts/read-all - Mark all as read
router.put('/read-all', auth, async (req, res, next) => {
  try {
    await Alert.updateMany({ read: false }, { read: true });
    res.json({ success: true, message: 'All alerts marked as read.' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/alerts/:id - Delete alert
router.delete('/:id', auth, async (req, res, next) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Alert deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
