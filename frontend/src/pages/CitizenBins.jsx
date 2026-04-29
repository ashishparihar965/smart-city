import { useState, useEffect, useCallback } from 'react';
import { binsAPI } from '../services/api';
import socketService from '../services/socket';
import {
  MapContainer, TileLayer, CircleMarker, Popup, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, Navigation, Clock, X, Droplets } from 'lucide-react';
import './CitizenBins.css';

const MAP_CENTER = [22.7388, 75.8904];

const getStatusColor = (status) => {
  if (status === 'full') return '#ef4444';
  if (status === 'medium') return '#f59e0b';
  return '#10b981';
};

const MapBounds = ({ bins }) => {
  const map = useMap();
  useEffect(() => {
    if (bins.length === 0) return;
    const bounds = bins.map(b => [b.latitude, b.longitude]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [bins, map]);
  return null;
};

const CitizenBins = () => {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBin, setSelectedBin] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const fetchBins = useCallback(async () => {
    try {
      const res = await binsAPI.getAll();
      setBins(res.data.data);
    } catch (err) {
      console.error('Bins fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBins();

    // Get user location for directions
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn('Geolocation denied'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [fetchBins]);

  // Real-time updates
  useEffect(() => {
    const handleUpdate = (updatedBins) => {
      setBins(updatedBins);
      if (selectedBin) {
        const updated = updatedBins.find(b => b._id === selectedBin._id);
        if (updated) setSelectedBin(updated);
      }
    };
    socketService.on('bins:update', handleUpdate);
    return () => socketService.off('bins:update', handleUpdate);
  }, [selectedBin]);

  const handleGetDirections = (bin) => {
    const origin = userLocation
      ? `${userLocation.lat},${userLocation.lng}`
      : '';
    const destination = `${bin.latitude},${bin.longitude}`;
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="citizen-bins-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><Trash2 size={22} style={{ display: 'inline', marginRight: 8 }} />Waste / Dustbins</h1>
          <p>Find nearby dustbins and get directions</p>
        </div>
      </div>

      {/* Legend */}
      <div className="citizen-bins-legend">
        <div className="legend-dot-wrap">
          <span className="legend-dot-sm" style={{ background: '#10b981' }} />
          Low (0–50%)
        </div>
        <div className="legend-dot-wrap">
          <span className="legend-dot-sm" style={{ background: '#f59e0b' }} />
          Medium (50–80%)
        </div>
        <div className="legend-dot-wrap">
          <span className="legend-dot-sm" style={{ background: '#ef4444' }} />
          Full (80–100%)
        </div>
        <div className="legend-dot-wrap">
          <span className="legend-dot-sm" style={{ background: '#3b82f6' }} />
          Your Location
        </div>
      </div>

      {/* Map */}
      <div className="citizen-bins-map-wrapper">
        <MapContainer center={MAP_CENTER} zoom={13} style={{ height: 'calc(100vh - 210px)', minHeight: '400px', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {bins.length > 0 && <MapBounds bins={bins} />}
          {bins.map(bin => (
            <CircleMarker
              key={bin._id}
              center={[bin.latitude, bin.longitude]}
              radius={9}
              pathOptions={{
                color: getStatusColor(bin.status),
                fillColor: getStatusColor(bin.status),
                fillOpacity: 0.8,
                weight: 2
              }}
              eventHandlers={{ click: () => setSelectedBin(bin) }}
            />
          ))}

          {/* User's current location */}
          {userLocation && (
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={10}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.9,
                weight: 3
              }}
              className="user-location-pulse"
            >
              <Popup>📍 You are here</Popup>
            </CircleMarker>
          )}
        </MapContainer>

        {/* Floating Info Card */}
        {selectedBin && (
          <div className="citizen-bin-info">
            <div className="citizen-bin-info-header">
              <h3>{selectedBin.name}</h3>
              <button className="citizen-bin-info-close" onClick={() => setSelectedBin(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="citizen-bin-info-row">
              <span className="label"><Droplets size={12} /> Fill Level</span>
              <span className="value" style={{ color: getStatusColor(selectedBin.status) }}>
                {selectedBin.fill_level}% — {selectedBin.status.charAt(0).toUpperCase() + selectedBin.status.slice(1)}
              </span>
            </div>

            <div className="citizen-bin-info-row">
              <span className="label"><Clock size={12} /> Last Cleaned</span>
              <span className="value">
                {selectedBin.last_collected_at
                  ? new Date(selectedBin.last_collected_at).toLocaleDateString()
                  : 'Not yet'}
              </span>
            </div>

            <button
              className="citizen-bin-directions-btn"
              onClick={() => handleGetDirections(selectedBin)}
            >
              <Navigation size={15} /> Get Directions
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenBins;
