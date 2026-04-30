const axios = require('axios');
const WeatherData = require('../models/WeatherData');
const WeatherAPIData = require('../models/WeatherAPIData');

// Indore coordinates
const CITY_LAT = 22.7196;
const CITY_LNG = 75.8577;
const CITY_NAME = 'Indore';

// WMO weather code → condition + icon mapping
const WMO_CODES = {
  0: { condition: 'Clear Sky', icon: '☀️' },
  1: { condition: 'Mainly Clear', icon: '🌤️' },
  2: { condition: 'Partly Cloudy', icon: '⛅' },
  3: { condition: 'Overcast', icon: '☁️' },
  45: { condition: 'Foggy', icon: '🌫️' },
  48: { condition: 'Rime Fog', icon: '🌫️' },
  51: { condition: 'Light Drizzle', icon: '🌦️' },
  53: { condition: 'Moderate Drizzle', icon: '🌦️' },
  55: { condition: 'Dense Drizzle', icon: '🌧️' },
  61: { condition: 'Slight Rain', icon: '🌧️' },
  63: { condition: 'Moderate Rain', icon: '🌧️' },
  65: { condition: 'Heavy Rain', icon: '🌧️' },
  71: { condition: 'Slight Snow', icon: '🌨️' },
  73: { condition: 'Moderate Snow', icon: '🌨️' },
  75: { condition: 'Heavy Snow', icon: '❄️' },
  80: { condition: 'Rain Showers', icon: '🌦️' },
  81: { condition: 'Moderate Showers', icon: '🌧️' },
  82: { condition: 'Violent Showers', icon: '⛈️' },
  95: { condition: 'Thunderstorm', icon: '⛈️' },
  96: { condition: 'Thunderstorm + Hail', icon: '⛈️' },
  99: { condition: 'Thunderstorm + Heavy Hail', icon: '⛈️' },
};

const getWeatherInfo = (code) => WMO_CODES[code] || { condition: 'Unknown', icon: '🌡️' };

// ESP32 zones
const ZONES = [
  { id: 'ESP32-A', zone: 'Zone A', baseTemp: 32, baseHumidity: 55 },
  { id: 'ESP32-B', zone: 'Zone B', baseTemp: 30, baseHumidity: 60 },
  { id: 'ESP32-C', zone: 'Zone C', baseTemp: 34, baseHumidity: 50 },
  { id: 'ESP32-D', zone: 'Zone D', baseTemp: 28, baseHumidity: 65 },
];

// AQI thresholds for MQ135 raw value → AQI approximation
const mq135ToAqi = (raw) => {
  // Simple linear mapping: 0–500 raw → 0–50 AQI, 500–1500 → 50–150, 1500+ → 150–500
  if (raw <= 500) return Math.round((raw / 500) * 50);
  if (raw <= 1500) return Math.round(50 + ((raw - 500) / 1000) * 100);
  return Math.round(150 + ((raw - 1500) / 2500) * 350);
};

const weatherService = {
  /**
   * Fetch city weather from Open-Meteo API and cache in DB
   */
  async fetchCityWeather() {
    try {
      // Current weather + 7-day forecast
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${CITY_LAT}&longitude=${CITY_LNG}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_probability_max,weather_code&timezone=Asia%2FKolkata&forecast_days=7`;

      const response = await axios.get(url, { timeout: 10000 });
      const data = response.data;

      const current = data.current;
      const daily = data.daily;
      const weatherInfo = getWeatherInfo(current.weather_code);

      // Build forecast array
      const forecast_data = [];
      for (let i = 0; i < daily.time.length; i++) {
        const dayInfo = getWeatherInfo(daily.weather_code[i]);
        forecast_data.push({
          date: daily.time[i],
          temp_min: daily.temperature_2m_min[i],
          temp_max: daily.temperature_2m_max[i],
          humidity: daily.relative_humidity_2m_mean[i],
          rain_probability: daily.precipitation_probability_max[i],
          condition: dayInfo.condition,
          icon: dayInfo.icon
        });
      }

      // Upsert into DB
      const cityWeather = await WeatherAPIData.findOneAndUpdate(
        { city: CITY_NAME },
        {
          city: CITY_NAME,
          temperature: current.temperature_2m,
          humidity: current.relative_humidity_2m,
          rain_probability: daily.precipitation_probability_max[0] || 0,
          wind_speed: current.wind_speed_10m,
          weather_condition: weatherInfo.condition,
          weather_icon: weatherInfo.icon,
          forecast_data,
          fetched_at: new Date()
        },
        { upsert: true, new: true }
      );

      return cityWeather;
    } catch (error) {
      console.error('Open-Meteo API error:', error.message);
      // Return cached data if available
      return await WeatherAPIData.findOne({ city: CITY_NAME }).lean();
    }
  },

  /**
   * Simulate ESP32 sensor data for all 4 zones
   */
  async simulateESP32Data() {
    const readings = [];
    const hour = new Date().getHours();
    const isDaytimeHour = hour >= 6 && hour < 19;

    for (const z of ZONES) {
      // Add realistic variance
      const tempVariance = (Math.random() - 0.5) * 6;
      const humVariance = (Math.random() - 0.5) * 15;
      const timeAdjust = isDaytimeHour ? 2 : -4; // warmer during day

      const temperature = Math.round((z.baseTemp + tempVariance + timeAdjust) * 10) / 10;
      const humidity = Math.max(20, Math.min(100, Math.round(z.baseHumidity + humVariance)));
      const mq135Raw = Math.round(300 + Math.random() * 1800); // 300–2100 range
      const ldrRaw = isDaytimeHour ? Math.round(400 + Math.random() * 600) : Math.round(50 + Math.random() * 200);

      const reading = await WeatherData.create({
        esp32_id: z.id,
        zone: z.zone,
        temperature,
        humidity,
        aqi: mq135ToAqi(mq135Raw),
        light_level: ldrRaw,
        timestamp: new Date()
      });
      readings.push(reading);
    }

    return readings;
  },

  /**
   * Compute active weather alerts from latest data
   */
  async computeAlerts() {
    const alerts = [];

    // Get latest reading per ESP32 device
    const zones = await WeatherData.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: {
        _id: '$esp32_id',
        zone: { $first: '$zone' },
        temperature: { $first: '$temperature' },
        humidity: { $first: '$humidity' },
        aqi: { $first: '$aqi' },
        timestamp: { $first: '$timestamp' }
      }}
    ]);

    // Get city data
    const city = await WeatherAPIData.findOne({ city: CITY_NAME }).lean();

    // Check each zone
    for (const z of zones) {
      // Heat alert
      if (z.temperature > 40) {
        alerts.push({
          type: 'heat',
          severity: 'critical',
          zone: `${z._id} (${z.zone || 'unknown'})`,
          title: '🔥 Heat Risk Alert',
          message: `Temperature at ${z._id} is ${z.temperature}°C — extreme heat warning.`,
          value: z.temperature
        });
      } else if (z.temperature > 38) {
        alerts.push({
          type: 'heat',
          severity: 'warning',
          zone: `${z._id} (${z.zone || 'unknown'})`,
          title: '🌡️ High Temperature',
          message: `Temperature at ${z._id} is ${z.temperature}°C — stay hydrated.`,
          value: z.temperature
        });
      }

      // Cold alert
      if (z.temperature < 5) {
        alerts.push({
          type: 'cold',
          severity: 'warning',
          zone: `${z._id} (${z.zone || 'unknown'})`,
          title: '❄️ Cold Alert',
          message: `Temperature at ${z._id} dropped to ${z.temperature}°C.`,
          value: z.temperature
        });
      }

      // AQI alert
      if (z.aqi > 200) {
        alerts.push({
          type: 'aqi',
          severity: 'critical',
          zone: `${z._id} (${z.zone || 'unknown'})`,
          title: '⚠️ Hazardous Air Quality',
          message: `AQI at ${z._id} is ${z.aqi} — avoid outdoor activities.`,
          value: z.aqi
        });
      } else if (z.aqi > 150) {
        alerts.push({
          type: 'aqi',
          severity: 'warning',
          zone: `${z._id} (${z.zone || 'unknown'})`,
          title: '⚠️ Poor Air Quality',
          message: `AQI at ${z._id} is ${z.aqi} — sensitive groups take precautions.`,
          value: z.aqi
        });
      }

      // Rain alert (zone humidity + city rain probability)
      if (z.humidity > 70 && city && city.rain_probability > 60) {
        alerts.push({
          type: 'rain',
          severity: 'warning',
          zone: `${z._id} (${z.zone || 'unknown'})`,
          title: '🌧️ Rain Alert Expected',
          message: `Humidity ${z.humidity}% at ${z._id} + ${city.rain_probability}% rain probability. Carry umbrella!`,
          value: city.rain_probability
        });
      }
    }

    return alerts;
  },

  /**
   * Get AQI label from value
   */
  getAqiLabel(aqi) {
    if (aqi <= 50) return { label: 'Good', color: '#10b981' };
    if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' };
    if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: '#f97316' };
    if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: '#9333ea' };
    return { label: 'Hazardous', color: '#7f1d1d' };
  }
};

module.exports = weatherService;
