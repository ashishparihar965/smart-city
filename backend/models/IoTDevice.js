const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const iotDeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'traffic-sensor',
        'waste-sensor',
        'water-meter',
        'lighting-controller',
        'air-quality-sensor',
        'custom',
      ],
      default: 'custom',
    },
    zone: {
      type: String,
      required: true,
      enum: ['north', 'south', 'east', 'west', 'central'],
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    status: {
      type: String,
      enum: ['offline', 'connecting', 'online', 'error', 'maintenance'],
      default: 'offline',
    },
    healthStatus: {
      type: String,
      enum: ['healthy', 'degraded', 'critical', 'unknown'],
      default: 'unknown',
    },
    connectionType: {
      type: String,
      enum: ['socket', 'http', 'mqtt', 'simulation'],
      default: 'socket',
    },
    connectionKeyHash: {
      type: String,
      required: true,
    },
    firmwareVersion: {
      type: String,
      default: '1.0.0',
      trim: true,
    },
    batteryLevel: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    signalStrength: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    disconnectedAt: {
      type: Date,
      default: null,
    },
    telemetry: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

// Hash connection key before saving
iotDeviceSchema.pre('save', async function (next) {
  if (this.isModified('connectionKeyHash') && !this.connectionKeyHash.startsWith('$2')) {
    this.connectionKeyHash = await bcrypt.hash(this.connectionKeyHash, 10)
  }

  // Auto-compute health status
  if (this.status === 'offline') {
    this.healthStatus = 'unknown'
  } else if (this.batteryLevel < 15 || this.signalStrength < 30) {
    this.healthStatus = 'critical'
  } else if (this.batteryLevel < 30 || this.signalStrength < 50) {
    this.healthStatus = 'degraded'
  } else {
    this.healthStatus = 'healthy'
  }

  next()
})

// Compare connection key
iotDeviceSchema.methods.compareKey = async function (plainKey) {
  return bcrypt.compare(plainKey, this.connectionKeyHash)
}

iotDeviceSchema.index({ zone: 1, status: 1 })
iotDeviceSchema.index({ type: 1, status: 1 })
iotDeviceSchema.index({ lastSeen: -1 })
iotDeviceSchema.index({ healthStatus: 1 })

module.exports = mongoose.model('IoTDevice', iotDeviceSchema)
