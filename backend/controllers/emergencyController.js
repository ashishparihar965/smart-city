const Emergency = require('../models/Emergency')
const Alert = require('../models/Alert')
const ActivityLog = require('../models/ActivityLog')
const { getIo } = require('../utils/socket')

const emergencyController = {
  // POST /api/emergency/sos — Any authenticated user can raise SOS
  async createSOS(req, res, next) {
    try {
      const emergency = await Emergency.create({
        ...req.body,
        reportedBy: req.user.id,
      })

      // Create critical alert
      await Alert.create({
        type: 'critical',
        module: 'emergency',
        title: `🚨 SOS: ${emergency.title}`,
        message: `${emergency.type.toUpperCase()} reported at ${emergency.location} (${emergency.zone} zone). Immediate response needed.`,
        priority: 'critical',
        zone: emergency.zone,
        relatedId: emergency._id,
      })

      await ActivityLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'Raised Emergency SOS',
        module: 'emergency',
        details: `${emergency.type} at ${emergency.location} — Priority: ${emergency.priority}`,
      })

      const populated = await Emergency.findById(emergency._id).populate('reportedBy', 'name email phone')

      // Real-time broadcast to admins/operators
      const io = getIo()
      if (io) {
        io.emit('emergency_sos', {
          emergency: populated,
          timestamp: new Date().toISOString(),
        })
        io.to(`zone:${emergency.zone}`).emit('zone_emergency', { emergency: populated })
      }

      res.status(201).json({ success: true, data: populated })
    } catch (error) {
      next(error)
    }
  },

  // GET /api/emergency/feed — Real-time emergency feed
  async getFeed(req, res, next) {
    try {
      const { status, zone, limit = 50 } = req.query
      const filter = {}
      if (status) filter.status = status
      if (zone) filter.zone = zone

      const emergencies = await Emergency.find(filter)
        .populate('reportedBy', 'name email phone')
        .populate('respondedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))

      const stats = {
        active: await Emergency.countDocuments({ status: 'active' }),
        responding: await Emergency.countDocuments({ status: 'responding' }),
        resolved: await Emergency.countDocuments({ status: 'resolved' }),
        total: await Emergency.countDocuments(),
      }

      res.json({ success: true, data: emergencies, stats, total: emergencies.length })
    } catch (error) {
      next(error)
    }
  },

  // PUT /api/emergency/:id/respond — Operator responds
  async respond(req, res, next) {
    try {
      const emergency = await Emergency.findById(req.params.id)
      if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found.' })
      if (emergency.status !== 'active') {
        return res.status(400).json({ success: false, message: 'Emergency is already being handled.' })
      }

      emergency.status = 'responding'
      emergency.respondedBy = req.user.id
      emergency.respondedAt = new Date()
      await emergency.save()

      await ActivityLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'Responding to Emergency',
        module: 'emergency',
        details: `Responding to "${emergency.title}" at ${emergency.location}`,
      })

      const populated = await Emergency.findById(emergency._id)
        .populate('reportedBy', 'name email phone')
        .populate('respondedBy', 'name email')

      const io = getIo()
      if (io) {
        io.emit('emergency_update', { emergency: populated, event: 'responding' })
      }

      res.json({ success: true, data: populated })
    } catch (error) {
      next(error)
    }
  },

  // PUT /api/emergency/:id/resolve — Resolve emergency
  async resolve(req, res, next) {
    try {
      const emergency = await Emergency.findById(req.params.id)
      if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found.' })

      emergency.status = 'resolved'
      emergency.resolvedAt = new Date()
      emergency.responseTimeMinutes = Math.round((emergency.resolvedAt - emergency.createdAt) / 60000)
      await emergency.save()

      await Alert.create({
        type: 'info',
        module: 'emergency',
        title: `Emergency Resolved: ${emergency.title}`,
        message: `Resolved by ${req.user.name}. Response time: ${emergency.responseTimeMinutes} minutes.`,
        priority: 'low',
        zone: emergency.zone,
        relatedId: emergency._id,
      })

      await ActivityLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'Resolved Emergency',
        module: 'emergency',
        details: `"${emergency.title}" resolved in ${emergency.responseTimeMinutes} min`,
      })

      const populated = await Emergency.findById(emergency._id)
        .populate('reportedBy', 'name email phone')
        .populate('respondedBy', 'name email')

      const io = getIo()
      if (io) {
        io.emit('emergency_update', { emergency: populated, event: 'resolved' })
      }

      res.json({ success: true, data: populated })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = emergencyController
