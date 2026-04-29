import { useState, useEffect } from 'react';
import { incidentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, MapPin, Clock, User,
  RefreshCw, Plus, X, Flame, Zap, Shield
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts';
import LocationPickerModal from '../components/LocationPickerModal';
import './ModulePage.css';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4'];

const Incidents = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [showModal, setShowModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [form, setForm] = useState({
    title: '', type: 'fire', location: '', zone: 'central',
    priority: 'medium', description: '', coordinates: { lat: '', lng: '' }
  });
  const { isAdmin } = useAuth();

  const fetchData = async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.priority) params.priority = filter.priority;
      const [dataRes, statsRes] = await Promise.all([
        incidentAPI.getAll(params),
        incidentAPI.getStats()
      ]);
      setData(dataRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Incidents fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

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
      await incidentAPI.create(payload);
      setShowModal(false);
      setForm({
        title: '',
        type: 'fire',
        location: '',
        zone: 'central',
        priority: 'medium',
        description: '',
        coordinates: { lat: '', lng: '' },
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await incidentAPI.update(id, { status });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      await incidentAPI.delete(id);
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

  const typeChartData = stats?.byType?.map((t, i) => ({
    name: t._id, value: t.count, fill: COLORS[i % COLORS.length]
  })) || [];

  return (
    <div className="module-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>🚨 Emergency & Incidents</h1>
          <p>Report, track, and manage city emergencies</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Report Incident
          </button>
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-5 mb-1">
        <div className="stat-card">
          <div className="stat-icon blue"><AlertTriangle size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.total || 0}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Flame size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.open || 0}</span>
            <span className="stat-label">Open</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.inProgress || 0}</span>
            <span className="stat-label">In Progress</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Shield size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.resolved || 0}</span>
            <span className="stat-label">Resolved</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Zap size={18} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.critical || 0}</span>
            <span className="stat-label">Critical</span>
          </div>
        </div>
      </div>

      {/* Type chart */}
      {typeChartData.length > 0 && (
        <div className="card chart-section mb-1">
          <h3>Incidents by Type</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={typeChartData} innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {typeChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              {typeChartData.map(d => (
                <span key={d.name} className="legend-item">
                  <span className="legend-dot" style={{ background: d.fill }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Incident Cards */}
      <div className="card-grid">
        {data.map(incident => (
          <div key={incident._id} className={`incident-card priority-${incident.priority}`}>
            <div className="incident-header">
              <h4>{incident.title}</h4>
              <span className={`badge badge-${incident.priority}`}>{incident.priority}</span>
            </div>
            <div className="incident-meta">
              <span className={`badge badge-${incident.status === 'open' ? 'open' : incident.status === 'in-progress' ? 'in-progress' : 'resolved'}`}>
                {incident.status}
              </span>
              <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                {incident.type}
              </span>
            </div>
            <p className="incident-description">{incident.description}</p>
            <div className="item-details">
              <span><MapPin size={13} /> {incident.location} ({incident.zone})</span>
              <span><Clock size={13} /> {new Date(incident.createdAt).toLocaleString()}</span>
              {incident.responseTime && <span>Response Time: {incident.responseTime} min</span>}
              {incident.createdBy && <span><User size={13} /> Created by: {incident.createdBy.name}</span>}
            </div>
            <div className="item-actions">
              {incident.status === 'open' && (
                <button className="btn btn-sm btn-primary" onClick={() => handleUpdateStatus(incident._id, 'in-progress')}>
                  Start Progress
                </button>
              )}
              {incident.status === 'in-progress' && (
                <button className="btn btn-sm btn-success" onClick={() => handleUpdateStatus(incident._id, 'resolved')}>
                  Resolve
                </button>
              )}
              {isAdmin && (
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(incident._id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {data.length === 0 && <div className="empty-state"><p>No incidents found</p></div>}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Report New Incident</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Incident title" />
              </div>
              <div className="input-group">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {['fire', 'accident', 'crime', 'flood', 'gas-leak', 'power-outage', 'other'].map(t => (
                    <option key={t} value={t}>{t.replace('-', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Location</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required placeholder="Where is it?" />
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
              <div className="input-group">
                <label>Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="Describe the incident..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">Report Incident</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LocationPickerModal
        isOpen={showLocationPicker}
        title="Pick incident location"
        initialCoordinates={form.coordinates}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handlePickCoordinates}
      />
    </div>
  );
};

export default Incidents;
