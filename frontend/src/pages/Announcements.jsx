import React, { useState, useEffect } from 'react';
import { announcementAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AnnouncementCard from '../components/AnnouncementCard';
import { Plus, RefreshCw, X } from 'lucide-react';
import './Announcements.css';

const Announcements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'general',
    priority: 'medium',
    zones: ['central'],
    scheduledFor: '',
    expiresAt: ''
  });
  const [refreshing, setRefreshing] = useState(false);

  const zones = ['north', 'south', 'east', 'west', 'central', 'all'];
  const types = ['traffic', 'water', 'waste', 'lighting', 'emergency', 'general', 'maintenance'];
  const priorities = ['low', 'medium', 'high', 'critical'];

  const fetchAnnouncements = async () => {
    try {
      const res = await announcementAPI.getAll({});
      setAnnouncements(res.data.data);
    } catch (err) {
      console.error('Fetch announcements error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const handleZoneChange = (zone) => {
    setFormData(prev => {
      const zones = prev.zones.includes(zone)
        ? prev.zones.filter(z => z !== zone)
        : [...prev.zones, zone];
      return { ...prev, zones };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim() || formData.zones.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor).toISOString() : undefined,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined
      };
      
      await announcementAPI.create(payload);
      setFormData({
        title: '',
        message: '',
        type: 'general',
        priority: 'medium',
        zones: ['central'],
        scheduledFor: '',
        expiresAt: ''
      });
      setShowForm(false);
      fetchAnnouncements();
    } catch (err) {
      console.error('Create announcement error:', err);
      alert(err.response?.data?.message || 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      await announcementAPI.delete(id);
      fetchAnnouncements();
    } catch (err) {
      console.error('Delete announcement error:', err);
      alert('Failed to delete announcement');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="empty-state">
        <p>Access denied. Only admins can manage announcements.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="announcements-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>City Announcements</h1>
          <p>Create and manage civic alerts for all citizens</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={15} />
            {showForm ? 'Cancel' : 'New Announcement'}
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="announcement-form-container card">
          <h3>Create New Announcement</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Traffic Congestion on Main Road"
                required
              />
            </div>

            <div className="form-group">
              <label>Message *</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Detailed announcement message..."
                rows="4"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {types.map(t => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Priority *</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  {priorities.map(p => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Target Zones *</label>
              <div className="zones-grid">
                {zones.map(zone => (
                  <label key={zone} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.zones.includes(zone)}
                      onChange={() => handleZoneChange(zone)}
                    />
                    <span>{zone.charAt(0).toUpperCase() + zone.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Scheduled For (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledFor}
                  onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Announcement'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="announcements-grid">
        {announcements.length === 0 ? (
          <div className="empty-state">
            <p>No announcements yet. Create one to get started!</p>
          </div>
        ) : (
          announcements.map(announcement => (
            <div key={announcement._id} className="announcement-wrapper">
              <AnnouncementCard announcement={announcement} />
              <div className="announcement-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(announcement._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Announcements;
