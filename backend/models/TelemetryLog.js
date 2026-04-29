const mongoose = require('mongoose')

const telemetryLogSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
  },
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IoTDevice',
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  batteryLevel: { type: Number, default: null },
  signalStrength: { type: Number, default: null },
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

// TTL: auto-delete after 30 days
telemetryLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })
// Compound index for device + time range queries
telemetryLogSchema.index({ deviceId: 1, timestamp: -1 })

module.exports = mongoose.model('TelemetryLog', telemetryLogSchema)
