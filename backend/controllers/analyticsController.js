const Complaint = require('../models/Complaint')
const trafficService = require('../services/trafficService')
const Bin = require('../models/Bin')
const WaterData = require('../models/WaterData')
const LightingData = require('../models/LightingData')
const Incident = require('../models/Incident')
const Emergency = require('../models/Emergency')
const IoTDevice = require('../models/IoTDevice')
const User = require('../models/User')

const analyticsController = {
  // GET /api/analytics/complaints — Complaint trend data
  async complaintTrends(req, res, next) {
    try {
      const { days = 30 } = req.query
      const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)

      // Daily complaint counts
      const dailyTrend = await Complaint.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])

      // By category
      const byCategory = await Complaint.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])

      // By zone
      const byZone = await Complaint.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$zone', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])

      // By priority
      const byPriority = await Complaint.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ])

      // Resolution time distribution
      const resolutionTimes = await Complaint.aggregate([
        { $match: { status: 'resolved', resolutionTimeMinutes: { $ne: null }, createdAt: { $gte: since } } },
        {
          $bucket: {
            groupBy: '$resolutionTimeMinutes',
            boundaries: [0, 60, 360, 1440, 4320, 10080, Infinity],
            default: 'Other',
            output: { count: { $sum: 1 } },
          },
        },
      ])

      res.json({
        success: true,
        data: { dailyTrend, byCategory, byZone, byPriority, resolutionTimes },
      })
    } catch (error) {
      next(error)
    }
  },

  // GET /api/analytics/modules — Module-level statistics
  async moduleStats(req, res, next) {
    try {
      const trafficSummary = await trafficService.getTrafficSummary()
      const traffic = {
        total: trafficSummary.totalSignals,
        highCongestion: trafficSummary.highDensity,
        incidents: 0,
      }

      const waste = {
        total: await Bin.countDocuments(),
        fullBins: await Bin.countDocuments({ status: 'full' }),
        needsCollection: await Bin.countDocuments({ needs_collection: true }),
      }

      const water = {
        total: await WaterData.countDocuments(),
        leaks: await WaterData.countDocuments({ leakDetected: true }),
        criticalLeaks: await WaterData.countDocuments({ leakSeverity: 'critical' }),
      }

      const lighting = {
        total: await LightingData.countDocuments(),
        faults: await LightingData.countDocuments({ faultDetected: true }),
        onLights: await LightingData.countDocuments({ status: 'on' }),
      }

      const incidents = {
        total: await Incident.countDocuments(),
        open: await Incident.countDocuments({ status: { $in: ['open', 'in-progress'] } }),
        critical: await Incident.countDocuments({ priority: 'critical', status: { $ne: 'resolved' } }),
      }

      const emergencies = {
        total: await Emergency.countDocuments(),
        active: await Emergency.countDocuments({ status: 'active' }),
      }

      const iot = {
        total: await IoTDevice.countDocuments(),
        online: await IoTDevice.countDocuments({ status: 'online' }),
        critical: await IoTDevice.countDocuments({ healthStatus: 'critical' }),
      }

      res.json({
        success: true,
        data: { traffic, waste, water, lighting, incidents, emergencies, iot },
      })
    } catch (error) {
      next(error)
    }
  },

  // GET /api/analytics/performance — Operator performance
  async operatorPerformance(req, res, next) {
    try {
      const operators = await Complaint.aggregate([
        { $match: { assignedTo: { $ne: null } } },
        {
          $group: {
            _id: '$assignedTo',
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            avgResolutionTime: {
              $avg: { $cond: [{ $ne: ['$resolutionTimeMinutes', null] }, '$resolutionTimeMinutes', null] },
            },
            overdue: { $sum: { $cond: ['$isOverdue', 1, 0] } },
          },
        },
        { $sort: { resolved: -1 } },
        { $limit: 20 },
      ])

      // Populate operator names
      for (const op of operators) {
        const user = await User.findById(op._id, 'name email department')
        op.name = user?.name || 'Unknown'
        op.email = user?.email || ''
        op.department = user?.department || ''
        op.avgResolutionTime = Math.round(op.avgResolutionTime || 0)
        op.resolutionRate = op.total > 0 ? Math.round((op.resolved / op.total) * 100) : 0
      }

      res.json({ success: true, data: operators })
    } catch (error) {
      next(error)
    }
  },

  // GET /api/analytics/overview — Public overview stats (for landing page)
  async overview(_req, res, next) {
    try {
      const totalComplaints = await Complaint.countDocuments()
      const resolvedComplaints = await Complaint.countDocuments({ status: 'resolved' })
      const totalDevices = await IoTDevice.countDocuments()
      const onlineDevices = await IoTDevice.countDocuments({ status: 'online' })
      const totalUsers = await User.countDocuments({ isActive: true })
      const totalIncidents = await Incident.countDocuments()
      const resolvedIncidents = await Incident.countDocuments({ status: 'resolved' })

      res.json({
        success: true,
        data: {
          complaints: { total: totalComplaints, resolved: resolvedComplaints },
          devices: { total: totalDevices, online: onlineDevices },
          users: totalUsers,
          incidents: { total: totalIncidents, resolved: resolvedIncidents },
          resolutionRate: totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0,
        },
      })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = analyticsController
