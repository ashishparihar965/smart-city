const cron = require('node-cron')
const Complaint = require('../models/Complaint')
const IoTDevice = require('../models/IoTDevice')
const Alert = require('../models/Alert')
const Bin = require('../models/Bin')
const { getIo } = require('./socket')
const parkingService = require('../services/parkingService')

const initCronJobs = () => {
  // Every 15 minutes: Check for overdue complaints
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date()
      const result = await Complaint.updateMany(
        { deadline: { $lt: now }, status: { $ne: 'resolved' }, isOverdue: false },
        { $set: { isOverdue: true } }
      )
      if (result.modifiedCount > 0) {
        console.log(`⏰ Cron: ${result.modifiedCount} complaints marked overdue`)

        await Alert.create({
          type: 'warning',
          module: 'system',
          title: 'Overdue Complaints Detected',
          message: `${result.modifiedCount} complaint(s) have exceeded their SLA deadline.`,
          priority: 'high',
        })

        const io = getIo()
        if (io) {
          io.to('role:admin').emit('overdue_complaints', { count: result.modifiedCount })
        }
      }
    } catch (err) {
      console.error('Cron overdue check error:', err.message)
    }
  })

  // Every 10 minutes: Check device health (devices not seen in 30 min)
  cron.schedule('*/10 * * * *', async () => {
    try {
      const threshold = new Date(Date.now() - 30 * 60 * 1000) // 30 min ago
      const staleDevices = await IoTDevice.updateMany(
        { status: 'online', lastSeen: { $lt: threshold } },
        { $set: { status: 'offline', disconnectedAt: new Date() } }
      )
      if (staleDevices.modifiedCount > 0) {
        console.log(`📡 Cron: ${staleDevices.modifiedCount} devices marked offline (stale)`)

        await Alert.create({
          type: 'warning',
          module: 'iot',
          title: 'Devices Went Offline',
          message: `${staleDevices.modifiedCount} IoT device(s) haven't sent a heartbeat in 30 minutes.`,
          priority: 'medium',
        })
      }
    } catch (err) {
      console.error('Cron device health error:', err.message)
    }
  })

  // Every hour: Clean old read alerts (older than 30 days)
  cron.schedule('0 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const result = await Alert.deleteMany({ read: true, acknowledged: true, createdAt: { $lt: cutoff } })
      if (result.deletedCount > 0) {
        console.log(`🗑️ Cron: Cleaned ${result.deletedCount} old alerts`)
      }
    } catch (err) {
      console.error('Cron alert cleanup error:', err.message)
    }
  })

  // Every minute: Release expired parking slot locks
  cron.schedule('* * * * *', async () => {
    try {
      const released = await parkingService.releaseExpiredLocks()
      if (released > 0) {
        console.log(`🅿️ Cron: Released ${released} expired slot locks`)
      }
    } catch (err) {
      console.error('Cron parking lock release error:', err.message)
    }
  })

  // Every minute: Auto-complete bookings past endTime
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await parkingService.expireEndedBookings()
      if (expired > 0) {
        console.log(`🅿️ Cron: Completed ${expired} ended parking bookings`)
      }
    } catch (err) {
      console.error('Cron parking booking expiry error:', err.message)
    }
  })

  // Every minute: Cancel bookings with expired QR codes
  cron.schedule('* * * * *', async () => {
    try {
      const cancelled = await parkingService.cancelExpiredQRBookings()
      if (cancelled > 0) {
        console.log(`🅿️ Cron: Cancelled ${cancelled} expired QR bookings`)
      }
    } catch (err) {
      console.error('Cron QR expiry error:', err.message)
    }
  })

  // Bin fill levels now come from real ESP32 ultrasonic sensor (distance → fill_level)
  // via POST /api/iot/esp32/data integration. No more dummy simulation.
  // This cron just checks for bins needing collection alerts.
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fullBins = await Bin.countDocuments({ fill_level: { $gt: 80 } })
      if (fullBins > 0) {
        const io = getIo()
        if (io) {
          const allBins = await Bin.find().sort({ fill_level: -1 }).lean()
          io.emit('bins:update', allBins)
        }
      }
    } catch (err) {
      console.error('Cron bin check error:', err.message)
    }
  })

  // Weather zone data now comes from real ESP32 sensors (temperature/humidity/mq135/ldr)
  // via POST /api/iot/esp32/data integration. No more dummy simulation.

  // ── Weather: Fetch city weather from Open-Meteo every 10 minutes ──
  const weatherService = require('../services/weatherService')
  cron.schedule('*/10 * * * *', async () => {
    try {
      const cityData = await weatherService.fetchCityWeather()
      if (cityData) {
        const io = getIo()
        if (io) {
          io.emit('weather:city-update', cityData)
        }
      }
    } catch (err) {
      console.error('Cron city weather fetch error:', err.message)
    }
  })

  // Initial city weather fetch on startup
  setTimeout(async () => {
    try {
      await weatherService.fetchCityWeather()
      console.log('🌤️ Initial city weather fetched')
    } catch (err) {
      console.error('Initial weather fetch error:', err.message)
    }
  }, 5000)

  console.log('⏰ Cron jobs initialized')
}

module.exports = { initCronJobs }
