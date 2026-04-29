import React from 'react';
import { AlertCircle, Zap, Droplet, Trash2, Lightbulb, AlertTriangle, Clock, MapPin } from 'lucide-react';
import '../styles/AnnouncementCard.css';

// Type icons mapping
const typeIcons = {
  traffic: <AlertTriangle className="announcement-type-icon traffic" />,
  water: <Droplet className="announcement-type-icon water" />,
  waste: <Trash2 className="announcement-type-icon waste" />,
  lighting: <Lightbulb className="announcement-type-icon lighting" />,
  emergency: <AlertCircle className="announcement-type-icon emergency" />,
  general: <AlertCircle className="announcement-type-icon general" />,
  maintenance: <Zap className="announcement-type-icon maintenance" />
};

// Priority color mapping
const priorityColors = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#F44336',
  critical: '#8B0000'
};

const AnnouncementCard = ({ announcement, onView }) => {
  const handleClick = () => {
    // Record view when card is clicked
    if (onView) {
      onView(announcement._id);
    }
  };

  const priorityLabel = announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1);
  const typeLabel = announcement.type.charAt(0).toUpperCase() + announcement.type.slice(1);

  return (
    <div 
      className="announcement-card"
      style={{ borderLeftColor: priorityColors[announcement.priority] }}
      onClick={handleClick}
    >
      <div className="announcement-header">
        <div className="announcement-title-section">
          {typeIcons[announcement.type]}
          <h3 className="announcement-title">{announcement.title}</h3>
        </div>
        <span 
          className="announcement-priority-badge"
          style={{ backgroundColor: priorityColors[announcement.priority] }}
        >
          {priorityLabel}
        </span>
      </div>

      <p className="announcement-message">{announcement.message}</p>

      <div className="announcement-meta">
        <div className="announcement-meta-item">
          <MapPin size={14} />
          <span>{announcement.zones.join(', ')}</span>
        </div>
        <div className="announcement-meta-item">
          <Clock size={14} />
          <span>{new Date(announcement.createdAt).toLocaleDateString()} at {new Date(announcement.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {announcement.expiresAt && (
        <div className="announcement-expiry">
          Expires: {new Date(announcement.expiresAt).toLocaleDateString()}
        </div>
      )}

      <div className="announcement-footer">
        <span className="announcement-views">
          {announcement.viewCount || 0} people notified
        </span>
      </div>
    </div>
  );
};

export default AnnouncementCard;
