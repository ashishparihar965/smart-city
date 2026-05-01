import { useState, useEffect, useCallback } from 'react';
import { binsAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import {
  MapContainer, TileLayer, CircleMarker, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Truck, CheckCircle, RefreshCw, MapPin, Clock, AlertCircle, Trash2
} from 'lucide-react';
import './OperatorWaste.css';

const MAP_CENTER = [22.7388, 75.8904];

const MapBounds = ({ bins }) => {
  const map = useMap();
  useEffect(() => {
    if (bins.length === 0) return;
    const bounds = bins.map(b => [b.latitude, b.longitude]);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [bins, map]);
  return null;
};

const OperatorWaste = () => {
  const [fullBins, setFullBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(null);
  const { addToast } = useToast();

  const fetchFullBins = useCallback(async () => {
    try {
      const res = await binsAPI.getFull();
      setFullBins(res.data.data);
    } catch (err) {
      console.error('Full bins fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFullBins();
  }, [fetchFullBins]);

  // Real-time updates
  useEffect(() => {
    const handleUpdate = (allBins) => {
      // Filter for full bins or bins needing collection
      const filtered = allBins.filter(b => b.fill_level > 80 || b.needs_collection);
      setFullBins(filtered);
    };
    socketService.on('bins:update', handleUpdate);
    return () => socketService.off('bins:update', handleUpdate);
  }, []);

  const handleCollect = async (binId) => {
    setCollecting(binId);
    try {
      await binsAPI.collected(binId);
      addToast('Bin collected — reset to 0%', 'success');
      fetchFullBins();
    } catch (err) {
      addToast(err.response?.data?.message || 'Collection failed', 'error');
    } finally {
      setCollecting(null);
    }
  };

  const getFillColor = (level) => {
    if (level > 80) return '#ef4444';
    if (level > 50) return '#f59e0b';
    return '#10b981';
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="operator-waste-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><Truck size={22} style={{ display: 'inline', marginRight: 8 }} />Collection Dashboard</h1>
          <p>Bins requiring collection — pick up and mark as collected</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchFullBins}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="operator-waste-stats">
        <div className="ow-stat-card">
          <div className="ow-stat-value" style={{ color: '#ef4444' }}>{fullBins.length}</div>
          <div className="ow-stat-label">Bins in Queue</div>
        </div>
        <div className="ow-stat-card">
          <div className="ow-stat-value" style={{ color: '#f59e0b' }}>
            {fullBins.filter(b => b.fill_level >= 90).length}
          </div>
          <div className="ow-stat-label">Critical (≥90%)</div>
        </div>
        <div className="ow-stat-card">
          <div className="ow-stat-value" style={{ color: '#3b82f6' }}>
            {fullBins.filter(b => b.needs_collection).length}
          </div>
          <div className="ow-stat-label">Flagged by Admin</div>
        </div>
      </div>

      {/* Mini Map of full bins */}
      {fullBins.length > 0 && (
        <div className="operator-waste-map">
          <MapContainer center={MAP_CENTER} zoom={13} style={{ height: '280px', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
            />
            <MapBounds bins={fullBins} />
            {fullBins.map(bin => (
              <CircleMarker
                key={bin._id}
                center={[bin.latitude, bin.longitude]}
                radius={8}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.85,
                  weight: 2
                }}
              />
            ))}
          </MapContainer>
        </div>
      )}

      {/* Collection Queue Table */}
      <div className="operator-waste-table-wrap">
        {fullBins.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Bin</th>
                <th>Location</th>
                <th>Fill Level</th>
                <th>Last Collected</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fullBins.map(bin => (
                <tr key={bin._id}>
                  <td style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                      {bin.name}
                    </div>
                    {bin.needs_collection && (
                      <span className="badge badge-blue" style={{ fontSize: '0.65rem', marginTop: 2 }}>
                        Admin Flagged
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <MapPin size={12} style={{ marginRight: 3 }} />
                    {bin.latitude?.toFixed(4)}, {bin.longitude?.toFixed(4)}
                  </td>
                  <td>
                    <div className="ow-fill-cell">
                      <div className="ow-fill-bar">
                        <div
                          className="ow-fill-bar-inner"
                          style={{ width: `${bin.fill_level}%`, background: getFillColor(bin.fill_level) }}
                        />
                      </div>
                      <span className="ow-fill-pct" style={{ color: getFillColor(bin.fill_level) }}>
                        {bin.fill_level}%
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <Clock size={12} style={{ marginRight: 3 }} />
                    {bin.last_collected_at
                      ? new Date(bin.last_collected_at).toLocaleString()
                      : 'Never'}
                  </td>
                  <td>
                    <button
                      className="ow-collect-btn"
                      onClick={() => handleCollect(bin._id)}
                      disabled={collecting === bin._id}
                    >
                      <CheckCircle size={14} />
                      {collecting === bin._id ? 'Collecting...' : 'Mark Collected'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="ow-empty-state">
            <CheckCircle size={40} />
            <h3>All Clear!</h3>
            <p>No bins currently require collection. Great job! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorWaste;
