import { useState, useEffect } from 'react';
import { alertAPI } from '../services/api';
import socketService from '../services/socket';
import {
  Bell, Check, CheckCheck, Trash2, RefreshCw,
  Clock, AlertTriangle, Info, Zap, TrendingUp
} from 'lucide-react';
import './ModulePage.css';
import './Alerts.css';

const getAlertIcon = (type) => {
  switch (type) {
    case 'critical': return <AlertTriangle size={16} style={{ color: '#ef4444' }} />;
    case 'danger': return <AlertTriangle size={16} style={{ color: '#f97316' }} />;
    case 'warning': return <AlertTriangle size={16} style={{ color: '#f59e0b' }} />;
    case 'prediction': return <TrendingUp size={16} style={{ color: '#8b5cf6' }} />;
    default: return <Info size={16} style={{ color: '#3b82f6' }} />;
  }
};

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ module: '', type: '' });

  const fetchData = async () => {
    try {
      const params = { limit: 100 };
      if (filter.module) params.module = filter.module;
      if (filter.type) params.type = filter.type;
      const res = await alertAPI.getAll(params);
      setAlerts(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error('Alerts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  useEffect(() => {
    const onNotification = () => {
      fetchData();
    };

    socketService.on('notification:new', onNotification);

    return () => {
      socketService.off('notification:new', onNotification);
    };
  }, [filter.module, filter.type]);

  const handleMarkRead = async (id) => {
    try {
      await alertAPI.markRead(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAcknowledge = async (id) => {
    try {
      await alertAPI.acknowledge(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertAPI.markAllRead();
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      await alertAPI.delete(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div className="module-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>🔔 Alerts & Notifications</h1>
          <p>{unreadCount} unread alerts</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={handleMarkAllRead}>
            <CheckCheck size={14} /> Mark All Read
          </button>
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select value={filter.module} onChange={e => setFilter(f => ({ ...f, module: e.target.value }))}>
          <option value="">All Modules</option>
          {['traffic', 'waste', 'water', 'lighting', 'emergency', 'system'].map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">All Types</option>
          {['info', 'warning', 'danger', 'critical', 'prediction'].map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Alerts List */}
      <div className="card">
        {alerts.length > 0 ? (
          <div className="alerts-detail-list">
            {alerts.map(alert => (
              <div key={alert._id} className={`alert-detail-item ${!alert.read ? 'unread' : ''}`}>
                <div className="alert-icon-wrap">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="alert-detail-body">
                  <div className="alert-detail-top">
                    <span className="alert-detail-title">{alert.title}</span>
                    <div className="alert-detail-badges">
                      <span className={`badge badge-${alert.priority}`}>{alert.priority}</span>
                      <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{alert.module}</span>
                    </div>
                  </div>
                  <p className="alert-detail-msg">{alert.message}</p>
                  <div className="alert-detail-footer">
                    <span className="alert-time"><Clock size={11} /> {new Date(alert.createdAt).toLocaleString()}</span>
                    <div className="alert-detail-actions">
                      {!alert.read && (
                        <button className="btn btn-sm btn-outline" onClick={() => handleMarkRead(alert._id)}>
                          <Check size={12} /> Read
                        </button>
                      )}
                      {!alert.acknowledged && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleAcknowledge(alert._id)}>
                          <CheckCheck size={12} /> Acknowledge
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(alert._id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>No alerts found</p></div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
