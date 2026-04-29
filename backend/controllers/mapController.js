const Complaint = require('../models/Complaint')
const IoTDevice = require('../models/IoTDevice')
const Incident = require('../models/Incident')
const Emergency = require('../models/Emergency')

const mapController = {
  // GET /api/map/data — Aggregated geo data for the live map
  async getMapData(req, res, next) {
    try {
      const { types, zone } = req.query
      const requestedTypes = types ? types.split(',') : ['complaints', 'devices', 'incidents', 'emergencies']
      const zoneFilter = zone ? { zone } : {}
      const result = {}

      if (requestedTypes.includes('complaints')) {
        result.complaints = await Complaint.find({
          ...zoneFilter,
        })
          .select('title description category priority status location coordinates zone deadline createdAt')
          .sort({ createdAt: -1 })
          .limit(500)
      }

      if (requestedTypes.includes('devices')) {
        result.devices = await IoTDevice.find({
          ...zoneFilter,
          'coordinates.lat': { $ne: null },
        })
          .select('deviceId name type status healthStatus location coordinates zone batteryLevel')
          .sort({ updatedAt: -1 })
          .limit(200)
      }

      if (requestedTypes.includes('incidents')) {
        result.incidents = await Incident.find({
          ...zoneFilter,
          'coordinates.lat': { $ne: null },
          status: { $in: ['open', 'in-progress'] },
        })
          .select('title type priority status location coordinates zone createdAt')
          .sort({ createdAt: -1 })
          .limit(100)
      }

      if (requestedTypes.includes('emergencies')) {
        result.emergencies = await Emergency.find({
          ...zoneFilter,
          'coordinates.lat': { $ne: null },
          status: { $in: ['active', 'responding'] },
        })
          .select('title type priority status location coordinates zone createdAt')
          .sort({ createdAt: -1 })
          .limit(50)
      }

      res.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = mapController
