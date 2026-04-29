import { useState, useEffect, useCallback } from 'react';
import { weatherAPI } from '../services/api';
import socketService from '../services/socket';
import { useTheme } from '../context/ThemeContext';
import {
  CloudSun, Droplets, Wind, Thermometer, Sun, Moon,
  RefreshCw, AlertTriangle, CheckCircle, CloudRain, Activity
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import './Weather.css';

const ZONE_COLORS = {
  'Zone A': '#3b82f6',
  'Zone B': '#10b981',
  'Zone C': '#f59e0b',
  'Zone D': '#a855f7',
};

const getAqiInfo = (aqi) => {
  if (aqi <= 50) return { label: 'Good', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
  if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
  if (aqi <= 150) return { label: 'Unhealthy*', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
  return { label: 'Hazardous', color: '#9333ea', bg: 'rgba(147,51,234,0.15)' };
};

const Weather = () => {
  const [zones, setZones] = useState([]);
  const [cityWeather, setCityWeather] = useState(null);
  const [history, setHistory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();

  const tooltipStyle = isDark
    ? { background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }
    : { background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', color: '#1e293b' };
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';

  const fetchAll = useCallback(async () => {
    try {
      const [zonesRes, cityRes, historyRes, alertsRes] = await Promise.all([
        weatherAPI.getZones(),
        weatherAPI.getCity(),
        weatherAPI.getZoneHistory(24),
        weatherAPI.getAlerts()
      ]);
      setZones(zonesRes.data.data || []);
      setCityWeather(cityRes.data.data);
      setHistory(historyRes.data.data || {});
      setAlerts(alertsRes.data.data || []);
    } catch (err) {
      console.error('Weather fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time updates
  useEffect(() => {
    const handleZoneUpdate = (data) => setZones(data);
    const handleCityUpdate = (data) => setCityWeather(data);

    socketService.on('weather:zone-update', handleZoneUpdate);
    socketService.on('weather:city-update', handleCityUpdate);
    return () => {
      socketService.off('weather:zone-update', handleZoneUpdate);
      socketService.off('weather:city-update', handleCityUpdate);
    };
  }, []);

  // Build chart data from history
  const buildChartData = (field) => {
    const zoneKeys = Object.keys(history);
    if (zoneKeys.length === 0) return [];

    // Merge all zones by time intervals
    const allTimes = new Set();
    zoneKeys.forEach(z => {
      (history[z] || []).forEach(r => {
        const t = new Date(r.time);
        const key = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
        allTimes.add(key);
      });
    });

    const sortedTimes = [...allTimes].sort();
    // Take every Nth to avoid too many points
    const step = Math.max(1, Math.floor(sortedTimes.length / 30));
    const sampledTimes = sortedTimes.filter((_, i) => i % step === 0);

    return sampledTimes.map(timeKey => {
      const point = { time: timeKey };
      zoneKeys.forEach(z => {
        const readings = history[z] || [];
        const match = readings.find(r => {
          const t = new Date(r.time);
          return `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` === timeKey;
        });
        point[z] = match ? match[field] : null;
      });
      return point;
    });
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const tempChartData = buildChartData('temperature');
  const humChartData = buildChartData('humidity');
  const aqiChartData = buildChartData('aqi');

  return (
    <div className="weather-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><CloudSun size={22} style={{ display: 'inline', marginRight: 8 }} />Weather Monitoring</h1>
          <p>Real-time zone weather, city forecast, and environmental alerts</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchAll}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ═══ City Weather Hero ═══ */}
      {cityWeather && (
        <div className="weather-hero">
          <div className="weather-hero-top">
            <div className="weather-hero-main">
              <div className="weather-hero-icon">{cityWeather.weather_icon}</div>
              <div>
                <div className="weather-hero-temp">
                  {Math.round(cityWeather.temperature)}<span>°C</span>
                </div>
                <div className="weather-hero-condition">{cityWeather.weather_condition}</div>
                <div className="weather-hero-city">{cityWeather.city}</div>
              </div>
            </div>
            <div className="weather-hero-updated">
              Updated: {cityWeather.fetched_at ? new Date(cityWeather.fetched_at).toLocaleTimeString() : '—'}
            </div>
          </div>
          <div className="weather-hero-details">
            <div className="weather-hero-detail">
              <Droplets size={16} />
              Humidity: <span className="detail-value">{cityWeather.humidity}%</span>
            </div>
            <div className="weather-hero-detail">
              <Wind size={16} />
              Wind: <span className="detail-value">{cityWeather.wind_speed} km/h</span>
            </div>
            <div className="weather-hero-detail">
              <CloudRain size={16} />
              Rain: <span className="detail-value">{cityWeather.rain_probability}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Zone Weather Cards ═══ */}
      <div>
        <div className="weather-zones-header">
          <h2><Thermometer size={18} /> Zone Weather (ESP32 Sensors)</h2>
        </div>
        <div className="weather-zone-grid">
          {zones.map(z => {
            const aqiInfo = getAqiInfo(z.aqi);
            return (
              <div key={z.zone} className="weather-zone-card">
                <div className="wzc-header">
                  <span className="wzc-zone-name" style={{ borderLeft: `3px solid ${ZONE_COLORS[z.zone] || '#666'}`, paddingLeft: 8 }}>
                    {z.zone}
                  </span>
                  <span className="wzc-daynight">{z.is_daytime ? '☀️' : '🌙'}</span>
                </div>
                <div className="wzc-temp">
                  {z.temperature}<span>°C</span>
                </div>
                <div className="wzc-metrics">
                  <div className="wzc-metric">
                    <Droplets size={13} /> <span className="metric-value">{z.humidity}%</span> Humidity
                  </div>
                  <div className="wzc-metric">
                    <Sun size={13} /> <span className="metric-value">{z.light_level}</span> LDR
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="wzc-aqi-badge" style={{ background: aqiInfo.bg, color: aqiInfo.color }}>
                    AQI {z.aqi} — {aqiInfo.label}
                  </span>
                  <span className="wzc-timestamp">
                    {z.timestamp ? new Date(z.timestamp).toLocaleTimeString() : '—'}
                  </span>
                </div>
              </div>
            );
          })}
          {zones.length === 0 && (
            <div className="no-alerts">
              <Thermometer size={32} />
              <p>No zone data yet. Waiting for ESP32 readings...</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Charts ═══ */}
      {tempChartData.length > 0 && (
        <div>
          <h2 className="weather-section-title"><Activity size={18} /> Live Charts (Last 24h)</h2>
          <div className="weather-charts-section">
            {/* Temperature Chart */}
            <div className="weather-chart-card">
              <h3><Thermometer size={16} /> Temperature (°C)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={tempChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  {Object.keys(history).map(zone => (
                    <Line
                      key={zone}
                      type="monotone"
                      dataKey={zone}
                      stroke={ZONE_COLORS[zone] || '#888'}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Humidity Chart */}
            <div className="weather-chart-card">
              <h3><Droplets size={16} /> Humidity (%)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={humChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  {Object.keys(history).map(zone => (
                    <Line
                      key={zone}
                      type="monotone"
                      dataKey={zone}
                      stroke={ZONE_COLORS[zone] || '#888'}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* AQI Chart */}
            <div className="weather-chart-card">
              <h3><AlertTriangle size={16} /> Air Quality Index (AQI)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={aqiChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} domain={[0, 300]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  {Object.keys(history).map(zone => (
                    <Line
                      key={zone}
                      type="monotone"
                      dataKey={zone}
                      stroke={ZONE_COLORS[zone] || '#888'}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Alerts ═══ */}
      <div>
        <h2 className="weather-section-title"><AlertTriangle size={18} /> Weather Alerts</h2>
        {alerts.length > 0 ? (
          <div className="weather-alerts-grid">
            {alerts.map((alert, i) => (
              <div key={i} className={`weather-alert-card ${alert.severity}`}>
                <div className={`alert-icon-circle ${alert.severity}`}>
                  {alert.type === 'heat' && '🔥'}
                  {alert.type === 'cold' && '❄️'}
                  {alert.type === 'aqi' && '⚠️'}
                  {alert.type === 'rain' && '🌧️'}
                </div>
                <div className="alert-content">
                  <h4>{alert.title}</h4>
                  <p>{alert.message}</p>
                  <span className="alert-zone-tag">{alert.zone}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-alerts">
            <CheckCircle size={36} />
            <h3>All Clear</h3>
            <p>No weather alerts at this time. Conditions are normal across all zones.</p>
          </div>
        )}
      </div>

      {/* ═══ 7-Day Forecast ═══ */}
      {cityWeather?.forecast_data?.length > 0 && (
        <div>
          <h2 className="weather-section-title"><CloudSun size={18} /> 7-Day Forecast</h2>
          <div className="weather-forecast-row">
            {cityWeather.forecast_data.map((day, i) => {
              const date = new Date(day.date);
              const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={day.date} className={`forecast-day-card ${i === 0 ? 'today' : ''}`}>
                  <div className="fdc-day">{dayName}<br /><span style={{ opacity: 0.6 }}>{dateStr}</span></div>
                  <div className="fdc-icon">{day.icon}</div>
                  <div className="fdc-temps">
                    <span className="high">{Math.round(day.temp_max)}°</span>
                    <span className="low">{Math.round(day.temp_min)}°</span>
                  </div>
                  <div className="fdc-condition">{day.condition}</div>
                  {day.rain_probability > 0 && (
                    <div className="fdc-rain">🌧 {day.rain_probability}%</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Weather;
