import { useState, useEffect } from 'react';
import { waterAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Droplets, MapPin, AlertTriangle, Activity,
  RefreshCw, Search, TrendingUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import './ModulePage.css';

const Water = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ zone: '' });

  const fetchData = async () => {
    try {
      const params = {};
      if (filter.zone) params.zone = filter.zone;
      const [dataRes, statsRes] = await Promise.all([
        waterAPI.getAll(params),
        waterAPI.getStats()
      ]);
      setData(dataRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Water fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleAnalyze = async (zone) => {
    try {
      await waterAPI.analyze(zone);
      fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const chartData = stats?.zoneStats?.map(z => ({
    name: z._id?.toUpperCase(),
    usage: Math.round(z.totalUsage),
    quality: Math.round(z.avgQuality),
    leaks: z.leaks
  })) || [];

  return (
    <div className="module-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>💧 Water Monitoring</h1>
          <p>Track water usage, detect leaks, and monitor quality</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => handleAnalyze(filter.zone || 'central')}>
            <Search size={14} /> Analyze Zone
          </button>
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-1">
        <div className="stat-card">
          <div className="stat-icon cyan"><Droplets size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.totalAreas || 0}</span>
            <span className="stat-label">Monitored Areas</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.totalLeaks || 0}</span>
            <span className="stat-label">Active Leaks</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><AlertTriangle size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.criticalLeaks || 0}</span>
            <span className="stat-label">Critical Leaks</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Activity size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.avgQuality || 0}%</span>
            <span className="stat-label">Avg Quality Index</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card chart-section mb-1">
          <h3>Water Usage by Zone (Liters)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
              <Bar dataKey="usage" fill="#06b6d4" radius={[6, 6, 0, 0]} name="Usage (L)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select value={filter.zone} onChange={e => setFilter(f => ({ ...f, zone: e.target.value }))}>
          <option value="">All Zones</option>
          {['north', 'south', 'east', 'west', 'central'].map(z => (
            <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Area Cards */}
      <div className="card-grid">
        {data.map(area => (
          <div key={area._id} className="area-card">
            <div className="item-header">
              <h4>{area.area}</h4>
              {area.leakDetected ? (
                <span className={`badge badge-${area.leakSeverity === 'critical' ? 'critical' : area.leakSeverity === 'major' ? 'red' : 'yellow'}`}>
                  {area.leakSeverity} leak
                </span>
              ) : (
                <span className="badge badge-green">Normal</span>
              )}
            </div>
            <div className="item-details">
              <span><MapPin size={13} /> Zone: {area.zone}</span>
              <span><Droplets size={13} /> Usage: {area.usage.toLocaleString()} L / {area.threshold.toLocaleString()} L threshold</span>
              <span><Activity size={13} /> Pressure: {area.pressure}% | Quality: {area.qualityIndex}%</span>
              <span><TrendingUp size={13} /> Daily Avg: {area.dailyAverage.toLocaleString()} L</span>
              <span>Weekly Avg: {area.weeklyAverage.toLocaleString()} L</span>
            </div>

            {/* Usage vs threshold bar */}
            <div className="fill-bar" style={{ marginTop: '0.5rem' }}>
              <div
                className="fill-bar-inner"
                style={{
                  width: `${Math.min((area.usage / area.threshold) * 100, 100)}%`,
                  background: area.leakDetected ? '#ef4444' : '#10b981'
                }}
              />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {Math.round((area.usage / area.threshold) * 100)}% of threshold
            </div>
          </div>
        ))}
      </div>
      {data.length === 0 && <div className="empty-state"><p>No water data found</p></div>}
    </div>
  );
};

export default Water;
