const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const router = express.Router();

// GET /api/logs - Get activity logs
router.get('/', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { module, userId, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (userId) filter.userId = userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const data = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await ActivityLog.countDocuments(filter);

    res.json({ success: true, data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
