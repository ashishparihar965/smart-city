import React, { useState, useEffect } from 'react';
import { announcementAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AnnouncementCard from '../components/AnnouncementCard';
import { RefreshCw, AlertCircle } from 'lucide-react';
import './CitizenAnnouncements.css';

const CitizenAnnouncements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const res = await announcementAPI.getAll({ status: 'active' });
      const filtered = res.data.data.filter(a => a.zones.includes(user?.zone) || a.zones.includes('all'));
      // Sort by priority (critical first)
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      filtered.sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));
      setAnnouncements(filtered);
    } catch (err) {
      console.error('Fetch announcements error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, [user?.zone]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const handleAnnouncementView = async (announcementId) => {
    try {
      await announcementAPI.recordView(announcementId);
    } catch (err) {
      console.error('Failed to record view:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="citizen-announcements-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>City Alerts & Announcements</h1>
          <p>Active alerts for {user?.zone || 'your area'}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="empty-state card">
          <AlertCircle size={48} />
          <h3>No Active Alerts</h3>
          <p>There are no active announcements for your area right now.</p>
          <p className="empty-state-hint">Check back later or enable notifications for real-time updates.</p>
        </div>
      ) : (
        <div className="announcements-container">
          <div className="announcements-count">
            <span className="badge badge-blue">{announcements.length} active alert{announcements.length !== 1 ? 's' : ''}</span>
          </div>
          
          <div className="announcements-grid">
            {announcements.map((announcement) => (
              <div key={announcement._id} onClick={() => handleAnnouncementView(announcement._id)}>
                <AnnouncementCard announcement={announcement} onView={handleAnnouncementView} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Legend */}
      <div className="card priority-legend">
        <h4>Alert Priority Levels</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="priority-dot critical" />
            <span>Critical - Immediate action required</span>
          </div>
          <div className="legend-item">
            <span className="priority-dot high" />
            <span>High - Important, plan accordingly</span>
          </div>
          <div className="legend-item">
            <span className="priority-dot medium" />
            <span>Medium - FYI for your area</span>
          </div>
          <div className="legend-item">
            <span className="priority-dot low" />
            <span>Low - General information</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenAnnouncements;
