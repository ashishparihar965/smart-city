import { useState, useEffect, useCallback } from 'react';
import { trafficAPI } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RefreshCw, AlertTriangle, MapPin, Timer, Activity } from 'lucide-react';
import './AdminTraffic.css';

const DIR_LABELS = { N:'North', S:'South', E:'East', W:'West', NE:'North-East', NW:'North-West', SE:'South-East', SW:'South-West' };

const signalIcon = (density) => L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50%;background:${density === 'high' ? '#ef4444' : density === 'medium' ? '#f59e0b' : '#10b981'};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
    <span style="color:white;font-size:11px;font-weight:800">🚦</span>
  </div>`,
  iconSize: [26, 26], iconAnchor: [13, 13]
});

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.4);animation:pulse 2s infinite"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 11]
});

function UserLocation({ position }) {
  const map = useMap();
  useEffect(() => { if (position) map.setView(position, 14); }, [position, map]);
  return position ? <Marker position={position} icon={userIcon}><Popup>📍 Your Location</Popup></Marker> : null;
}

const CitizenTraffic = () => {
  const [signals, setSignals] = useState([]);
  const [congested, setCongested] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState(null);
  const [timerValues, setTimerValues] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [allRes, congRes] = await Promise.all([trafficAPI.getAll(), trafficAPI.getCongestion()]);
      setSignals(allRes.data.data || []);
      setCongested(congRes.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        () => setUserPos(null)
      );
    }
  }, []);

  // Countdown timers
  useEffect(() => {
    const t = {};
    signals.forEach(s => { t[s._id] = s.simulation?.signalTime || s.signalTime || 25; });
    setTimerValues(t);
  }, [signals]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerValues(prev => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          next[id] = Math.max(0, next[id] - 1);
          if (next[id] === 0) {
            const sig = signals.find(s => s._id === id);
            next[id] = sig?.simulation?.signalTime || sig?.signalTime || 25;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [signals]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div className="traffic-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>🚦 Smart Traffic</h1>
          <p>Real-time traffic signal status and congestion info</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchData}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="traffic-stats-grid">
        {[
          { label: 'Total Signals', value: signals.length, icon: '🚦', cls: 'blue' },
          { label: 'High Congestion', value: congested.length, icon: '🔴', cls: 'red' },
          { label: 'Your Location', value: userPos ? '📍 Active' : '—', icon: '📍', cls: 'green' },
          { label: 'Last Updated', value: 'Live', icon: '⚡', cls: 'cyan' },
        ].map(s => (
          <div key={s.label} className="traffic-stat-card">
            <div className={`traffic-stat-icon ${s.cls}`}>{s.icon}</div>
            <div className="traffic-stat-info">
              <span className="traffic-stat-value" style={{ fontSize: typeof s.value === 'string' ? '1rem' : undefined }}>{s.value}</span>
              <span className="traffic-stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="traffic-map-container">
        <MapContainer center={userPos || [22.7196, 75.8577]} zoom={13} scrollWheelZoom>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />
          <UserLocation position={userPos} />
          {signals.map(sig => {
            const sim = sig.simulation;
            const dirCounts = sim?.directionCounts
              ? (typeof sim.directionCounts.toJSON === 'function' ? sim.directionCounts.toJSON() : sim.directionCounts)
              : {};
            return (
              <Marker key={sig._id} position={[sig.latitude, sig.longitude]}
                icon={signalIcon(sim?.density || 'low')}>
                <Popup>
                  <div className="signal-popup">
                    <h4>🚦 {sig.name}</h4>
                    <div className="signal-popup-row"><span>Active:</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>{sig.groups[sig.activeGroup]?.join(' + ') || '—'}</span>
                    </div>
                    <div className="signal-popup-row"><span>Timer:</span>
                      <span>{timerValues[sig._id] ?? '—'}s</span>
                    </div>
                    <div className="signal-popup-row"><span>Density:</span>
                      <span className={`density-badge ${sim?.density || 'low'}`}>{sim?.density || 'N/A'}</span>
                    </div>
                    {Object.entries(dirCounts).map(([d, c]) => (
                      <div key={d} className="signal-popup-row"><span>{d}:</span><span>{c?.total ?? 0} vehicles</span></div>
                    ))}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Congestion Section */}
      {congested.length > 0 && (
        <div className="congestion-section">
          <h3><AlertTriangle size={18} /> High Congestion Signals</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            These signals have high vehicle density. Consider avoiding these routes.
          </p>
          <div className="congestion-list">
            {congested.map(item => (
              <div key={item.signal._id} className="congestion-item">
                <div className="congestion-item-info">
                  <span className="congestion-item-name">🚦 {item.signal.name}</span>
                  <span className="congestion-item-detail">
                    📍 {item.signal.latitude.toFixed(4)}, {item.signal.longitude.toFixed(4)} · {item.simulation.totalCount} vehicles
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="density-badge high">HIGH</span>
                  <div className="signal-timer">
                    <div className="timer-circle">{timerValues[item.signal._id] ?? '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Signals List */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>📋 All Traffic Signals</h3>
        <div className="signal-list">
          {signals.map(sig => {
            const sim = sig.simulation;
            return (
              <div key={sig._id} className="signal-list-card">
                <div className="signal-list-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>🚦</div>
                <div className="signal-list-info">
                  <div className="signal-list-name">{sig.name}</div>
                  <div className="signal-list-meta">
                    <span>Active: {sig.groups[sig.activeGroup]?.join(' + ') || '—'}</span>
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
                </div>
              </div>
            );
          })}
          {signals.length === 0 && <div className="empty-state"><p>No traffic signals available</p></div>}
        </div>
      </div>
    </div>
  );
};

export default CitizenTraffic;
