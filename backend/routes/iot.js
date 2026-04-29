const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')
const validate = require('../middleware/validate')
const { registerDeviceSchema } = require('../validations/iotSchemas')
const IoTDevice = require('../models/IoTDevice')
const TelemetryLog = require('../models/TelemetryLog')
const ActivityLog = require('../models/ActivityLog')
const { getIo } = require('../utils/socket')

const router = express.Router()

const normalizeDeviceId = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const clamp = (value, min, max) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return Math.min(max, Math.max(min, Math.round(numberValue)))
}

const pickTelemetry = (payload = {}) => {
  const telemetry = {}
  for (const field of [
    'temperature', 'humidity', 'pressure', 'value', 'load', 'message',
    'vehicleCount', 'averageSpeed', 'congestionLevel',
    'fillLevel', 'fillStatus', 'missedPickup',
    'usage', 'leakDetected', 'brightness', 'faultDetected', 'faultType',
  ]) {
    if (payload[field] !== undefined && payload[field] !== null) {
      telemetry[field] = payload[field]
    }
  }
  return telemetry
}

const serializeDevice = (device) => ({
  id: device._id,
  deviceId: device.deviceId,
  name: device.name,
  type: device.type,
  zone: device.zone,
  location: device.location,
  coordinates: device.coordinates,
  status: device.status,
  healthStatus: device.healthStatus,
  connectionType: device.connectionType,
  firmwareVersion: device.firmwareVersion,
  batteryLevel: device.batteryLevel,
  signalStrength: device.signalStrength,
  lastSeen: device.lastSeen,
  connectedAt: device.connectedAt,
  disconnectedAt: device.disconnectedAt,
  telemetry: device.telemetry,
  metadata: device.metadata,
  createdAt: device.createdAt,
  updatedAt: device.updatedAt,
})

const emitDeviceEvent = (event, device, extra = {}) => {
  const io = getIo()
  if (!io || !device) return

  const payload = {
    event,
    device: serializeDevice(device),
    timestamp: new Date().toISOString(),
    ...extra,
  }

  io.to('iot').emit('iot_device_event', payload)
  io.to(`device:${device.deviceId}`).emit('iot_device_event', payload)
}

const verifyDeviceKey = async (device, payload = {}, headers = {}) => {
  const providedKey = String(
    payload.connectionKey || payload.deviceKey || headers['x-device-key'] || ''
  ).trim()
  if (!providedKey) return false
  return device.compareKey(providedKey)
}

const buildDeviceSummary = async () => {
  const [total, online, offline, maintenance, lowBattery, critical, byType] =
    await Promise.all([
      IoTDevice.countDocuments(),
      IoTDevice.countDocuments({ status: 'online' }),
      IoTDevice.countDocuments({ status: 'offline' }),
      IoTDevice.countDocuments({ status: 'maintenance' }),
      IoTDevice.countDocuments({ batteryLevel: { $lt: 20 } }),
      IoTDevice.countDocuments({ healthStatus: 'critical' }),
      IoTDevice.aggregate([
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            online: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
            offline: { $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ])

  return { total, online, offline, maintenance, lowBattery, critical, byType }
}

// GET /api/iot/summary
router.get('/summary', auth, roleCheck('admin', 'operator'), async (_req, res, next) => {
  try {
    const summary = await buildDeviceSummary()
    res.json({ success: true, data: summary })
  } catch (error) {
    next(error)
  }
})

// GET /api/iot/devices
router.get('/devices', auth, roleCheck('admin', 'operator'), async (req, res, next) => {
  try {
    const { zone, type, status, healthStatus } = req.query
    const filter = {}
    if (zone) filter.zone = zone
    if (type) filter.type = type
    if (status) filter.status = status
    if (healthStatus) filter.healthStatus = healthStatus

    const devices = await IoTDevice.find(filter).sort({ updatedAt: -1 })
    res.json({
      success: true,
      data: devices.map(serializeDevice),
      total: devices.length,
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/iot/devices/:deviceId
router.get('/devices/:deviceId', auth, roleCheck('admin', 'operator'), async (req, res, next) => {
  try {
    const device = await IoTDevice.findOne({
      deviceId: normalizeDeviceId(req.params.deviceId),
    })
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' })
    }
    res.json({ success: true, data: serializeDevice(device) })
  } catch (error) {
    next(error)
  }
})

// GET /api/iot/devices/:deviceId/telemetry — Telemetry history
router.get('/devices/:deviceId/telemetry', auth, roleCheck('admin', 'operator'), async (req, res, next) => {
  try {
    const { hours = 24, limit = 200 } = req.query
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000)

    const logs = await TelemetryLog.find({
      deviceId: normalizeDeviceId(req.params.deviceId),
      timestamp: { $gte: since },
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))

    res.json({ success: true, data: logs, total: logs.length })
  } catch (error) {
    next(error)
  }
})

// POST /api/iot/devices/register
router.post('/devices/register', auth, roleCheck('admin', 'operator'), validate(registerDeviceSchema), async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim()
    const type = String(req.body.type || 'custom').trim().toLowerCase()
    const zone = String(req.body.zone || '').trim().toLowerCase()
    const location = String(req.body.location || '').trim()
    const firmwareVersion = String(req.body.firmwareVersion || '1.0.0').trim()
    const connectionType = String(req.body.connectionType || 'socket').trim().toLowerCase()
    const requestedId = normalizeDeviceId(req.body.deviceId)
    const generatedId = `DEV-${Date.now().toString(36).toUpperCase()}`
    const deviceId = requestedId || generatedId
    const rawKey = String(req.body.connectionKey || crypto.randomBytes(8).toString('hex')).trim()

    const device = await IoTDevice.create({
      deviceId,
      name: name || deviceId,
      type,
      zone,
      location,
      coordinates: req.body.coordinates || {},
      firmwareVersion,
      connectionType,
      connectionKeyHash: rawKey, // Will be hashed by pre-save hook
      status: 'offline',
      telemetry: pickTelemetry(req.body.telemetry),
      batteryLevel: clamp(req.body.batteryLevel, 0, 100) ?? 100,
      signalStrength: clamp(req.body.signalStrength, 0, 100) ?? 100,
      metadata: req.body.metadata || {},
    })

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Registered IoT Device',
      module: 'iot',
      details: `Registered ${device.name} (${device.deviceId}) in ${device.zone}`,
    })

    emitDeviceEvent('device_registered', device)

    res.status(201).json({
      success: true,
      data: serializeDevice(device),
      connectionKey: rawKey, // Return plaintext key only once on registration
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/iot/devices/:deviceId/connect
router.post('/devices/:deviceId/connect', async (req, res, next) => {
  try {
    const device = await IoTDevice.findOne({
      deviceId: normalizeDeviceId(req.params.deviceId),
    })
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' })
    }
    const keyValid = await verifyDeviceKey(device, req.body, req.headers)
    if (!keyValid) {
      return res.status(403).json({ success: false, message: 'Invalid device key.' })
    }

    device.status = 'online'
    device.connectionType = String(req.body.connectionType || device.connectionType || 'socket').trim().toLowerCase()
    device.connectedAt = device.connectedAt || new Date()
    device.disconnectedAt = null
    device.lastSeen = new Date()
    device.batteryLevel = clamp(req.body.batteryLevel, 0, 100) ?? device.batteryLevel
    device.signalStrength = clamp(req.body.signalStrength, 0, 100) ?? device.signalStrength
    device.telemetry = {
      ...(device.telemetry || {}),
      ...pickTelemetry(req.body.telemetry),
      message: req.body.message || device.telemetry?.message || 'Connected',
    }
    await device.save()

    emitDeviceEvent('device_connected', device)
    res.json({ success: true, data: serializeDevice(device) })
  } catch (error) {
    next(error)
  }
})

// POST /api/iot/devices/:deviceId/heartbeat
router.post('/devices/:deviceId/heartbeat', async (req, res, next) => {
  try {
    const device = await IoTDevice.findOne({
      deviceId: normalizeDeviceId(req.params.deviceId),
    })
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' })
    }
    const keyValid = await verifyDeviceKey(device, req.body, req.headers)
    if (!keyValid) {
      return res.status(403).json({ success: false, message: 'Invalid device key.' })
    }

    device.status = 'online'
    device.batteryLevel = clamp(req.body.batteryLevel, 0, 100) ?? device.batteryLevel
    device.signalStrength = clamp(req.body.signalStrength, 0, 100) ?? device.signalStrength
    device.telemetry = {
      ...(device.telemetry || {}),
      ...pickTelemetry(req.body.telemetry),
    }
    device.lastSeen = new Date()
    await device.save()

    emitDeviceEvent('device_heartbeat', device)
    res.json({ success: true, data: serializeDevice(device) })
  } catch (error) {
    next(error)
  }
})

// POST /api/iot/devices/:deviceId/telemetry
router.post('/devices/:deviceId/telemetry', async (req, res, next) => {
  try {
    const device = await IoTDevice.findOne({
      deviceId: normalizeDeviceId(req.params.deviceId),
    })
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' })
    }
    const keyValid = await verifyDeviceKey(device, req.body, req.headers)
    if (!keyValid) {
      return res.status(403).json({ success: false, message: 'Invalid device key.' })
    }

    const telemetry = pickTelemetry(req.body.telemetry)
    if (req.body.batteryLevel !== undefined) {
      device.batteryLevel = clamp(req.body.batteryLevel, 0, 100) ?? device.batteryLevel
      telemetry.batteryLevel = device.batteryLevel
    }
    if (req.body.signalStrength !== undefined) {
      device.signalStrength = clamp(req.body.signalStrength, 0, 100) ?? device.signalStrength
      telemetry.signalStrength = device.signalStrength
    }

    device.telemetry = {
      ...(device.telemetry || {}),
      ...telemetry,
      message: req.body.message || device.telemetry?.message || 'Telemetry updated',
    }
    device.status = req.body.status || 'online'
    device.lastSeen = new Date()
    await device.save()

    // Store telemetry in time-series log
    await TelemetryLog.create({
      deviceId: device.deviceId,
      device: device._id,
      data: telemetry,
      batteryLevel: device.batteryLevel,
      signalStrength: device.signalStrength,
    }).catch((err) => console.error('Telemetry log error:', err.message))

    emitDeviceEvent('device_telemetry', device, { telemetry: device.telemetry })
    res.json({ success: true, data: serializeDevice(device) })
  } catch (error) {
    next(error)
  }
})

// POST /api/iot/devices/:deviceId/disconnect
router.post('/devices/:deviceId/disconnect', async (req, res, next) => {
  try {
    const device = await IoTDevice.findOne({
      deviceId: normalizeDeviceId(req.params.deviceId),
    })
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' })
    }
    const keyValid = await verifyDeviceKey(device, req.body, req.headers)
    if (!keyValid) {
      return res.status(403).json({ success: false, message: 'Invalid device key.' })
    }

    device.status = 'offline'
    device.lastSeen = new Date()
    device.disconnectedAt = new Date()
    await device.save()

    emitDeviceEvent('device_disconnected', device)
    res.json({ success: true, data: serializeDevice(device) })
  } catch (error) {
    next(error)
  }
})

module.exports = router
