const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const Announcement = require('../models/Announcement');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// GET /api/announcements - Citizens view active announcements
router.get('/', auth, async (req, res, next) => {
  try {
    const { type, zone } = req.query;
    const now = new Date();

    const filter = {
      status: 'active',
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ],
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: now } }
      ]
    };

    if (type) filter.type = type;

    let announcements = await Announcement.find(filter)
      .populate('createdBy', 'name department')
      .sort({ priority: -1, createdAt: -1 })
      .limit(50);

    if (zone && zone !== 'all') {
      announcements = announcements.filter(
        (ann) => ann.zones.includes('all') || ann.zones.includes(zone)
      );
    }

    res.json({ success: true, data: announcements });
  } catch (error) {
    next(error);
  }
});

// POST /api/announcements - Admin creates announcement
router.post('/', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { title, message, type, priority, zones, expiresAt, scheduledFor } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required.'
      });
    }

    if (String(title).trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Title must be at least 5 characters long.'
      });
    }

    if (String(message).trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters long.'
      });
    }

    const announcement = new Announcement({
      title,
      message,
      type: type || 'general',
      priority: priority || 'medium',
      zones: zones && zones.length > 0 ? zones : ['all'],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      createdBy: req.user.id
    });

    await announcement.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Created Announcement',
      module: 'system',
      details: `"${title}" — type: ${type}, zones: ${(zones || ['all']).join(', ')}, priority: ${priority}`
    });

    const populated = await Announcement.findById(announcement._id)
      .populate('createdBy', 'name department');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});

// PUT /api/announcements/:id - Admin updates announcement
router.put('/:id', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { title, message, type, priority, zones, status, expiresAt } = req.body;
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    if (title) {
      if (String(title).trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Title must be at least 5 characters long.'
        });
      }
      announcement.title = title;
    }
    if (message) {
      if (String(message).trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Message must be at least 10 characters long.'
        });
      }
      announcement.message = message;
    }
    if (type) announcement.type = type;
    if (priority) announcement.priority = priority;
    if (zones && zones.length > 0) announcement.zones = zones;
    if (status) announcement.status = status;
    if (expiresAt) announcement.expiresAt = new Date(expiresAt);

    await announcement.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Updated Announcement',
      module: 'system',
      details: `"${announcement.title}" — status: ${status || 'unchanged'}`
    });

    const populated = await Announcement.findById(announcement._id)
      .populate('createdBy', 'name department');

    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/announcements/:id - Admin deletes announcement
router.delete('/:id', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const title = announcement.title;
    await Announcement.deleteOne({ _id: req.params.id });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Deleted Announcement',
      module: 'system',
      details: `"${title}"`
    });

    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/announcements/:id/view - Record announcement view
router.post('/:id/view', auth, async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const alreadyViewed = announcement.views.some(
      (view) => view.userId.toString() === req.user.id.toString()
    );

    if (!alreadyViewed) {
      announcement.views.push({ userId: req.user.id });
      announcement.viewCount = announcement.views.length;
      await announcement.save();
    }

    res.json({ success: true, data: { viewCount: announcement.viewCount } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
