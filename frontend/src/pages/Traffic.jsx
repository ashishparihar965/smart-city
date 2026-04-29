import { useState, useEffect } from 'react';
import { trafficAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Car, AlertTriangle, Siren, MapPin, Gauge,
  TrendingUp, RefreshCw, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import LocationPickerModal from '../components/LocationPickerModal';
import './ModulePage.css';

const Traffic = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ zone: '', congestionLevel: '' });
  const [showModal, setShowModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [form, setForm] = useState({
    location: '',
    zone: 'central',
    vehicleCount: 100,
    averageSpeed: 40,
    coordinates: { lat: '', lng: '' },
  });
  const { isAdmin } = useAuth();

  const fetchData = async () => {
    try {
      const params = {};
      if (filter.zone) params.zone = filter.zone;
      if (filter.congestionLevel) params.congestionLevel = filter.congestionLevel;
      const [dataRes, statsRes] = await Promise.all([
        trafficAPI.getAll(params),
        trafficAPI.getStats()
      ]);
      setData(dataRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Traffic fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleReportIncident = async (id) => {
    try {
      await trafficAPI.reportIncident(id, { incidentType: 'accident' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleEmergencyOverride = async (id) => {
    try {
      await trafficAPI.emergencyOverride(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleClearOverride = async (id) => {
    try {
      await trafficAPI.clearOverride(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        coordinates: {
          lat: form.coordinates.lat === '' ? null : Number(form.coordinates.lat),
          lng: form.coordinates.lng === '' ? null : Number(form.coordinates.lng),
        },
      };
      await trafficAPI.create(payload);
      setShowModal(false);
      setForm({
        location: '',
        zone: 'central',
        vehicleCount: 100,
        averageSpeed: 40,
        coordinates: { lat: '', lng: '' },
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handlePickCoordinates = (selected) => {
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      coordinates: {
        lat: selected.lat.toFixed(6),
        lng: selected.lng.toFixed(6),
      },
    }));
    setShowLocationPicker(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const zoneChartData = stats?.zoneStats?.map(z => ({
    name: z._id?.toUpperCase(),
    high: z.highCongestion,
    medium: z.mediumCongestion,
    low: z.lowCongestion,
    incidents: z.incidents
  })) || [];

  return (
    <div className="module-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>🚗 Traffic Management</h1>
          <p>Monitor traffic flow, congestion levels, and manage incidents</p>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + Add Location
            </button>
          )}
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid-4 mb-1">
        <div className="stat-card">
          <div className="stat-icon blue"><Car size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.totalLocations || 0}</span>
            <span className="stat-label">Total Locations</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.highCongestion || 0}</span>
            <span className="stat-label">High Congestion</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Siren size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.activeIncidents || 0}</span>
            <span className="stat-label">Active Incidents</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Gauge size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overall?.emergencyOverrides || 0}</span>
            <span className="stat-label">Emergency Overrides</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {zoneChartData.length > 0 && (
        <div className="card chart-section mb-1">
          <h3>Congestion by Zone</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={zoneChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
              <Bar dataKey="low" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Low" />
              <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" />
              <Bar dataKey="high" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="High" />
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
        <select value={filter.congestionLevel} onChange={e => setFilter(f => ({ ...f, congestionLevel: e.target.value }))}>
          <option value="">All Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="card table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Zone</th>
              <th>Congestion</th>
              <th>Vehicles</th>
              <th>Avg Speed</th>
              <th>Signal</th>
              <th>Prediction</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item._id}>
                <td><MapPin size={13} style={{ marginRight: 4 }} />{item.location}</td>
                <td className="capitalize">{item.zone}</td>
                <td><span className={`badge badge-${item.congestionLevel}`}>{item.congestionLevel}</span></td>
                <td>{item.vehicleCount}</td>
                <td>{item.averageSpeed} km/h</td>
                <td><span className={`badge badge-${item.signalStatus === 'green' ? 'green' : item.signalStatus === 'red' ? 'red' : 'yellow'}`}>{item.signalStatus}</span></td>
                <td><span className={`badge badge-${item.predictedCongestion}`}>{item.predictedCongestion}</span></td>
                <td className="actions-cell">
                  {!item.incidentReported && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleReportIncident(item._id)}>
                      Report Incident
                    </button>
                  )}
                  {item.incidentReported && <span className="badge badge-red">Incident: {item.incidentType}</span>}
                  {!item.emergencyOverride ? (
                    <button className="btn btn-sm btn-outline" onClick={() => handleEmergencyOverride(item._id)}>
                      Emergency Override
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-success" onClick={() => handleClearOverride(item._id)}>
                      Clear Override
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <div className="empty-state"><p>No traffic data found</p></div>}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Add Traffic Location</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label>Location Name</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label>Zone</label>
                <select value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                  {['north', 'south', 'east', 'west', 'central'].map(z => (
                    <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Vehicle Count</label>
                <input type="number" value={form.vehicleCount} onChange={e => setForm(f => ({ ...f, vehicleCount: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="input-group">
                <label>Average Speed (km/h)</label>
                <input type="number" value={form.averageSpeed} onChange={e => setForm(f => ({ ...f, averageSpeed: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="input-group">
                <label>Coordinates (optional)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowLocationPicker(true)}
                  >
                    <MapPin size={13} /> Pick on Map
                  </button>
                  {form.coordinates.lat !== '' && form.coordinates.lng !== '' && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {form.coordinates.lat}, {form.coordinates.lng}
                    </span>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LocationPickerModal
        isOpen={showLocationPicker}
        title="Pick traffic location"
        initialCoordinates={form.coordinates}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handlePickCoordinates}
      />
    </div>
  );
};

export default Traffic;
