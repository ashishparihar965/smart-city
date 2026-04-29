import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { complaintAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import socketService from '../services/socket';
import AIInsights from '../components/AIInsights';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, MapPin, Clock, User, RefreshCw, Plus, X, Image,
  CheckCircle, AlertTriangle, ArrowRight, Timer, Award, Zap, Brain, History
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import LocationPickerModal from '../components/LocationPickerModal';
import './ModulePage.css';
import './Complaints.css';

const STATUS_COLORS = { 'open': '#3b82f6', 'in-progress': '#f59e0b', 'resolved': '#10b981' };
const PRIORITY_COLORS = { 'low': '#10b981', 'medium': '#f59e0b', 'high': '#ef4444' };
const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URI || import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const Complaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '', category: '' });
  const [showModal, setShowModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(null);
  const [operators, setOperators] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'traffic',
    location: '',
    zone: 'central',
    coordinates: { lat: '', lng: '' },
    image: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [assignForm, setAssignForm] = useState({ assignedTo: '', priority: 'medium', deadline: '' });
  const [statusForm, setStatusForm] = useState({ status: '', remark: '' });
  const { isAdmin, isOperator, isUser, user } = useAuth();
  const toast = useToast();

  const getComplaintImageSrc = (imageUrl) => {
    if (!imageUrl) return null;
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    return `${BACKEND_BASE_URL}${imageUrl}`;
  };

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.priority) params.priority = filter.priority;
      if (filter.category) params.category = filter.category;
      const res = await complaintAPI.getAll(params);
      setComplaints(res.data.data);
      if (isAdmin) {
        try {
          const statsRes = await complaintAPI.getStats();
          setStats(statsRes.data.data);
        } catch (e) { console.error('Stats error:', e); }
      }
    } catch (err) {
      console.error('Complaints error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, isAdmin]);

  // WebSocket real-time listeners
  useEffect(() => {
    socketService.connect();
    if (user?.id) socketService.joinRoom(`user:${user.id}`);
    if (user?.role) socketService.joinRoom(`role:${user.role}`);
    if (user?.zone) socketService.joinRoom(`zone:${user.zone}`);

    const onCreated = (data) => {
      toast.info(`📝 New complaint: ${data?.title || 'New complaint filed'}`);
      fetchData();
    };
    const onAssigned = (data) => {
      toast.success(`✅ Complaint assigned: ${data?.title || 'A complaint was assigned'}`);
      fetchData();
    };
    const onUpdated = (data) => {
      toast.info(`🔄 Complaint updated: ${data?.title || 'Status changed'}`);
      fetchData();
    };
    const onResolved = (data) => {
      toast.success(`🎉 Complaint resolved: ${data?.title || 'A complaint was resolved'}`);
      fetchData();
    };

    socketService.on('complaint_created', onCreated);
    socketService.on('complaint_assigned', onAssigned);
    socketService.on('complaint_updated', onUpdated);
    socketService.on('complaint_resolved', onResolved);

    return () => {
      socketService.off('complaint_created', onCreated);
      socketService.off('complaint_assigned', onAssigned);
      socketService.off('complaint_updated', onUpdated);
      socketService.off('complaint_resolved', onResolved);
    };
  }, [user, fetchData, toast]);

  useEffect(() => { fetchData(); }, [filter]);

  // Create complaint (citizen only) — with image upload
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormErrors({});
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('category', form.category);
      formData.append('location', form.location);
      formData.append('zone', form.zone);
      if (form.coordinates?.lat !== '') formData.append('lat', form.coordinates.lat);
      if (form.coordinates?.lng !== '') formData.append('lng', form.coordinates.lng);
      if (form.image) formData.append('image', form.image);
      await complaintAPI.create(formData);
      setShowModal(false);
      setForm({
        title: '',
        description: '',
        category: 'traffic',
        location: '',
        zone: 'central',
        coordinates: { lat: '', lng: '' },
        image: null,
      });
      setFormErrors({});
      setImagePreview(null);
      toast.success('Complaint submitted successfully!');
      fetchData();
    } catch (err) { 
      const fieldErrors = err.response?.data?.fieldErrors || {};
      setFormErrors(fieldErrors);
      toast.error(err.response?.data?.message || 'Failed to submit complaint');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(f => ({ ...f, image: file }));
      setFormErrors((prev) => ({ ...prev, image: undefined }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePickCoordinates = (selected) => {
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      coordinates: {
        lat: selected.lat.toFixed(6),
        lng: selected.lng.toFixed(6),
      },
    }));
    setShowLocationPicker(false);
  };

  // Admin: open assign modal
  const openAssign = async (complaint) => {
    setShowAssignModal(complaint);
    setAssignForm({ assignedTo: '', priority: complaint.priority, deadline: '' });
    try {
      const [opsRes, sugRes] = await Promise.all([
        authAPI.getOperators(),
        complaintAPI.suggestOperator({ category: complaint.category, zone: complaint.zone })
      ]);
      setOperators(opsRes.data.data);
      setSuggestions(sugRes.data.data);
    } catch (e) { console.error(e); }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await complaintAPI.assign(showAssignModal._id, assignForm);
      setShowAssignModal(null);
      toast.success('Operator assigned successfully!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed');
    }
  };

  // Operator: open status modal
  const openStatusUpdate = (complaint) => {
    const nextStatus = complaint.status === 'open' ? 'in-progress' : 'resolved';
    setShowStatusModal(complaint);
    setStatusForm({ status: nextStatus, remark: '' });
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    try {
      await complaintAPI.updateStatus(showStatusModal._id, statusForm);
      setShowStatusModal(null);
      toast.success(`Status updated to ${statusForm.status}!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  // Charts for admin
  const catChartData = stats?.byCategory?.map((c, i) => ({
    name: c._id?.charAt(0).toUpperCase() + c._id?.slice(1), count: c.count
  })) || [];

  const statusChartData = stats?.byStatus?.map(s => ({
    name: s._id, value: s.count, fill: STATUS_COLORS[s._id] || '#64748b'
  })) || [];

  const perfData = stats?.operatorPerformance?.map(op => ({
    name: op.name, resolved: op.resolved, avgTime: op.avgTime
  })) || [];

  return (
    <div className="module-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>📝 {isUser ? 'My Complaints' : isOperator ? 'Assigned Complaints' : 'All Complaints'}</h1>
          <p>
            {isUser ? 'File and track your city complaints' :
             isOperator ? 'Manage complaints assigned to you' :
             `Manage all citizen complaints — ${stats?.total || 0} total`}
          </p>
        </div>
        <div className="header-actions">
          {isUser && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={14} /> File Complaint
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-outline" onClick={async () => { await complaintAPI.checkOverdue(); fetchData(); }}>
              <Timer size={14} /> Check Overdue
            </button>
          )}
          <button className="btn btn-outline" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Admin Analytics */}
      {isAdmin && stats && (
        <>
          {/* AI Insights Panel */}
          <AIInsights stats={stats} complaints={complaints} />

          <div className="grid-5 mb-1">
            <div className="stat-card"><div className="stat-icon blue"><MessageSquare size={18} /></div><div className="stat-info"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div></div>
            <div className="stat-card"><div className="stat-icon amber"><Clock size={18} /></div><div className="stat-info"><span className="stat-value">{stats.open}</span><span className="stat-label">Open</span></div></div>
            <div className="stat-card"><div className="stat-icon cyan"><Zap size={18} /></div><div className="stat-info"><span className="stat-value">{stats.inProgress}</span><span className="stat-label">In Progress</span></div></div>
            <div className="stat-card"><div className="stat-icon green"><CheckCircle size={18} /></div><div className="stat-info"><span className="stat-value">{stats.resolved}</span><span className="stat-label">Resolved</span></div></div>
            <div className="stat-card"><div className="stat-icon red"><AlertTriangle size={18} /></div><div className="stat-info"><span className="stat-value">{stats.overdue}</span><span className="stat-label">Overdue</span></div></div>
          </div>

          <div className="charts-grid mb-1">
            <div className="card chart-section">
              <h3>By Category</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={catChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card chart-section">
              <h3>By Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusChartData} innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value">
                    {statusChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {statusChartData.map(d => (
                  <span key={d.name} className="legend-item">
                    <span className="legend-dot" style={{ background: d.fill }} /> {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </div>
            <div className="card chart-section">
              <h3><Award size={14} /> Operator Performance</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={perfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
                  <Bar dataKey="resolved" fill="#10b981" radius={[6, 6, 0, 0]} name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {['traffic', 'water', 'waste', 'lighting', 'emergency'].map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Complaint Cards */}
      <div className="card-grid">
        <AnimatePresence>
        {complaints.map((c, idx) => {
          const complaintImageSrc = getComplaintImageSrc(c.imageUrl);
          return (
          <motion.div
            key={c._id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: idx * 0.03 }}
            className={`complaint-card priority-border-${c.priority} ${c.isOverdue ? 'overdue-card' : ''}`}
          >
            <div className="complaint-header">
              <h4>{c.title}</h4>
              <span className={`badge badge-${c.priority}`}>{c.priority}</span>
            </div>
            <div className="complaint-status-row">
              <span className="badge" style={{ background: `${STATUS_COLORS[c.status]}22`, color: STATUS_COLORS[c.status] }}>{c.status}</span>
              <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>{c.category}</span>
              {c.isOverdue && <span className="badge badge-red">⏰ OVERDUE</span>}
            </div>
            {complaintImageSrc && (
              <div className="complaint-image-wrap">
                <img src={complaintImageSrc} alt={c.title || 'Complaint'} className="complaint-image" />
                <span className="complaint-image-chip">
                  <Image size={12} /> Uploaded image
                </span>
              </div>
            )}
            <p className="complaint-desc">{c.description}</p>
            <div className="item-details">
              <span><MapPin size={13} /> {c.location} ({c.zone})</span>
              <span><Clock size={13} /> Filed: {new Date(c.createdAt).toLocaleDateString()}</span>
              {c.deadline && <span><Timer size={13} /> Deadline: {new Date(c.deadline).toLocaleDateString()}</span>}
              {c.createdBy && <span><User size={13} /> By: {c.createdBy.name}</span>}
              {c.assignedTo && <span><User size={13} /> Assigned: {c.assignedTo.name} ({c.assignedTo.department})</span>}
              {c.resolutionTimeMinutes && <span>⏱ Resolved in {c.resolutionTimeMinutes} min</span>}
            </div>

            {/* Status Timeline */}
            {c.statusHistory && c.statusHistory.length > 0 && (
              <div className="status-timeline" style={{ margin: '0.75rem 0 0.5rem', padding: '0.5rem 0 0', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  <History size={12} /> Status History
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {c.statusHistory.map((sh, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[sh.status] || '#64748b' }} />
                      <span style={{ fontWeight: 600, color: STATUS_COLORS[sh.status] }}>{sh.status}</span>
                      <span style={{ color: 'var(--text-muted)' }}>by {sh.changedByName}{sh.remark ? ` — "${sh.remark}"` : ''}</span>
                      {i < c.statusHistory.length - 1 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {c.remarks && c.remarks.length > 0 && (
              <div className="remarks-section">
                <span className="remarks-title">Remarks:</span>
                {c.remarks.map((r, i) => (
                  <div key={i} className="remark-item">
                    <strong>{r.addedByName}</strong>: {r.text}
                    <span className="remark-time">{new Date(r.addedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="item-actions">
              {isAdmin && c.status !== 'resolved' && (
                <button className="btn btn-sm btn-primary" onClick={() => openAssign(c)}>
                  Assign Operator
                </button>
              )}
              {isOperator && c.status !== 'resolved' && (
                <button className="btn btn-sm btn-success" onClick={() => openStatusUpdate(c)}>
                  <ArrowRight size={13} /> {c.status === 'open' ? 'Start Progress' : 'Resolve'}
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
        </AnimatePresence>
      </div>
      {complaints.length === 0 && <div className="empty-state"><p>No complaints found</p></div>}

      {/* Create Complaint Modal (citizen) */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content complaint-create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>File a Complaint</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <form className="complaint-create-form" onSubmit={handleCreate}>
              <div className="input-group">
                <label>Title</label>
                <input
                  className={formErrors.title ? 'input-error' : ''}
                  value={form.title}
                  onChange={e => {
                    setForm(f => ({ ...f, title: e.target.value }));
                    setFormErrors(prev => ({ ...prev, title: undefined }));
                  }}
                  required
                  placeholder="Brief title of complaint"
                />
                {formErrors.title && <span className="field-error">{formErrors.title}</span>}
              </div>
              <div className="complaint-form-two-col">
                <div className="input-group">
                  <label>Category</label>
                  <select
                    className={formErrors.category ? 'input-error' : ''}
                    value={form.category}
                    onChange={e => {
                      setForm(f => ({ ...f, category: e.target.value }));
                      setFormErrors(prev => ({ ...prev, category: undefined }));
                    }}
                  >
                    {['traffic', 'water', 'waste', 'lighting', 'emergency'].map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  {formErrors.category && <span className="field-error">{formErrors.category}</span>}
                </div>
                <div className="input-group">
                  <label>Zone</label>
                  <select
                    className={formErrors.zone ? 'input-error' : ''}
                    value={form.zone}
                    onChange={e => {
                      setForm(f => ({ ...f, zone: e.target.value }));
                      setFormErrors(prev => ({ ...prev, zone: undefined }));
                    }}
                  >
                    {['north', 'south', 'east', 'west', 'central'].map(z => (
                      <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>
                    ))}
                  </select>
                  {formErrors.zone && <span className="field-error">{formErrors.zone}</span>}
                </div>
              </div>
              <div className="input-group">
                <label>Location</label>
                <input
                  className={formErrors.location ? 'input-error' : ''}
                  value={form.location}
                  onChange={e => {
                    setForm(f => ({ ...f, location: e.target.value }));
                    setFormErrors(prev => ({ ...prev, location: undefined }));
                  }}
                  required
                  placeholder="Where is the issue?"
                />
                {formErrors.location && <span className="field-error">{formErrors.location}</span>}
              </div>
              <div className="input-group">
                <label>Coordinates (optional)</label>
                <div className="complaint-coordinate-row">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowLocationPicker(true)}
                  >
                    <MapPin size={13} /> Pick on Map
                  </button>
                  {form.coordinates.lat !== '' && form.coordinates.lng !== '' && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {form.coordinates.lat}, {form.coordinates.lng}
                    </span>
                  )}
                </div>
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea
                  className={formErrors.description ? 'input-error' : ''}
                  rows={3}
                  value={form.description}
                  onChange={e => {
                    setForm(f => ({ ...f, description: e.target.value }));
                    setFormErrors(prev => ({ ...prev, description: undefined }));
                  }}
                  required
                  placeholder="Describe the problem in detail..."
                />
                {formErrors.description && <span className="field-error">{formErrors.description}</span>}
              </div>
              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Image size={14} /> Attach Photo (optional)</label>
                <div className="upload-input-wrap">
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ padding: '0.5rem' }} />
                </div>
                {form.image && (
                  <span className="upload-file-name">Selected: {form.image.name}</span>
                )}
                {imagePreview && (
                  <div className="upload-preview-wrap">
                    <img src={imagePreview} alt="Preview" className="upload-preview-image" />
                    <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: '0.5rem' }} onClick={() => { setForm(f => ({ ...f, image: null })); setImagePreview(null); }}>
                      <X size={12} /> Remove
                    </button>
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Complaint</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <LocationPickerModal
        isOpen={showLocationPicker}
        title="Pick complaint location"
        initialCoordinates={form.coordinates}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handlePickCoordinates}
      />

      {/* Assign Modal (admin) */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Assign Complaint</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAssignModal(null)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <strong>{showAssignModal.title}</strong> — {showAssignModal.category}
            </p>

            {suggestions.length > 0 && (
              <div className="suggestions-box">
                <span className="suggestions-title">🤖 Smart Suggestions (least loaded first):</span>
                {suggestions.slice(0, 3).map(s => (
                  <button key={s.id} className={`suggestion-item ${assignForm.assignedTo === s.id ? 'selected' : ''}`}
                    onClick={() => setAssignForm(f => ({ ...f, assignedTo: s.id }))}>
                    <strong>{s.name}</strong> — {s.department} ({s.openAssignments} open)
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleAssign}>
              <div className="input-group">
                <label>Assign to Operator</label>
                <select value={assignForm.assignedTo} onChange={e => setAssignForm(f => ({ ...f, assignedTo: e.target.value }))} required>
                  <option value="">Select Operator</option>
                  {operators.map(op => (
                    <option key={op._id} value={op._id}>{op.name} ({op.department})</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Priority</label>
                <select value={assignForm.priority} onChange={e => setAssignForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="input-group">
                <label>Deadline (optional)</label>
                <input type="datetime-local" value={assignForm.deadline} onChange={e => setAssignForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAssignModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Update Modal (operator) */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Update Status</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowStatusModal(null)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <strong>{showStatusModal.title}</strong> — changing to <span className="badge" style={{ background: `${STATUS_COLORS[statusForm.status]}22`, color: STATUS_COLORS[statusForm.status] }}>{statusForm.status}</span>
            </p>
            <form onSubmit={handleStatusUpdate}>
              <div className="input-group">
                <label>Add Remark</label>
                <textarea rows={3} value={statusForm.remark} onChange={e => setStatusForm(f => ({ ...f, remark: e.target.value }))} placeholder="What action was taken?" required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowStatusModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success"><CheckCircle size={14} /> Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Complaints;
