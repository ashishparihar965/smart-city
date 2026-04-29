const express = require('express');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { createComplaintSchema, assignComplaintSchema, updateStatusSchema } = require('../validations/complaintSchemas');
const { getIo } = require('../utils/socket');
const router = express.Router();

const parseCoordinateValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCoordinates = (req, res, next) => {
  if (typeof req.body.coordinates === 'string') {
    try {
      req.body.coordinates = JSON.parse(req.body.coordinates);
    } catch (error) {
      req.body.coordinates = {};
    }
  }

  const lat = parseCoordinateValue(req.body.lat ?? req.body.coordinates?.lat);
  const lng = parseCoordinateValue(req.body.lng ?? req.body.coordinates?.lng);

  if (lat !== null || lng !== null) {
    req.body.coordinates = { lat, lng };
  }

  next();
};

// ──────────────────────────────────────────────
// GET /api/complaints — role-scoped listing
// ──────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const { status, priority, category, zone } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (zone) filter.zone = zone;

    // RBAC scoping
    if (req.user.role === 'user') {
      filter.createdBy = req.user.id;           // citizens see only their own
    } else if (req.user.role === 'operator') {
      filter.assignedTo = req.user.id;           // operators see only assigned
    }
    // admin sees all — no extra filter

    const data = await Complaint.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email department')
      .sort({ createdAt: -1 });

    res.json({ success: true, data, total: data.length });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────
// GET /api/complaints/stats — analytics (admin)
// ──────────────────────────────────────────────
router.get('/stats', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const total = await Complaint.countDocuments();
    const open = await Complaint.countDocuments({ status: 'open' });
    const inProgress = await Complaint.countDocuments({ status: 'in-progress' });
    const resolved = await Complaint.countDocuments({ status: 'resolved' });
    const overdue = await Complaint.countDocuments({ isOverdue: true, status: { $ne: 'resolved' } });
    const highPriority = await Complaint.countDocuments({ priority: 'high', status: { $ne: 'resolved' } });

    // Average resolution time
    const resolvedComplaints = await Complaint.find({ status: 'resolved', resolutionTimeMinutes: { $ne: null } });
    const avgResolutionTime = resolvedComplaints.length > 0
      ? Math.round(resolvedComplaints.reduce((s, c) => s + c.resolutionTimeMinutes, 0) / resolvedComplaints.length)
      : 0;

    // By category
    const byCategory = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // By status
    const byStatus = [
      { _id: 'open', count: open },
      { _id: 'in-progress', count: inProgress },
      { _id: 'resolved', count: resolved }
    ];

    // Operator performance: count resolved per operator
    const operatorPerformance = await Complaint.aggregate([
      { $match: { status: 'resolved', assignedTo: { $ne: null } } },
      { $group: {
        _id: '$assignedTo',
        resolved: { $sum: 1 },
        avgTime: { $avg: '$resolutionTimeMinutes' }
      }},
      { $sort: { resolved: -1 } },
      { $limit: 10 }
    ]);
    // Populate operator names
    for (const op of operatorPerformance) {
      const user = await User.findById(op._id, 'name email');
      op.name = user ? user.name : 'Unknown';
      op.avgTime = Math.round(op.avgTime || 0);
    }

    res.json({
      success: true,
      data: { total, open, inProgress, resolved, overdue, highPriority, avgResolutionTime, byCategory, byStatus, operatorPerformance }
    });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────
// GET /api/complaints/suggest-operator?category=&zone=
// Smart assignment suggestion
// ──────────────────────────────────────────────
router.get('/suggest-operator', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { category, zone } = req.query;
    // Find operators in the matching department with fewest open assignments
    const deptMap = { traffic: 'traffic', water: 'water', waste: 'waste', lighting: 'lighting', emergency: 'emergency' };
    const dept = deptMap[category] || 'general';

    let operators = await User.find({ role: 'operator', department: dept, isActive: true });
    if (operators.length === 0) {
      operators = await User.find({ role: 'operator', isActive: true }); // fallback
    }

    // Count current open assignments for each
    const suggestions = [];
    for (const op of operators) {
      const openCount = await Complaint.countDocuments({ assignedTo: op._id, status: { $ne: 'resolved' } });
      suggestions.push({ id: op._id, name: op.name, email: op.email, department: op.department, openAssignments: openCount });
    }
    suggestions.sort((a, b) => a.openAssignments - b.openAssignments);

    res.json({ success: true, data: suggestions });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────
// GET /api/complaints/:id — single complaint
// ──────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email department');
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // RBAC check
    if (req.user.role === 'user' && complaint.createdBy._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your complaint.' });
    }
    if (req.user.role === 'operator' && (!complaint.assignedTo || complaint.assignedTo._id.toString() !== req.user.id.toString())) {
      return res.status(403).json({ success: false, message: 'Not assigned to you.' });
    }

    res.json({ success: true, data: complaint });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────
// POST /api/complaints — create (user only, with optional image)
// ──────────────────────────────────────────────
router.post('/', auth, roleCheck('user'), upload.single('image'), normalizeCoordinates, validate(createComplaintSchema), async (req, res, next) => {
  try {
    const { title, description, category, location, zone, priority, coordinates } = req.body;

    // Parse coordinates if stringified
    const coords = coordinates || {};

    const complaint = new Complaint({
      title, description, category, location,
      zone: zone || 'central',
      priority: priority || 'medium',
      createdBy: req.user.id,
      coordinates: coords,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    });
    await complaint.save();

    // Create alert for admin
    await Alert.create({
      type: category === 'emergency' ? 'critical' : 'info',
      module: category,
      title: `New Complaint: ${title}`,
      message: `Citizen filed a ${category} complaint at ${location}. Priority: ${complaint.priority}.`,
      priority: complaint.priority,
      zone: zone || 'central'
    });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Filed Complaint',
      module: 'complaints',
      details: `"${title}" — category: ${category}, priority: ${complaint.priority}`
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('createdBy', 'name email');

    // Emit real-time event
    const io = getIo();
    if (io) io.emit('complaint_created', { title: complaint.title, category: complaint.category, priority: complaint.priority });

    res.status(201).json({ success: true, data: populated });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────
// PUT /api/complaints/:id/assign — admin assigns
// ──────────────────────────────────────────────
router.put('/:id/assign', auth, roleCheck('admin'), validate(assignComplaintSchema), async (req, res, next) => {
  try {
    const { assignedTo, priority, deadline } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    complaint.assignedTo = assignedTo;
    if (priority) complaint.priority = priority;
    if (deadline) complaint.deadline = new Date(deadline);
    if (complaint.status === 'open') complaint.status = 'in-progress';
    await complaint.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Assigned Complaint',
      module: 'complaints',
      details: `Complaint "${complaint.title}" assigned to operator.`
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email department');

    // Emit real-time event
    const io = getIo();
    if (io) io.emit('complaint_assigned', { title: complaint.title, assignedTo: populated.assignedTo?.name });

    res.json({ success: true, data: populated });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────
// PUT /api/complaints/:id/status — operator updates
// ──────────────────────────────────────────────
router.put('/:id/status', auth, roleCheck('operator'), validate(updateStatusSchema), async (req, res, next) => {
  try {
    const { status, remark } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // Verify operator is assigned
    if (!complaint.assignedTo || complaint.assignedTo.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'This complaint is not assigned to you.' });
    }

    // Enforce status flow
    const validTransitions = { 'open': 'in-progress', 'in-progress': 'resolved' };
    if (status && validTransitions[complaint.status] !== status) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${complaint.status}" to "${status}". Next valid: "${validTransitions[complaint.status]}".`
      });
    }

    const previousStatus = complaint.status;
    if (status) complaint.status = status;
    if (remark) {
      complaint.remarks.push({ text: remark, addedBy: req.user.id, addedByName: req.user.name });
    }

    // Record in status history
    if (status && status !== previousStatus) {
      complaint.statusHistory.push({
        status,
        changedBy: req.user.id,
        changedByName: req.user.name,
        remark: remark || ''
      });
    }

    await complaint.save();

    if (status === 'resolved') {
      await Alert.create({
        type: 'info',
        module: complaint.category,
        title: `Complaint Resolved: ${complaint.title}`,
        message: `Resolved by ${req.user.name} in ${complaint.resolutionTimeMinutes || 0} minutes.`,
        priority: 'low',
        zone: complaint.zone
      });
    }

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: `Updated Complaint to ${complaint.status}`,
      module: 'complaints',
      details: `"${complaint.title}" — ${remark || 'no remark'}`
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email department');

    // Emit real-time event
    const io = getIo();
    if (io) {
      if (status === 'resolved') {
        io.emit('complaint_resolved', { title: complaint.title });
      } else {
        io.emit('complaint_updated', { title: complaint.title, status: complaint.status });
      }
    }

    res.json({ success: true, data: populated });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────
// GET /api/complaints/overdue/check — refresh overdue flags
// ──────────────────────────────────────────────
router.post('/overdue/check', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const now = new Date();
    const result = await Complaint.updateMany(
      { deadline: { $lt: now }, status: { $ne: 'resolved' }, isOverdue: false },
      { $set: { isOverdue: true } }
    );
    res.json({ success: true, message: `${result.modifiedCount} complaints marked overdue.` });
  } catch (error) { next(error); }
});

module.exports = router;
