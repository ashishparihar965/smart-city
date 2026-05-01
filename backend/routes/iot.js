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

// ── Log every IoT API request ──
router.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: false })
  const ip = req.ip || req.connection?.remoteAddress || '?'
  const user = req.user ? `${req.user.name}(${req.user.role})` : 'anonymous'
  const deviceKey = req.headers['x-device-key'] ? `key:${req.headers['x-device-key'].slice(0, 6)}...` : ''
  const bodySnippet = req.body && Object.keys(req.body).length > 0
    ? ` body:${JSON.stringify(req.body).slice(0, 120)}`
    : ''
  console.log(`📡 [IoT ${timestamp}] ${req.method} ${req.originalUrl} | ip:${ip} | ${deviceKey || user}${bodySnippet}`)
  next()
})

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
    // ESP32 sensor fields
    'mq135', 'ldr', 'voltage', 'distance', 'ir1', 'ir2',
    'soil_moisture', 'gas', 'sound', 'rain', 'motion', 'aqi',
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

// ═══════════════════════════════════════════════════════
// POST /api/iot/esp32/data — ESP32 Data Ingestion Endpoint
// ═══════════════════════════════════════════════════════
// Public endpoint for ESP32 boards to send sensor data.
// Authenticates via x-device-key header.
//
// Expected JSON:
// {
//   "esp32_id": "ESP32_001",
//   "location": "SmartCity_Zone_A",
//   "data": {
//     "temperature": 30.5,
//     "humidity": 60,
//     "mq135": 1500,
//     "ldr": 200,
//     "voltage": 12.4,
//     "distance": 25,
//     "ir1": 0,
//     "ir2": 1
//   }
// }
router.post('/esp32/data', async (req, res, next) => {
  try {
    const { esp32_id, location, data } = req.body

    if (!esp32_id) {
      return res.status(400).json({ success: false, message: 'esp32_id is required.' })
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'data object is required.' })
    }

    // Find device by deviceId (normalized)
    const deviceId = normalizeDeviceId(esp32_id)
    const device = await IoTDevice.findOne({ deviceId })
    if (!device) {
      return res.status(404).json({
        success: false,
        message: `Device "${esp32_id}" not registered. Register it first in the admin panel.`
      })
    }

    // Authenticate via x-device-key header
    const keyValid = await verifyDeviceKey(device, req.body, req.headers)
    if (!keyValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing device key. Send your API key in the x-device-key header.'
      })
    }

    // Build telemetry from ALL data fields (auto-detect sensors)
    const telemetry = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        telemetry[key] = value
      }
    }

    // Update device
    device.status = 'online'
    device.lastSeen = new Date()
    device.connectedAt = device.connectedAt || new Date()
    device.disconnectedAt = null
    device.telemetry = {
      ...(device.telemetry || {}),
      ...telemetry,
    }
    if (location) {
      device.location = location
    }
    await device.save()

    // Store in telemetry log
    await TelemetryLog.create({
      deviceId: device.deviceId,
      device: device._id,
      data: telemetry,
      batteryLevel: device.batteryLevel,
      signalStrength: device.signalStrength,
    }).catch((err) => console.error('Telemetry log error:', err.message))

    // Broadcast to dashboard
    emitDeviceEvent('device_telemetry', device, { telemetry: device.telemetry })

    const io = getIo()
    const integrations = []

    // ═══ INTEGRATION 1: Ultrasonic Distance → Bin Fill Level ═══
    // Empty bin = ~7.5 cm (max distance), Full bin = 0 cm
    if (data.distance !== undefined && data.distance !== null) {
      try {
        const Bin = require('../models/Bin')
        const BIN_EMPTY_DISTANCE = 7.5 // cm when bin is fully empty
        const rawDistance = Number(data.distance)
        const clampedDistance = Math.max(0, Math.min(BIN_EMPTY_DISTANCE, rawDistance))
        const fillLevel = Math.round(((BIN_EMPTY_DISTANCE - clampedDistance) / BIN_EMPTY_DISTANCE) * 100)

        // Find the nearest bin to this device's coordinates, or any bin in same zone
        let bin = null
        if (device.coordinates?.lat && device.coordinates?.lng) {
          // Find nearest bin within 500m
          const bins = await Bin.find().lean()
          let minDist = Infinity
          for (const b of bins) {
            const dLat = b.latitude - device.coordinates.lat
            const dLng = b.longitude - device.coordinates.lng
            const dist = Math.sqrt(dLat * dLat + dLng * dLng)
            if (dist < minDist) { minDist = dist; bin = b }
          }
          // ~0.005 degrees ≈ 500m
          if (minDist > 0.005) bin = null
        }

        // Fallback: get first bin matching device zone
        if (!bin) {
          bin = await Bin.findOne().sort({ updated_at: -1 }).lean()
        }

        if (bin) {
          const binDoc = await Bin.findById(bin._id)
          binDoc.fill_level = fillLevel
          await binDoc.save() // triggers pre-save for status
          integrations.push(`bin:${binDoc.name}→${fillLevel}%`)

          // Broadcast bin update
          if (io) {
            const allBins = await Bin.find().sort({ fill_level: -1 }).lean()
            io.emit('bins:update', allBins)
          }
          console.log(`🗑️ ESP32 → Bin "${binDoc.name}" fill: ${fillLevel}% (distance: ${rawDistance}cm)`)
        }
      } catch (binErr) {
        console.error('ESP32→Bin integration error:', binErr.message)
      }
    }

    // ═══ INTEGRATION 2: Temp/Humidity/MQ135/LDR → Weather Zone Data ═══
    if (data.temperature !== undefined || data.humidity !== undefined || data.mq135 !== undefined) {
      try {
        const WeatherData = require('../models/WeatherData')
        const mq135ToAqi = (raw) => {
          if (raw <= 500) return Math.round((raw / 500) * 50)
          if (raw <= 1500) return Math.round(50 + ((raw - 500) / 1000) * 100)
          return Math.round(150 + ((raw - 1500) / 2500) * 350)
        }

        const ldrRaw = data.ldr !== undefined ? Number(data.ldr) : null
        const weatherReading = {
          esp32_id: device.deviceId,
          zone: device.zone || location || 'central',
          temperature: data.temperature !== undefined ? Number(data.temperature) : null,
          humidity: data.humidity !== undefined ? Number(data.humidity) : null,
          aqi: data.mq135 !== undefined ? mq135ToAqi(Number(data.mq135)) : null,
          light_level: ldrRaw,
          timestamp: new Date()
        }

        // Remove null fields
        Object.keys(weatherReading).forEach(k => {
          if (weatherReading[k] === null) delete weatherReading[k]
        })

        await WeatherData.create(weatherReading)
        integrations.push(`weather:${weatherReading.zone}→${weatherReading.temperature}°C`)

        // Broadcast device weather update (registered devices only)
        if (io) {
          // Get registered device IDs to filter out dummy data
          const registeredDevs = await IoTDevice.find({}, { deviceId: 1 }).lean()
          const registeredIds = registeredDevs.map(d => d.deviceId)

          const devices = await WeatherData.aggregate([
            { $match: { esp32_id: { $in: registeredIds } } },
            { $sort: { timestamp: -1 } },
            { $group: {
              _id: '$esp32_id',
              zone: { $first: '$zone' },
              temperature: { $first: '$temperature' },
              humidity: { $first: '$humidity' },
              aqi: { $first: '$aqi' },
              light_level: { $first: '$light_level' },
              is_daytime: { $first: '$is_daytime' },
              timestamp: { $first: '$timestamp' }
            }},
            { $sort: { _id: 1 } }
          ])
          io.emit('weather:zone-update', devices.map(d => ({
            zone: d.zone, esp32_id: d._id,
            temperature: d.temperature, humidity: d.humidity,
            aqi: d.aqi, light_level: d.light_level,
            is_daytime: d.is_daytime, timestamp: d.timestamp
          })))
        }
        console.log(`🌤️ ESP32 → Weather "${weatherReading.zone}" temp:${weatherReading.temperature}°C hum:${weatherReading.humidity}% aqi:${weatherReading.aqi}`)
      } catch (weatherErr) {
        console.error('ESP32→Weather integration error:', weatherErr.message)
      }
    }

    // ═══ INTEGRATION 3: IR sensors → Traffic (ir1, ir2 = vehicle detection) ═══
    if (data.ir1 !== undefined || data.ir2 !== undefined) {
      integrations.push(`traffic:ir1=${data.ir1},ir2=${data.ir2}`)
    }

    // Detect connected sensors for response
    const detectedSensors = Object.keys(telemetry).filter(k => k !== 'message')

    res.json({
      success: true,
      message: 'Data received successfully.',
      device: {
        id: device.deviceId,
        name: device.name,
        status: device.status,
        lastSeen: device.lastSeen,
      },
      detectedSensors,
      receivedFields: Object.keys(telemetry).length,
      integrations,
    })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/iot/devices/:deviceId — Remove a device (admin/operator only)
router.delete('/devices/:deviceId', auth, roleCheck('admin', 'operator'), async (req, res, next) => {
  try {
    const device = await IoTDevice.findOne({
      deviceId: normalizeDeviceId(req.params.deviceId),
    })
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' })
    }

    const deviceName = device.name
    const deviceId = device.deviceId
    await IoTDevice.deleteOne({ _id: device._id })

    // Clean up telemetry logs
    await TelemetryLog.deleteMany({ deviceId }).catch(() => {})

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Removed IoT Device',
      module: 'iot',
      details: `Removed ${deviceName} (${deviceId})`,
    })

    emitDeviceEvent('device_removed', { ...device.toObject(), status: 'removed' })

    res.json({ success: true, message: `Device "${deviceName}" removed.` })
  } catch (error) {
    next(error)
  }
})

module.exports = router
