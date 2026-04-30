const express = require('express');
const WeatherData = require('../models/WeatherData');
const WeatherAPIData = require('../models/WeatherAPIData');
const weatherService = require('../services/weatherService');
const auth = require('../middleware/auth');
const socketUtils = require('../utils/socket');
const router = express.Router();

// POST /api/weather/esp — receive ESP32 sensor data (public for hardware)
router.post('/esp', async (req, res, next) => {
  try {
    const { temperature, humidity, mq135, ldr, esp32_id, zone } = req.body;

    if (temperature === undefined || humidity === undefined) {
      return res.status(400).json({ success: false, message: 'temperature and humidity are required.' });
    }

    // Convert MQ135 raw to AQI
    const aqi = mq135 !== undefined ? weatherService.mq135ToAqi
      ? (() => {
          // inline conversion
          const raw = mq135;
          if (raw <= 500) return Math.round((raw / 500) * 50);
          if (raw <= 1500) return Math.round(50 + ((raw - 500) / 1000) * 100);
          return Math.round(150 + ((raw - 1500) / 2500) * 350);
        })()
      : 0 : 0;

    const reading = await WeatherData.create({
      esp32_id: esp32_id || 'ESP32-UNKNOWN',
      zone: zone || 'Zone A',
      temperature,
      humidity,
      aqi,
      light_level: ldr || 0,
      timestamp: new Date()
    });

    // Broadcast to connected clients
    const latestDevices = await getLatestDeviceData();
    socketUtils.broadcast('weather:zone-update', latestDevices);

    res.status(201).json({ success: true, data: reading });
  } catch (error) {
    next(error);
  }
});

// GET /api/weather/zones — latest data per ESP32 device
router.get('/zones', auth, async (req, res, next) => {
  try {
    const devices = await getLatestDeviceData();
    res.json({ success: true, data: devices });
  } catch (error) {
    next(error);
  }
});

// GET /api/weather/zones/history — sensor history per ESP32 device (last 24h for charts)
router.get('/zones/history', auth, async (req, res, next) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const history = await WeatherData.find({ timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .select('esp32_id zone temperature humidity aqi light_level is_daytime timestamp')
      .lean();

    // Group by esp32_id (each device gets its own line on the chart)
    const grouped = {};
    history.forEach(r => {
      const key = r.esp32_id || r.zone;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        time: r.timestamp,
        temperature: r.temperature,
        humidity: r.humidity,
        aqi: r.aqi,
        light_level: r.light_level,
        is_daytime: r.is_daytime
      });
    });

    res.json({ success: true, data: grouped });
  } catch (error) {
    next(error);
  }
});

// GET /api/weather/city — city weather + forecast
router.get('/city', auth, async (req, res, next) => {
  try {
    // Return cached data (< 10 min old) or fetch fresh
    let city = await WeatherAPIData.findOne({ city: 'Indore' }).lean();

    if (!city || !city.fetched_at || Date.now() - new Date(city.fetched_at).getTime() > 10 * 60 * 1000) {
      city = await weatherService.fetchCityWeather();
    }

    res.json({ success: true, data: city || null });
  } catch (error) {
    next(error);
  }
});

// GET /api/weather/alerts — active weather alerts
router.get('/alerts', auth, async (req, res, next) => {
  try {
    const alerts = await weatherService.computeAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
});

// Helper: get latest reading per ESP32 device
async function getLatestDeviceData() {
  const devices = await WeatherData.aggregate([
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$esp32_id',
        zone: { $first: '$zone' },
        temperature: { $first: '$temperature' },
        humidity: { $first: '$humidity' },
        aqi: { $first: '$aqi' },
        light_level: { $first: '$light_level' },
        is_daytime: { $first: '$is_daytime' },
        timestamp: { $first: '$timestamp' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return devices.map(d => ({
    zone: d.zone,
    esp32_id: d._id,
    temperature: d.temperature,
    humidity: d.humidity,
    aqi: d.aqi,
    light_level: d.light_level,
    is_daytime: d.is_daytime,
    timestamp: d.timestamp
  }));
}

module.exports = router;
