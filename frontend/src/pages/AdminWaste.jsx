import { useState, useEffect, useCallback } from 'react';
import { binsAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import LocationPickerModal from '../components/LocationPickerModal';
import {
  MapContainer, TileLayer, CircleMarker, Popup, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Trash2, Plus, RefreshCw, MapPin, Clock, AlertCircle,
  CheckCircle, X, Flag, Package
} from 'lucide-react';
import './AdminWaste.css';

const MAP_CENTER = [22.7388, 75.8904];

const getStatusColor = (status) => {
  if (status === 'full') return '#ef4444';
  if (status === 'medium') return '#f59e0b';
  return '#10b981';
};

const getFillColor = (level) => {
  if (level > 80) return '#ef4444';
  if (level > 50) return '#f59e0b';
  return '#10b981';
};

// Auto-fit map bounds to markers
const MapBounds = ({ bins }) => {
  const map = useMap();
  useEffect(() => {
    if (bins.length === 0) return;
    const bounds = bins.map(b => [b.latitude, b.longitude]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [bins, map]);
  return null;
};

const AdminWaste = () => {
  const [bins, setBins] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBin, setSelectedBin] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [newBin, setNewBin] = useState({ name: '', latitude: null, longitude: null, capacity: '' });
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [binsRes, statsRes] = await Promise.all([
        binsAPI.getAll(),
        binsAPI.getStats()
      ]);
      setBins(binsRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Bins fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates via Socket.io
  useEffect(() => {
    const handleBinsUpdate = (updatedBins) => {
      setBins(updatedBins);
      // Also update selected bin if it's open
      if (selectedBin) {
        const updated = updatedBins.find(b => b._id === selectedBin._id);
        if (updated) setSelectedBin(updated);
      }
    };

    socketService.on('bins:update', handleBinsUpdate);
    return () => socketService.off('bins:update', handleBinsUpdate);
  }, [selectedBin]);

  const handleMarkCollection = async (binId) => {
    try {
      await binsAPI.markCollection(binId);
      addToast('Bin marked for collection', 'success');
      setSelectedBin(null);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to mark', 'error');
    }
  };

  const handleAddBin = async () => {
    if (!newBin.name || !newBin.latitude || !newBin.longitude) {
      addToast('Name and location are required', 'error');
      return;
    }
    try {
      await binsAPI.addBin({
        name: newBin.name,
        latitude: newBin.latitude,
        longitude: newBin.longitude,
        capacity: newBin.capacity ? Number(newBin.capacity) : undefined
      });
      addToast('Bin added successfully!', 'success');
      setShowAddModal(false);
      setNewBin({ name: '', latitude: null, longitude: null, capacity: '' });
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add bin', 'error');
    }
  };

  const handleLocationPicked = (coords) => {
    if (coords) {
      setNewBin(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }));
    }
    setShowLocationPicker(false);
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><Trash2 size={22} style={{ display: 'inline', marginRight: 8 }} />Waste Management</h1>
          <p>Monitor bins, manage collection, and add new dustbins</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="waste-stats-row">
        <div className="waste-stat-card">
          <div className="waste-stat-icon blue"><Package size={20} /></div>
          <div className="waste-stat-info">
            <span className="waste-stat-value">{stats?.totalBins || 0}</span>
            <span className="waste-stat-label">Total Bins</span>
          </div>
        </div>
        <div className="waste-stat-card">
          <div className="waste-stat-icon red"><AlertCircle size={20} /></div>
          <div className="waste-stat-info">
            <span className="waste-stat-value">{stats?.fullBins || 0}</span>
            <span className="waste-stat-label">Full Bins</span>
          </div>
        </div>
        <div className="waste-stat-card">
          <div className="waste-stat-icon yellow"><Flag size={20} /></div>
          <div className="waste-stat-info">
            <span className="waste-stat-value">{stats?.needsCollection || 0}</span>
            <span className="waste-stat-label">Needs Collection</span>
          </div>
        </div>
        <div className="waste-stat-card">
          <div className="waste-stat-icon green"><CheckCircle size={20} /></div>
          <div className="waste-stat-info">
            <span className="waste-stat-value">{stats?.lowBins || 0}</span>
            <span className="waste-stat-label">Low Fill</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="waste-map-wrapper">
        <MapContainer center={MAP_CENTER} zoom={13} style={{ height: '480px', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {bins.length > 0 && <MapBounds bins={bins} />}
          {bins.map(bin => (
            <CircleMarker
              key={bin._id}
              center={[bin.latitude, bin.longitude]}
              radius={10}
              pathOptions={{
                color: getStatusColor(bin.status),
                fillColor: getStatusColor(bin.status),
                fillOpacity: 0.8,
                weight: 2
              }}
              eventHandlers={{ click: () => setSelectedBin(bin) }}
            >
              <Popup>
                <strong>{bin.name}</strong><br />
                Fill: {bin.fill_level}% ({bin.status})
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Floating Add Button */}
        <button className="waste-fab" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Add Bin
        </button>
      </div>

      {/* All Bins — Card Grid */}
      <div className="waste-cards-section">
        <div className="waste-cards-header">
          <h2><Package size={18} /> All Bins ({bins.length})</h2>
        </div>
        <div className="waste-card-grid">
          {bins.map(bin => (
            <div
              key={bin._id}
              className={`waste-bin-card ${selectedBin?._id === bin._id ? 'active' : ''}`}
              onClick={() => setSelectedBin(bin)}
            >
              <div className="wbc-top">
                <div className="wbc-name">{bin.name}</div>
                <span className={`status-badge ${bin.status}`}>
                  {bin.status}
                </span>
              </div>

              <div className="wbc-fill-row">
                <div className="bin-fill-bar">
                  <div
                    className="bin-fill-bar-inner"
                    style={{ width: `${bin.fill_level}%`, background: getFillColor(bin.fill_level) }}
                  />
                </div>
                <span className="wbc-fill-pct" style={{ color: getFillColor(bin.fill_level) }}>
                  {bin.fill_level}%
                </span>
              </div>

              <div className="wbc-details">
                <span><MapPin size={12} /> {bin.latitude?.toFixed(4)}, {bin.longitude?.toFixed(4)}</span>
                <span>
                  <Clock size={12} />{' '}
                  {bin.last_collected_at
                    ? new Date(bin.last_collected_at).toLocaleDateString()
                    : 'Never collected'}
                </span>
              </div>

              <div className="wbc-actions">
                {bin.needs_collection && (
                  <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>⚠ Needs Collection</span>
                )}
                <button
                  className="btn btn-sm btn-primary"
                  onClick={(e) => { e.stopPropagation(); handleMarkCollection(bin._id); }}
                >
                  <Flag size={12} /> Mark Collection
                </button>
              </div>
            </div>
          ))}
        </div>
        {bins.length === 0 && (
          <div className="empty-state"><p>No bins found. Add your first bin using the button above.</p></div>
        )}
      </div>

      {/* Bin Detail Sidebar */}
      {selectedBin && (
        <div className="bin-detail-overlay" onClick={() => setSelectedBin(null)}>
          <div className="bin-detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="bin-detail-header">
              <div>
                <h2>{selectedBin.name}</h2>
                <span className={`status-badge ${selectedBin.status}`}>
                  {selectedBin.status}
                </span>
              </div>
              <button className="bin-detail-close" onClick={() => setSelectedBin(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="bin-detail-fill">
              <div className="bin-detail-fill-value" style={{ color: getFillColor(selectedBin.fill_level) }}>
                {selectedBin.fill_level}%
              </div>
              <div className="bin-detail-fill-label">Fill Level</div>
              <div className="bin-fill-bar" style={{ marginTop: 8 }}>
                <div
                  className="bin-fill-bar-inner"
                  style={{ width: `${selectedBin.fill_level}%`, background: getFillColor(selectedBin.fill_level) }}
                />
              </div>
            </div>

            <div className="bin-detail-row">
              <span className="label">Bin ID</span>
              <span className="value">{selectedBin._id?.slice(-8).toUpperCase()}</span>
            </div>
            <div className="bin-detail-row">
              <span className="label">Status</span>
              <span className="value" style={{ color: getStatusColor(selectedBin.status) }}>
                {selectedBin.status.charAt(0).toUpperCase() + selectedBin.status.slice(1)}
              </span>
            </div>
            <div className="bin-detail-row">
              <span className="label"><MapPin size={12} /> Location</span>
              <span className="value">{selectedBin.latitude?.toFixed(4)}, {selectedBin.longitude?.toFixed(4)}</span>
            </div>
            <div className="bin-detail-row">
              <span className="label"><Clock size={12} /> Last Collected</span>
              <span className="value">
                {selectedBin.last_collected_at
                  ? new Date(selectedBin.last_collected_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            {selectedBin.capacity && (
              <div className="bin-detail-row">
                <span className="label">Capacity</span>
                <span className="value">{selectedBin.capacity}L</span>
              </div>
            )}

            <div className="bin-detail-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleMarkCollection(selectedBin._id)}
                style={{ width: '100%' }}
              >
                <Flag size={14} /> Mark for Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bin Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><Plus size={18} /> Add New Bin</h2>
            <div className="add-bin-form">
              <div className="input-group">
                <label>Bin Name / ID</label>
                <input
                  value={newBin.name}
                  onChange={(e) => setNewBin(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. BIN-021 Market Road"
                />
              </div>

              <div className="input-group">
                <label>Location</label>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowLocationPicker(true)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <MapPin size={14} />
                  {newBin.latitude ? `${newBin.latitude.toFixed(4)}, ${newBin.longitude.toFixed(4)}` : 'Pick on Map'}
                </button>
              </div>

              {newBin.latitude && (
                <div className="add-bin-coords">
                  <div className="coord-display">Lat: {newBin.latitude.toFixed(6)}</div>
                  <div className="coord-display">Lng: {newBin.longitude.toFixed(6)}</div>
                </div>
              )}

              <div className="input-group">
                <label>Capacity (Liters, optional)</label>
                <input
                  type="number"
                  value={newBin.capacity}
                  onChange={(e) => setNewBin(prev => ({ ...prev, capacity: e.target.value }))}
                  placeholder="e.g. 120"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddBin}>
                <Plus size={14} /> Add Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker (reused component) */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        title="Select Bin Location"
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handleLocationPicked}
      />
    </div>
  );
};

export default AdminWaste;
