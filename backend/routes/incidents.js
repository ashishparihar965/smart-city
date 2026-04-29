const express = require('express');
const Incident = require('../models/Incident');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const { createIncidentSchema } = require('../validations/iotSchemas');
const notificationService = require('../services/notificationService');
const router = express.Router();

// GET /api/incidents - Get all incidents
router.get('/', auth, async (req, res, next) => {
  try {
    const { status, priority, type, zone } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (type) filter.type = type;
    if (zone) filter.zone = zone;

    const data = await Incident.find(filter)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 });
    
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/incidents/stats - Get incident statistics
router.get('/stats', auth, async (req, res, next) => {
  try {
    const stats = {
      total: await Incident.countDocuments(),
      open: await Incident.countDocuments({ status: 'open' }),
      inProgress: await Incident.countDocuments({ status: 'in-progress' }),
      resolved: await Incident.countDocuments({ status: 'resolved' }),
      critical: await Incident.countDocuments({ priority: 'critical' }),
      high: await Incident.countDocuments({ priority: 'high' }),
      byType: await Incident.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      byZone: await Incident.aggregate([
        { $group: { _id: '$zone', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents - Create incident
router.post('/', auth, validate(createIncidentSchema), async (req, res, next) => {
  try {
    const incidentData = { ...req.body, createdBy: req.user.id };
    const incident = await Incident.create(incidentData);

    // Create alert for this incident
    const alertType = incident.priority === 'critical' ? 'critical' : 
                      incident.priority === 'high' ? 'danger' : 'warning';
    
    await notificationService.createAlert({
      type: alertType,
      module: 'emergency',
      title: `New Incident: ${incident.title}`,
      message: `${incident.type.toUpperCase()} reported at ${incident.location} (${incident.zone} zone). Priority: ${incident.priority.toUpperCase()}`,
      priority: incident.priority,
      relatedId: incident._id
    });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Created Incident',
      module: 'emergency',
      details: `${incident.type} incident at ${incident.location} - Priority: ${incident.priority}`
    });

    const populated = await Incident.findById(incident._id)
      .populate('createdBy', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});

// PUT /api/incidents/:id - Update incident
router.put('/:id', auth, async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });

    const previousStatus = incident.status;
    Object.assign(incident, req.body);

    // Track resolution
    if (req.body.status === 'resolved' && previousStatus !== 'resolved') {
      incident.resolvedAt = new Date();
      incident.responseTime = Math.round((incident.resolvedAt - incident.createdAt) / 60000); // minutes

      await notificationService.createAlert({
        type: 'info',
        module: 'emergency',
        title: `Incident Resolved: ${incident.title}`,
        message: `${incident.type} incident at ${incident.location} has been resolved. Response time: ${incident.responseTime} minutes.`,
        priority: 'low',
        relatedId: incident._id
      });
    }

    await incident.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: `Updated Incident Status to ${incident.status}`,
      module: 'emergency',
      details: `Incident "${incident.title}" - ${previousStatus} → ${incident.status}`
    });

    const populated = await Incident.findById(incident._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});

// PUT /api/incidents/:id/assign - Assign incident
router.put('/:id/assign', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { assignedTo, status: 'in-progress' },
      { new: true }
    ).populate('assignedTo', 'name email role').populate('createdBy', 'name email');

    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Assigned Incident',
      module: 'emergency',
      details: `Incident "${incident.title}" assigned`
    });

    res.json({ success: true, data: incident });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/incidents/:id - Delete incident (admin only)
router.delete('/:id', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const incident = await Incident.findByIdAndDelete(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Deleted Incident',
      module: 'emergency',
      details: `Deleted incident "${incident.title}"`
    });

    res.json({ success: true, message: 'Incident deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
