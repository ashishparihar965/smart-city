import { useState, useEffect, useRef, useCallback } from 'react';
import { trafficAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import LocationPickerModal from '../components/LocationPickerModal';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  TrafficCone, Plus, RefreshCw, X, Zap, Timer, Car,
  Bike, Bus, Truck, Upload, Play, Shield, MapPin, Activity
} from 'lucide-react';
import './AdminTraffic.css';

const ALL_DIRS = ['N','S','E','W','NE','NW','SE','SW'];
const DIR_LABELS = { N:'North', S:'South', E:'East', W:'West', NE:'North-East', NW:'North-West', SE:'South-East', SW:'South-West' };

const signalIcon = (isHigh) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:${isHigh ? '#ef4444' : '#10b981'};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
    <span style="color:white;font-size:12px;font-weight:800">🚦</span>
  </div>`,
  iconSize: [28, 28], iconAnchor: [14, 14]
});

// LocationPicker removed — using LocationPickerModal instead

const AdminTraffic = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simFiles, setSimFiles] = useState({});
  const [simPreviews, setSimPreviews] = useState({});
  const [registerForm, setRegisterForm] = useState({ name: '', latitude: '', longitude: '', directions: [] });
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [timerValues, setTimerValues] = useState({});
  const { addToast } = useToast();

  const fetchSignals = useCallback(async () => {
    try {
      const res = await trafficAPI.getAll();
      setSignals(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  // Countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerValues(prev => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          next[id] = Math.max(0, next[id] - 1);
          if (next[id] === 0) {
            const sig = signals.find(s => s._id === id);
            if (sig?.simulation) next[id] = sig.simulation.signalTime || 25;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [signals]);

  useEffect(() => {
    const t = {};
    signals.forEach(s => { t[s._id] = s.simulation?.signalTime || s.signalTime || 25; });
    setTimerValues(t);
  }, [signals]);

  const handleRegister = async () => {
    const { name, latitude, longitude, directions } = registerForm;
    if (!name || !latitude || !longitude || directions.length < 2) {
      addToast('Fill all fields, pick at least 2 directions', 'error'); return;
    }
    try {
      await trafficAPI.register({ name, latitude: Number(latitude), longitude: Number(longitude), directions });
      addToast('Signal registered!', 'success');
      setShowRegister(false);
      setRegisterForm({ name: '', latitude: '', longitude: '', directions: [] });
      fetchSignals();
    } catch (err) { addToast(err.response?.data?.message || 'Registration failed', 'error'); }
  };

  const handleManualControl = async (signalId, groupIdx) => {
    try {
      await trafficAPI.manualControl({ signalId, activeGroup: groupIdx });
      addToast(`Group ${groupIdx} activated`, 'success');
      fetchSignals();
    } catch (err) { addToast(err.response?.data?.message || 'Control failed', 'error'); }
  };

  const handleFileSelect = (dir, file) => {
    setSimFiles(prev => ({ ...prev, [dir]: file }));
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setSimPreviews(prev => ({ ...prev, [dir]: e.target.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSimulate = async () => {
    if (!selected) return;
    const missing = selected.directions.filter(d => !simFiles[d]);
    if (missing.length) { addToast(`Upload images for: ${missing.join(', ')}`, 'error'); return; }
    setSimLoading(true);
    try {
      const fd = new FormData();
      fd.append('signalId', selected._id);
      selected.directions.forEach(d => fd.append(d, simFiles[d]));
      const res = await trafficAPI.simulate(fd);
      setSimResult(res.data.data.result);
      addToast('Simulation complete!', 'success');
      fetchSignals();
    } catch (err) { addToast('Simulation failed', 'error'); }
    finally { setSimLoading(false); }
  };

  const openSimulate = (sig) => {
    setSelected(sig);
    setShowSimulate(true);
    setSimResult(null);
    setSimFiles({});
    setSimPreviews({});
  };

  const toggleDir = (d) => {
    setRegisterForm(prev => ({
      ...prev,
      directions: prev.directions.includes(d) ? prev.directions.filter(x => x !== d) : [...prev.directions, d]
    }));
  };

  const stats = {
    total: signals.length,
    high: signals.filter(s => s.simulation?.density === 'high').length,
    medium: signals.filter(s => s.simulation?.density === 'medium').length,
    low: signals.filter(s => !s.simulation || s.simulation?.density === 'low').length
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div className="traffic-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>🚦 Traffic Management</h1>
          <p>Map-based smart traffic signal control with AI simulation</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowRegister(true)}><Plus size={14} /> Register Signal</button>
          <button className="btn btn-outline" onClick={fetchSignals}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="traffic-stats-grid">
        {[
          { label: 'Total Signals', value: stats.total, icon: '🚦', cls: 'blue' },
          { label: 'High Density', value: stats.high, icon: '🔴', cls: 'red' },
          { label: 'Medium Density', value: stats.medium, icon: '🟡', cls: 'amber' },
          { label: 'Low Density', value: stats.low, icon: '🟢', cls: 'green' },
        ].map(s => (
          <div key={s.label} className="traffic-stat-card">
            <div className={`traffic-stat-icon ${s.cls}`}>{s.icon}</div>
            <div className="traffic-stat-info">
              <span className="traffic-stat-value">{s.value}</span>
              <span className="traffic-stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="traffic-map-container">
        <MapContainer center={[22.7196, 75.8577]} zoom={13} scrollWheelZoom>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />

          {signals.map(sig => (
            <Marker key={sig._id} position={[sig.latitude, sig.longitude]}
              icon={signalIcon(sig.simulation?.density === 'high')}>
              <Popup>
                <div className="signal-popup">
                  <h4>🚦 {sig.name}</h4>
                  <div className="signal-popup-row"><span>Directions:</span><span>{sig.directions.join(', ')}</span></div>
                  <div className="signal-popup-row"><span>Active Group:</span>
                    <span>{sig.groups[sig.activeGroup]?.join(' + ') || '—'}</span>
                  </div>
                  <div className="signal-popup-row"><span>Timing:</span><span>{sig.simulation?.signalTime || sig.signalTime}s</span></div>
                  <div className="signal-popup-row"><span>Density:</span>
                    <span className={`density-badge ${sig.simulation?.density || 'low'}`}>{sig.simulation?.density || 'N/A'}</span>
                  </div>
                  {sig.simulation?.directionCounts && Object.entries(
                    typeof sig.simulation.directionCounts.toJSON === 'function' ? sig.simulation.directionCounts.toJSON() : sig.simulation.directionCounts
                  ).map(([d, c]) => (
                    <div key={d} className="signal-popup-row"><span>{d}:</span><span>{c?.total ?? 0} vehicles</span></div>
                  ))}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => openSimulate(sig)}>Simulate</button>
                    <button className="btn btn-sm btn-outline" onClick={() => setSelected(sig)}>Details</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Signal List */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>📋 All Signals</h3>
        <div className="signal-list">
          {signals.length === 0 && <div className="empty-state"><p>No signals registered yet</p></div>}
          {signals.map(sig => {
            const sim = sig.simulation;
            const dirCounts = sim?.directionCounts
              ? (typeof sim.directionCounts.toJSON === 'function' ? sim.directionCounts.toJSON() : sim.directionCounts)
              : {};
            return (
              <div key={sig._id} className={`signal-list-card ${selected?._id === sig._id ? 'active' : ''}`}
                onClick={() => setSelected(sig)}>
                <div className="signal-list-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>🚦</div>
                <div className="signal-list-info">
                  <div className="signal-list-name">{sig.name}</div>
                  <div className="signal-list-meta">
                    <span>📍 {sig.latitude.toFixed(4)}, {sig.longitude.toFixed(4)}</span>
                    <span>⏱ {sim?.signalTime || sig.signalTime}s</span>
                    <span>🚗 {sim?.totalCount ?? 0} vehicles</span>
                  </div>
                </div>
                <div className="signal-list-right">
                  <div className="dir-tags">
                    {sig.directions.map(d => (
                      <span key={d} className={`dir-tag ${sig.groups[sig.activeGroup]?.includes(d) ? 'active' : ''}`}>{d}</span>
                    ))}
                  </div>
                  {sim && <span className={`density-badge ${sim.density}`}>{sim.density}</span>}
                  <div className="signal-timer">
                    <div className="timer-circle">{timerValues[sig._id] ?? '—'}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); openSimulate(sig); }}>
                    <Play size={12} /> Simulate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Signal Details + Manual Control */}
      {selected && !showSimulate && (
        <div className="manual-control-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4><Shield size={16} /> Manual Control — {selected.name}</h4>
            <button className="btn btn-sm btn-outline" onClick={() => setSelected(null)}><X size={13} /></button>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Click a group to manually activate it (overrides AI):
          </p>
          <div className="group-controls">
            {selected.groups.map((grp, idx) => (
              <button key={idx} className={`group-btn ${selected.activeGroup === idx ? 'active' : ''}`}
                onClick={() => handleManualControl(selected._id, idx)}>
                {selected.activeGroup === idx && '🟢 '}
                Group {idx}: {grp.join(' + ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Simulate Modal */}
      {showSimulate && selected && (
        <div className="modal-overlay" onClick={() => setShowSimulate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header-row">
              <h2>🤖 Simulate Traffic — {selected.name}</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowSimulate(false)}><X size={14} /></button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Upload one traffic image per direction. YOLO will detect vehicles and determine the optimal signal group.
            </p>

            <div className="simulate-uploads">
              {selected.directions.map(dir => (
                <label key={dir} className={`simulate-upload-card ${simFiles[dir] ? 'has-file' : ''}`}>
                  <div className="direction-label">{dir}</div>
                  <div className="upload-hint">{DIR_LABELS[dir]}</div>
                  {simPreviews[dir] ? <img src={simPreviews[dir]} alt={dir} className="preview" />
                    : <Upload size={20} style={{ margin: '0.5rem 0', opacity: 0.4 }} />}
                  {simFiles[dir] && <div className="file-name">{simFiles[dir].name}</div>}
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => handleFileSelect(dir, e.target.files[0])} />
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={handleSimulate} disabled={simLoading}>
                {simLoading ? <><RefreshCw size={14} className="spin-icon" /> Processing...</> : <><Zap size={14} /> Run Simulation</>}
              </button>
              <button className="btn btn-outline" onClick={() => setShowSimulate(false)}>Cancel</button>
            </div>

            {/* Results */}
            {simResult && (
              <div className="sim-results" style={{ marginTop: '1.25rem' }}>
                <h3>📊 Simulation Results</h3>
                <div className="sim-results-grid">
                  {Object.entries(simResult.directionCounts).map(([dir, counts]) => (
                    <div key={dir} className={`sim-dir-card ${simResult.selectedDirections.includes(dir) ? 'green-signal' : ''}`}>
                      <div className="sim-dir-label">{simResult.selectedDirections.includes(dir) ? '🟢' : '🔴'} {dir}</div>
                      <div className="sim-dir-count">{counts.total}</div>
                      <div className="sim-dir-breakdown">
                        🚗{counts.car} 🏍️{counts.bike} 🚌{counts.bus} 🚛{counts.truck}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sim-summary">
                  <div className="sim-summary-item">
                    <span className="sim-summary-label">Green Group</span>
                    <span className="sim-summary-value" style={{ color: '#10b981' }}>
                      {simResult.selectedDirections.join(' + ')}
                    </span>
                  </div>
                  <div className="sim-summary-item">
                    <span className="sim-summary-label">Signal Time</span>
                    <span className="sim-summary-value">{simResult.signalTime}s</span>
                  </div>
                  <div className="sim-summary-item">
                    <span className="sim-summary-label">Density</span>
                    <span className={`density-badge ${simResult.density}`}>{simResult.density}</span>
                  </div>
                  <div className="sim-summary-item">
                    <span className="sim-summary-label">Total Vehicles</span>
                    <span className="sim-summary-value">{simResult.totalCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header-row">
              <h2>➕ Register Signal</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowRegister(false)}><X size={14} /></button>
            </div>
            <div className="register-form">
              <div className="input-group">
                <label>Signal Name</label>
                <input value={registerForm.name} onChange={e => setRegisterForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. MG Road Junction" />
              </div>
              <div className="input-group">
                <label>Location</label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowLocationPicker(true)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <MapPin size={14} />
                  {registerForm.latitude
                    ? `📍 ${Number(registerForm.latitude).toFixed(4)}, ${Number(registerForm.longitude).toFixed(4)}`
                    : 'Select Location on Map'}
                </button>
                {registerForm.latitude && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>Lat: {Number(registerForm.latitude).toFixed(6)}</span>
                    <span>Lng: {Number(registerForm.longitude).toFixed(6)}</span>
                  </div>
                )}
              </div>
              <div className="input-group">
                <label>Directions (select at least 2)</label>
                <div className="direction-picker">
                  {ALL_DIRS.map(d => (
                    <button key={d} type="button" className={`direction-picker-btn ${registerForm.directions.includes(d) ? 'selected' : ''}`}
                      onClick={() => toggleDir(d)}>{d}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowRegister(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRegister}>Register Signal</button>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker Modal (reused component) */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        title="Select Signal Location"
        initialCoordinates={registerForm.latitude ? { lat: Number(registerForm.latitude), lng: Number(registerForm.longitude) } : null}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(coords) => {
          if (coords) {
            setRegisterForm(f => ({ ...f, latitude: coords.lat.toFixed(6), longitude: coords.lng.toFixed(6) }));
          }
          setShowLocationPicker(false);
        }}
      />
    </div>
  );
};

export default AdminTraffic;
