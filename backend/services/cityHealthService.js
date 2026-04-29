const axios = require('axios');

// Ahmedabad, India coordinates
const LATITUDE = 23.03;
const LONGITUDE = 72.58;

// In-memory cache (10 min TTL)
let cache = { data: null, expiry: 0 };
const CACHE_TTL = 10 * 60 * 1000;

// WMO Weather Code descriptions
const WEATHER_CODES = {
  0: { description: 'Clear Sky', icon: 'sun' },
  1: { description: 'Mainly Clear', icon: 'sun' },
  2: { description: 'Partly Cloudy', icon: 'cloud-sun' },
  3: { description: 'Overcast', icon: 'cloud' },
  45: { description: 'Foggy', icon: 'cloud-fog' },
  48: { description: 'Rime Fog', icon: 'cloud-fog' },
  51: { description: 'Light Drizzle', icon: 'cloud-drizzle' },
  53: { description: 'Moderate Drizzle', icon: 'cloud-drizzle' },
  55: { description: 'Dense Drizzle', icon: 'cloud-drizzle' },
  61: { description: 'Slight Rain', icon: 'cloud-rain' },
  63: { description: 'Moderate Rain', icon: 'cloud-rain' },
  65: { description: 'Heavy Rain', icon: 'cloud-rain' },
  71: { description: 'Slight Snow', icon: 'snowflake' },
  73: { description: 'Moderate Snow', icon: 'snowflake' },
  75: { description: 'Heavy Snow', icon: 'snowflake' },
  80: { description: 'Slight Showers', icon: 'cloud-rain' },
  81: { description: 'Moderate Showers', icon: 'cloud-rain' },
  82: { description: 'Violent Showers', icon: 'cloud-rain' },
  95: { description: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { description: 'Thunderstorm with Hail', icon: 'cloud-lightning' },
  99: { description: 'Thunderstorm with Heavy Hail', icon: 'cloud-lightning' }
};

function getAqiLabel(aqi) {
  if (aqi <= 50) return { label: 'Good', color: '#10b981' };
  if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive', color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#7c3aed' };
  return { label: 'Hazardous', color: '#991b1b' };
}

async function fetchWeatherData() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index&timezone=Asia/Kolkata`;
  const res = await axios.get(url, { timeout: 10000 });
  const current = res.data.current;
  const code = current.weather_code;
  const weatherInfo = WEATHER_CODES[code] || { description: 'Unknown', icon: 'cloud' };

  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    uvIndex: current.uv_index,
    weatherCode: code,
    description: weatherInfo.description,
    icon: weatherInfo.icon
  };
}

async function fetchAirQualityData() {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=Asia/Kolkata`;
  const res = await axios.get(url, { timeout: 10000 });
  const current = res.data.current;
  const aqi = current.us_aqi || 0;
  const aqiInfo = getAqiLabel(aqi);

  return {
    aqi: aqi,
    aqiLabel: aqiInfo.label,
    aqiColor: aqiInfo.color,
    pm25: current.pm2_5 || 0,
    pm10: current.pm10 || 0,
    no2: current.nitrogen_dioxide || 0,
    o3: current.ozone || 0
  };
}

async function getCityHealthData() {
  // Return cached data if still valid
  if (cache.data && Date.now() < cache.expiry) {
    return cache.data;
  }

  try {
    const [weather, airQuality] = await Promise.all([
      fetchWeatherData(),
      fetchAirQualityData()
    ]);

    const result = {
      weather,
      airQuality,
      city: 'Ahmedabad',
      updatedAt: new Date().toISOString()
    };

    // Update cache
    cache = { data: result, expiry: Date.now() + CACHE_TTL };
    return result;
  } catch (error) {
    console.error('City Health API Error:', error.message);
    // Return stale cache if available
    if (cache.data) return cache.data;
    throw new Error('Unable to fetch city health data');
  }
}

module.exports = { getCityHealthData };
