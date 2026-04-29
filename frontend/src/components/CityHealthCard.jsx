import { useState, useEffect } from 'react';
import {
  Thermometer, Wind, Droplets, Sun, Cloud, CloudRain,
  CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  Eye, ShieldAlert, Gauge
} from 'lucide-react';
import './CityHealthCard.css';

const WEATHER_ICONS = {
  'sun': Sun,
  'cloud-sun': Cloud,
  'cloud': Cloud,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  'snowflake': CloudSnow,
  'cloud-lightning': CloudLightning
};

const CityHealthCard = ({ data }) => {
  const [animateAqi, setAnimateAqi] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateAqi(true), 300);
    return () => clearTimeout(timer);
  }, []);

  if (!data) {
    return (
      <div className="city-health-card city-health-loading">
        <div className="city-health-loading-content">
          <Cloud size={28} className="pulse-icon" />
          <span>Loading City Health Data...</span>
        </div>
      </div>
    );
  }

  const { weather, airQuality, city, updatedAt } = data;
  const WeatherIcon = WEATHER_ICONS[weather?.icon] || Cloud;
  const aqiPercent = Math.min(100, ((airQuality?.aqi || 0) / 300) * 100);

  const getUvLabel = (uv) => {
    if (uv <= 2) return { label: 'Low', color: '#10b981' };
    if (uv <= 5) return { label: 'Moderate', color: '#f59e0b' };
    if (uv <= 7) return { label: 'High', color: '#f97316' };
    if (uv <= 10) return { label: 'Very High', color: '#ef4444' };
    return { label: 'Extreme', color: '#7c3aed' };
  };

  const uvInfo = getUvLabel(weather?.uvIndex || 0);

  const pollutants = [
    { name: 'PM2.5', value: airQuality?.pm25, unit: 'μg/m³', limit: 35 },
    { name: 'PM10', value: airQuality?.pm10, unit: 'μg/m³', limit: 150 },
    { name: 'NO₂', value: airQuality?.no2, unit: 'μg/m³', limit: 100 },
    { name: 'O₃', value: airQuality?.o3, unit: 'μg/m³', limit: 100 }
  ];

  return (
    <div className="city-health-card">
      <div className="city-health-header">
        <div className="city-health-title">
          <ShieldAlert size={18} />
          <h3>City Health — {city}</h3>
        </div>
        {updatedAt && (
          <span className="city-health-updated">
            Updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="city-health-body">
        {/* Weather Section */}
        <div className="weather-section">
          <div className="weather-main">
            <div className="weather-icon-wrap">
              <WeatherIcon size={36} />
            </div>
            <div className="weather-temp-wrap">
              <span className="weather-temp">{Math.round(weather?.temperature || 0)}°C</span>
              <span className="weather-desc">{weather?.description || 'N/A'}</span>
              <span className="weather-feels">Feels like {Math.round(weather?.feelsLike || 0)}°C</span>
            </div>
          </div>

          <div className="weather-details">
            <div className="weather-detail-item">
              <Droplets size={15} />
              <div>
                <span className="wd-value">{weather?.humidity || 0}%</span>
                <span className="wd-label">Humidity</span>
              </div>
            </div>
            <div className="weather-detail-item">
              <Wind size={15} />
              <div>
                <span className="wd-value">{weather?.windSpeed || 0} km/h</span>
                <span className="wd-label">Wind</span>
              </div>
            </div>
            <div className="weather-detail-item">
              <Sun size={15} />
              <div>
                <span className="wd-value" style={{ color: uvInfo.color }}>{weather?.uvIndex || 0}</span>
                <span className="wd-label">UV ({uvInfo.label})</span>
              </div>
            </div>
          </div>
        </div>

        {/* AQI Section */}
        <div className="aqi-section">
          <div className="aqi-main">
            <div className="aqi-gauge-wrap">
              <div className="aqi-value-large" style={{ color: airQuality?.aqiColor || '#64748b' }}>
                {airQuality?.aqi || 0}
              </div>
              <div className="aqi-label-main" style={{ color: airQuality?.aqiColor || '#64748b' }}>
                {airQuality?.aqiLabel || 'N/A'}
              </div>
              <span className="aqi-sublabel">US AQI</span>
            </div>
            <div className="aqi-bar-track">
              <div
                className={`aqi-bar-fill ${animateAqi ? 'animated' : ''}`}
                style={{
                  width: animateAqi ? `${aqiPercent}%` : '0%',
                  background: airQuality?.aqiColor || '#64748b'
                }}
              />
            </div>
            <div className="aqi-scale-labels">
              <span>0</span>
              <span>50</span>
              <span>100</span>
              <span>150</span>
              <span>200</span>
              <span>300</span>
            </div>
          </div>

          <div className="pollutants-grid">
            {pollutants.map((p) => {
              const ratio = Math.min(1, (p.value || 0) / p.limit);
              const barColor = ratio <= 0.5 ? '#10b981' : ratio <= 0.8 ? '#f59e0b' : '#ef4444';
              return (
                <div key={p.name} className="pollutant-item">
                  <div className="pollutant-header">
                    <span className="pollutant-name">{p.name}</span>
                    <span className="pollutant-value">{(p.value || 0).toFixed(1)} <small>{p.unit}</small></span>
                  </div>
                  <div className="pollutant-bar-track">
                    <div
                      className={`pollutant-bar-fill ${animateAqi ? 'animated' : ''}`}
                      style={{
                        width: animateAqi ? `${ratio * 100}%` : '0%',
                        background: barColor
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CityHealthCard;
