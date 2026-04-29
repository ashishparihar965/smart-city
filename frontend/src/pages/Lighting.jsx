import { useState, useEffect } from 'react';
import { lightingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Lightbulb, MapPin, Zap, AlertTriangle,
  RefreshCw, Power, Settings, Wrench, CheckCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import './ModulePage.css';

const Lighting = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ zone: '', status: '' });
  const { isAdmin } = useAuth();

  const fetchData = async () => {
    try {
      const params = {};
      if (filter.zone) params.zone = filter.zone;
      if (filter.status) params.status = filter.status;
      const [dataRes, statsRes] = await Promise.all([
        lightingAPI.getAll(params),
        lightingAPI.getStats()
      ]);
      setData(dataRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Lighting fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleToggle = async (id) => {
    try {
      await lightingAPI.toggle(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAutoToggle = async () => {
    try {
      await lightingAPI.autoToggle();
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleReportFault = async (id) => {
    try {
      await lightingAPI.reportFault(id, { faultType: 'power-issue' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleResolveFault = async (id) => {
    try {
      await lightingAPI.resolveFault(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const chartData = stats?.zoneStats?.map(z => ({
    name: z._id?.toUpperCase(),
    energy: Math.round(z.totalEnergy * 100) / 100,
    lights: z.totalLights,
    on: z.onLights,
    faulty: z.faultyLights
  })) || [];

  return (
    <div className="module-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>💡 Smart Lighting</h1>
          <p>Control street lights, monitor energy, and manage faults</p>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={handleAutoToggle}>
              <Settings size={14} /> Auto Toggle All
            </button>
          )}
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-1">
        <div className="stat-card">
          <div className="stat-icon amber"><Lightbulb size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.totalLights || 0}</span>
            <span className="stat-label">Total Lights</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Power size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.onLights || 0}</span>
            <span className="stat-label">Currently ON</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.faultyLights || 0}</span>
            <span className="stat-label">Faulty Lights</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><Zap size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.autoModeLights || 0}</span>
            <span className="stat-label">Auto Mode</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card chart-section mb-1">
          <h3>Energy Usage by Zone (kWh)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
              <Bar dataKey="energy" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Energy (kWh)" />
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
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="on">ON</option>
          <option value="off">OFF</option>
        </select>
      </div>

      {/* Light Cards */}
      <div className="card-grid">
        {data.map(light => (
          <div key={light._id} className="light-card">
            <div className="item-header">
              <h4>{light.lightId}</h4>
              <span className={`badge ${light.status === 'on' ? 'badge-green' : 'badge-red'}`}>
                {light.status.toUpperCase()}
              </span>
            </div>
            <div className="item-details">
              <span><MapPin size={13} /> {light.location}</span>
              <span>Zone: {light.zone} | Brightness: {light.brightness}%</span>
              <span><Zap size={13} /> Energy: {light.energyUsage} kWh</span>
              <span>{light.autoMode ? '🤖 Auto Mode ON' : '✋ Manual Mode'}</span>
              {light.faultDetected && (
                <span style={{ color: 'var(--accent-red)' }}>
                  ⚠ Fault: {light.faultType}
                </span>
              )}
            </div>
            <div className="item-actions">
              <button
                className={`btn btn-sm ${light.status === 'on' ? 'btn-outline' : 'btn-success'}`}
                onClick={() => handleToggle(light._id)}
              >
                <Power size={13} /> {light.status === 'on' ? 'Turn OFF' : 'Turn ON'}
              </button>
              {!light.faultDetected ? (
                <button className="btn btn-sm btn-danger" onClick={() => handleReportFault(light._id)}>
                  <Wrench size={13} /> Report Fault
                </button>
              ) : (
                <button className="btn btn-sm btn-success" onClick={() => handleResolveFault(light._id)}>
                  <CheckCircle size={13} /> Fix Fault
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {data.length === 0 && <div className="empty-state"><p>No lighting data found</p></div>}
    </div>
  );
};

export default Lighting;
