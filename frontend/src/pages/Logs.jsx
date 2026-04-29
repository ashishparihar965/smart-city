import { useState, useEffect } from 'react';
import { logAPI } from '../services/api';
import {
  ScrollText, Clock, User, RefreshCw, Filter
} from 'lucide-react';
import './ModulePage.css';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ module: '', page: 1 });

  const fetchData = async () => {
    try {
      const params = { page: filter.page, limit: 30 };
      if (filter.module) params.module = filter.module;
      const res = await logAPI.getAll(params);
      setLogs(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Logs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const getModuleColor = (mod) => {
    const colors = {
      traffic: '#3b82f6', waste: '#10b981', water: '#06b6d4',
      lighting: '#f59e0b', emergency: '#ef4444', auth: '#8b5cf6', system: '#64748b', dashboard: '#ec4899'
    };
    return colors[mod] || '#64748b';
  };

  return (
    <div className="module-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>📋 Activity Logs</h1>
          <p>Track all system actions and user activities ({total} total)</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select value={filter.module} onChange={e => setFilter(f => ({ ...f, module: e.target.value, page: 1 }))}>
          <option value="">All Modules</option>
          {['traffic', 'waste', 'water', 'lighting', 'emergency', 'auth', 'system', 'dashboard'].map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="card table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Module</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log._id}>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                    <Clock size={12} />
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </td>
                <td>{log.userName}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${getModuleColor(log.module)}20`,
                      color: getModuleColor(log.module)
                    }}
                  >
                    {log.module}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{log.action}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="empty-state"><p>No activity logs found</p></div>}
      </div>

      {/* Pagination */}
      {total > 30 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setFilter(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
            disabled={filter.page <= 1}
          >
            Previous
          </button>
          <span style={{ padding: '0.35rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Page {filter.page}
          </span>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}
            disabled={logs.length < 30}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Logs;
