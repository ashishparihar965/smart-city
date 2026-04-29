import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { emergencyAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import socketService from '../services/socket'
import {
  Siren, AlertTriangle, Clock, MapPin, Phone, RefreshCw,
  Shield, CheckCircle, User, Timer
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import LocationPickerModal from '../components/LocationPickerModal'
import './EmergencyPage.css'

const typeColors = {
  sos: '#ef4444', fire: '#f97316', medical: '#ec4899',
  crime: '#a855f7', 'natural-disaster': '#3b82f6', 'gas-leak': '#f59e0b', other: '#64748b',
}

const EmergencyPage = () => {
  const [emergencies, setEmergencies] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [showSOS, setShowSOS] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [filter, setFilter] = useState({ status: '' })
  const [sosForm, setSosForm] = useState({ type: 'sos', title: '', description: '', location: '', zone: 'central', priority: 'critical', coordinates: { lat: null, lng: null } })
  const { user, isAdmin, isOperator } = useAuth()
  const { addToast } = useToast()

  const fetchFeed = useCallback(async () => {
    try {
      const res = await emergencyAPI.getFeed(filter)
      setEmergencies(res.data.data)
      setStats(res.data.stats)
    } catch (err) {
      console.error('Emergency feed error:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchFeed()
    const interval = setInterval(fetchFeed, 15000)
    return () => clearInterval(interval)
  }, [fetchFeed])

  // Listen for real-time emergency events
  useEffect(() => {
    socketService.on('emergency_sos', (data) => {
      setEmergencies((prev) => [data.emergency, ...prev])
      addToast(`🚨 New Emergency: ${data.emergency.title}`, 'error')
    })
    socketService.on('emergency_update', (data) => {
      setEmergencies((prev) => prev.map((e) => (e._id === data.emergency._id ? data.emergency : e)))
    })
    return () => {
      socketService.off('emergency_sos')
      socketService.off('emergency_update')
    }
  }, [addToast])

  const handleSOS = async () => {
    if (!sosForm.title || !sosForm.description || !sosForm.location) {
      addToast('Please fill all required fields', 'error')
      return
    }
    try {
      const payload = {
        ...sosForm,
        coordinates: {
          lat: sosForm.coordinates.lat === '' || sosForm.coordinates.lat === null ? null : Number(sosForm.coordinates.lat),
          lng: sosForm.coordinates.lng === '' || sosForm.coordinates.lng === null ? null : Number(sosForm.coordinates.lng),
        },
      }

      await emergencyAPI.createSOS(payload)
      addToast('🚨 SOS Alert Sent!', 'success')
      setShowSOS(false)
      setSosForm({ type: 'sos', title: '', description: '', location: '', zone: 'central', priority: 'critical', coordinates: { lat: null, lng: null } })
      fetchFeed()
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to send SOS', 'error')
    }
  }

  const handleRespond = async (id) => {
    try {
      await emergencyAPI.respond(id)
      addToast('Responding to emergency', 'success')
      fetchFeed()
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to respond', 'error')
    }
  }

  const handleResolve = async (id) => {
    try {
      await emergencyAPI.resolve(id)
      addToast('Emergency resolved', 'success')
      fetchFeed()
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to resolve', 'error')
    }
  }

  const handlePickCoordinates = (selected) => {
    if (!selected) return
    setSosForm((prev) => ({
      ...prev,
      coordinates: {
        lat: selected.lat.toFixed(6),
        lng: selected.lng.toFixed(6),
      },
    }))
    setShowLocationPicker(false)
  }

  if (loading) return <div className="loading-container" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1><Siren size={20} style={{ display: 'inline', marginRight: 8 }} />Emergency Center</h1>
          <p>Real-time emergency response system</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-danger" onClick={() => setShowSOS(true)} style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0.7rem 1.5rem' }}>
            <AlertTriangle size={16} /> SOS ALERT
          </button>
          <button className="btn btn-outline" onClick={fetchFeed}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Active', value: stats.active || 0, color: '#ef4444', icon: <AlertTriangle size={18} /> },
          { label: 'Responding', value: stats.responding || 0, color: '#f59e0b', icon: <Timer size={18} /> },
          { label: 'Resolved', value: stats.resolved || 0, color: '#10b981', icon: <CheckCircle size={18} /> },
          { label: 'Total', value: stats.total || 0, color: '#3b82f6', icon: <Shield size={18} /> },
        ].map((s) => (
          <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}18`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="responding">Responding</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Emergency Feed */}
      <AnimatePresence>
        {emergencies.map((em) => (
          <motion.div
            key={em._id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`card ${em.status === 'active' ? 'critical-blink' : ''}`}
            style={{
              borderLeft: `4px solid ${typeColors[em.type] || '#64748b'}`,
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                  <span className={`badge badge-${em.status === 'active' ? 'critical' : em.status === 'responding' ? 'yellow' : 'green'}`}>
                    {em.status}
                  </span>
                  <span className="badge" style={{ background: `${typeColors[em.type]}25`, color: typeColors[em.type] }}>
                    {em.type}
                  </span>
                  <span className={`badge badge-${em.priority}`}>{em.priority}</span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{em.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>{em.description}</p>
              </div>
              {(isAdmin || isOperator) && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {em.status === 'active' && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleRespond(em._id)}>Respond</button>
                  )}
                  {em.status === 'responding' && (
                    <button className="btn btn-success btn-sm" onClick={() => handleResolve(em._id)}>Resolve</button>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span><MapPin size={12} style={{ marginRight: 4 }} />{em.location} ({em.zone})</span>
              <span><User size={12} style={{ marginRight: 4 }} />{em.reportedBy?.name || 'Unknown'}</span>
              <span><Clock size={12} style={{ marginRight: 4 }} />{new Date(em.createdAt).toLocaleString()}</span>
              {em.responseTimeMinutes && (
                <span><Timer size={12} style={{ marginRight: 4 }} />{em.responseTimeMinutes} min response</span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {emergencies.length === 0 && (
        <div className="empty-state"><p>No emergencies found</p></div>
      )}

      {/* SOS Modal */}
      {showSOS && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={() => setShowSOS(false)}>
          <div className="modal-content emergency-sos-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} />Emergency SOS Alert
            </h2>
            <div className="emergency-sos-form-stack">
              <div className="input-group">
                <label>Emergency Type</label>
                <select value={sosForm.type} onChange={(e) => setSosForm({ ...sosForm, type: e.target.value })}>
                  {['sos', 'fire', 'medical', 'crime', 'natural-disaster', 'gas-leak', 'other'].map((t) => (
                    <option key={t} value={t}>{t.replace('-', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Title *</label>
                <input value={sosForm.title} onChange={(e) => setSosForm({ ...sosForm, title: e.target.value })} placeholder="Brief Emergency Title" />
              </div>
              <div className="input-group">
                <label>Description *</label>
                <textarea rows={3} value={sosForm.description} onChange={(e) => setSosForm({ ...sosForm, description: e.target.value })} placeholder="Describe the emergency..." />
              </div>
              <div className="emergency-sos-two-col">
                <div className="input-group">
                  <label>Location *</label>
                  <input value={sosForm.location} onChange={(e) => setSosForm({ ...sosForm, location: e.target.value })} placeholder="Address or landmark" />
                </div>
                <div className="input-group">
                  <label>Zone</label>
                  <select value={sosForm.zone} onChange={(e) => setSosForm({ ...sosForm, zone: e.target.value })}>
                    {['north', 'south', 'east', 'west', 'central'].map((z) => (
                      <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label>Coordinates (optional)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowLocationPicker(true)}
                  >
                    <MapPin size={13} /> Pick on Map
                  </button>
                  {sosForm.coordinates.lat !== null && sosForm.coordinates.lng !== null && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {sosForm.coordinates.lat}, {sosForm.coordinates.lng}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowSOS(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleSOS} style={{ fontWeight: 700 }}>
                <Siren size={16} /> SEND SOS
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <LocationPickerModal
        isOpen={showLocationPicker}
        title="Pick emergency location"
        initialCoordinates={sosForm.coordinates}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handlePickCoordinates}
      />
    </div>
  )
}

export default EmergencyPage
