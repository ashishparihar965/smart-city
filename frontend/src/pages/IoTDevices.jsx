import { useEffect, useMemo, useState } from 'react'
import {
  Clock3,
  Copy,
  Cpu,
  MapPin,
  Plus,
  RefreshCw,
  X,
  Key,
  CheckCircle,
  AlertCircle,
  Shield,
  Activity,
  Trash2,
} from 'lucide-react'
import { iotAPI } from '../services/api'
import socketService from '../services/socket'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import LocationPickerModal from '../components/LocationPickerModal'
import './IoTDevices.css'

// Sensor auto-detection: telemetry field → sensor info
const SENSOR_MAP = {
  temperature: { name: 'Temperature', icon: '🌡️', unit: '°C' },
  humidity: { name: 'Humidity', icon: '💧', unit: '%' },
  mq135: { name: 'MQ135 Air Quality', icon: '🌫️', unit: 'ppm' },
  ldr: { name: 'LDR Light', icon: '☀️', unit: 'lux' },
  voltage: { name: 'Voltage', icon: '⚡', unit: 'V' },
  distance: { name: 'Ultrasonic', icon: '📏', unit: 'cm' },
  ir1: { name: 'IR Sensor 1', icon: '🔴', unit: '' },
  ir2: { name: 'IR Sensor 2', icon: '🔴', unit: '' },
  pressure: { name: 'Pressure', icon: '🔵', unit: 'hPa' },
  soil_moisture: { name: 'Soil Moisture', icon: '🌱', unit: '%' },
  gas: { name: 'Gas Sensor', icon: '💨', unit: 'ppm' },
  sound: { name: 'Sound', icon: '🔊', unit: 'dB' },
  rain: { name: 'Rain', icon: '🌧️', unit: '' },
  motion: { name: 'PIR Motion', icon: '🚶', unit: '' },
  aqi: { name: 'AQI', icon: '🌬️', unit: '' },
}

const detectSensors = (telemetry) => {
  if (!telemetry || typeof telemetry !== 'object') return []
  return Object.entries(telemetry)
    .filter(([key, val]) => key !== 'message' && val !== null && val !== undefined && val !== '')
    .map(([key, val]) => ({
      ...(SENSOR_MAP[key] || { name: key, icon: '📡', unit: '' }),
      key,
      value: val,
    }))
}

const zones = ['north', 'south', 'east', 'west', 'central']

const emptyForm = {
  name: '',
  deviceId: '',
  type: 'custom',
  zone: 'central',
  location: '',
  coordinates: { lat: '', lng: '' },
  firmwareVersion: '1.0.0',
  connectionType: 'http',
  batteryLevel: 100,
  signalStrength: 100,
}

const formatTime = (value) => {
  if (!value) return 'Never'
  const d = new Date(value)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleString()
}

const IoTDevices = () => {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [newDeviceKey, setNewDeviceKey] = useState(null)
  const [showApiInfo, setShowApiInfo] = useState(false)

  const syncData = async () => {
    try {
      const devicesRes = await iotAPI.getDevices()
      setDevices(devicesRes.data.data || [])
    } catch (error) {
      console.error('IoT fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    syncData()
    socketService.connect()
    socketService.joinRoom('iot')

    const onDeviceEvent = (payload) => {
      const device = payload?.device
      if (!device?.deviceId) return
      setDevices((prev) => {
        const index = prev.findIndex((item) => item.deviceId === device.deviceId)
        if (index === -1) return [device, ...prev]
        const copy = [...prev]
        copy[index] = device
        return copy
      })
    }

    socketService.on('iot_device_event', onDeviceEvent)
    return () => { socketService.off('iot_device_event', onDeviceEvent) }
  }, [])

  const handleRegister = async (event) => {
    event.preventDefault()
    if (!form.name) { addToast('ESP32 name is required', 'error'); return }
    setBusy('register')
    try {
      const payload = {
        ...form,
        type: 'custom',
        coordinates: {
          lat: form.coordinates.lat === '' ? null : Number(form.coordinates.lat),
          lng: form.coordinates.lng === '' ? null : Number(form.coordinates.lng),
        },
      }
      const res = await iotAPI.registerDevice(payload)
      const created = { ...res.data.data, connectionKey: res.data.connectionKey }
      setDevices((prev) => [created, ...prev])
      setNewDeviceKey(res.data.connectionKey)
      addToast('ESP32 registered! Copy the API key.', 'success')
      syncData()
    } catch (error) {
      addToast(error?.response?.data?.message || 'Registration failed.', 'error')
    } finally { setBusy('') }
  }

  const handlePickCoordinates = (selected) => {
    if (!selected) { setShowLocationPicker(false); return }
    setForm((prev) => ({
      ...prev,
      coordinates: { lat: selected.lat.toFixed(6), lng: selected.lng.toFixed(6) },
    }))
    setShowLocationPicker(false)
  }

  const closeRegisterModal = () => { setShowRegisterModal(false); setNewDeviceKey(null); setForm(emptyForm) }

  const handleRemoveDevice = async (device) => {
    if (!confirm(`Remove "${device.name}" (${device.deviceId})? This cannot be undone.`)) return
    setBusy(`remove-${device.deviceId}`)
    try {
      await iotAPI.deleteDevice(device.deviceId)
      setDevices(prev => prev.filter(d => d.deviceId !== device.deviceId))
      addToast(`${device.name} removed`, 'success')
    } catch (error) {
      addToast(error?.response?.data?.message || 'Failed to remove device', 'error')
    } finally { setBusy('') }
  }

  const copyKey = async (value) => {
    try { await navigator.clipboard.writeText(value); addToast('API key copied!', 'success') }
    catch { addToast('Clipboard access failed', 'error') }
  }

  const authenticated = useMemo(() => devices.filter(d => d.lastSeen).length, [devices])
  const pending = useMemo(() => devices.filter(d => !d.lastSeen).length, [devices])
  const online = useMemo(() => devices.filter(d => d.status === 'online').length, [devices])
  const totalSensors = useMemo(() => {
    let count = 0
    devices.forEach(d => { count += detectSensors(d.telemetry).length })
    return count
  }, [devices])

  if (loading) return <div className="loading-container"><div className="spinner" /></div>

  return (
    <div className="module-page animate-fade-in iot-page">
      <div className="page-header">
        <div>
          <h1>📡 ESP32 Device Hub</h1>
          <p>Register ESP32 boards, auto-detect sensors, and monitor live data</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => setShowApiInfo(true)}>
            <Key size={14} /> API Endpoint
          </button>
          <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
            <Plus size={14} /> Register ESP32
          </button>
          <button className="btn btn-outline" onClick={syncData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-1">
        {[
          { label: 'ESP32 Boards', value: devices.length, icon: <Cpu size={18} />, cls: 'blue' },
          { label: 'Authenticated', value: authenticated, icon: <CheckCircle size={18} />, cls: 'green' },
          { label: 'Pending Setup', value: pending, icon: <AlertCircle size={18} />, cls: 'amber' },
          { label: 'Sensors Detected', value: totalSensors, icon: <Activity size={18} />, cls: 'purple' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
            <div className="stat-info">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ ESP32 Device List ═══ */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={18} /> Registered ESP32 Boards ({devices.length})
        </h3>

        {devices.length === 0 && (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>📡</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No ESP32 Boards Registered</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 400, margin: '0 auto 1rem' }}>
              Register your first ESP32 board to start receiving sensor data. Each board gets a unique API key for authentication.
            </p>
            <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
              <Plus size={14} /> Register First ESP32
            </button>
          </div>
        )}

        <div className="card-grid iot-device-grid">
          {devices.map((device) => {
            const isAuth = !!device.lastSeen
            const sensors = detectSensors(device.telemetry)
            const isOnline = device.status === 'online'

            return (
              <div key={device.deviceId} className={`iot-device-card ${isOnline ? 'online' : 'offline'}`}>
                {/* Header */}
                <div className="iot-device-top">
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isOnline ? '#10b981' : '#6b7280',
                        display: 'inline-block', flexShrink: 0,
                        boxShadow: isOnline ? '0 0 6px rgba(16,185,129,0.6)' : 'none',
                      }} />
                      {device.name}
                    </h4>
                    <p style={{ fontSize: '0.72rem', opacity: 0.5, fontFamily: 'monospace' }}>{device.deviceId}</p>
                  </div>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px',
                    borderRadius: '12px',
                    background: isAuth ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: isAuth ? '#10b981' : '#f59e0b',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    {isAuth ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                    {isAuth ? 'Authenticated' : 'Pending'}
                  </span>
                </div>

                {/* Location + Last Sync */}
                <div className="iot-device-meta">
                  <span>
                    <MapPin size={12} /> {device.zone}
                    {device.coordinates?.lat != null
                      ? ` · ${Number(device.coordinates.lat).toFixed(4)}, ${Number(device.coordinates.lng).toFixed(4)}`
                      : ''}
                    {device.location ? ` · ${device.location}` : ''}
                  </span>
                  <span>
                    <Clock3 size={12} /> Last Data: <strong style={{ color: isAuth ? '#10b981' : 'var(--text-muted)' }}>
                      {formatTime(device.lastSeen)}
                    </strong>
                  </span>
                </div>

                {/* Connected Sensors — the main feature */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                  {sensors.length > 0 ? (
                    <>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                        🔌 {sensors.length} Sensors Connected:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {sensors.map((s, i) => (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'rgba(59,130,246,0.05)', borderRadius: '8px',
                            padding: '4px 10px', fontSize: '0.78rem',
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                              {s.icon} {s.name}
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                              {typeof s.value === 'number' ? s.value : String(s.value)}
                              {s.unit && <span style={{ fontSize: '0.68rem', opacity: 0.6, marginLeft: 2 }}>{s.unit}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      ⏳ Waiting for first data from ESP32...
                    </div>
                  )}
                </div>

                {/* API Key */}
                <div className="iot-key-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                    <Key size={12} />
                    {device.connectionKey
                      ? `${device.connectionKey.slice(0, 6)}••••${device.connectionKey.slice(-4)}`
                      : '••••••••'}
                  </span>
                  {device.connectionKey && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copyKey(device.connectionKey)}>
                      <Copy size={12} /> Copy
                    </button>
                  )}
                </div>

                {/* Remove */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.35rem' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', fontSize: '0.72rem' }}
                    onClick={() => handleRemoveDevice(device)}
                    disabled={busy === `remove-${device.deviceId}`}
                  >
                    <Trash2 size={12} /> {busy === `remove-${device.deviceId}` ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ Register ESP32 Modal ═══ */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={closeRegisterModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header-row">
              <h2>📡 Register ESP32</h2>
              <button className="btn btn-sm btn-outline" onClick={closeRegisterModal}><X size={14} /></button>
            </div>

            {newDeviceKey ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔑</div>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>ESP32 Registered!</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Copy this API key and store it in your ESP32 code.<br />
                  <strong style={{ color: '#ef4444' }}>This key won't be shown again!</strong>
                </p>
                <div style={{
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 'var(--radius)', padding: '1rem',
                  fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700,
                  color: '#10b981', wordBreak: 'break-all', marginBottom: '1rem',
                }}>
                  {newDeviceKey}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => copyKey(newDeviceKey)}><Copy size={14} /> Copy Key</button>
                  <button className="btn btn-outline" onClick={closeRegisterModal}>Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
                  <div className="input-group">
                    <label>ESP32 Name *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. ESP32-Weather-Zone-A" required />
                  </div>

                  <div className="input-group">
                    <label>Device ID (auto-generated if empty)</label>
                    <input value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}
                      placeholder="ESP32_001" />
                  </div>

                  <div className="input-group">
                    <label>Zone</label>
                    <select value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                      {zones.map(z => <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>)}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Location (select on map)</label>
                    <button type="button" className="btn btn-outline"
                      onClick={() => setShowLocationPicker(true)}
                      style={{ width: '100%', justifyContent: 'center' }}>
                      <MapPin size={14} />
                      {form.coordinates.lat
                        ? `📍 ${Number(form.coordinates.lat).toFixed(4)}, ${Number(form.coordinates.lng).toFixed(4)}`
                        : 'Select Location on Map'}
                    </button>
                    {form.coordinates.lat && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Lat: {form.coordinates.lat}</span>
                        <span>Lng: {form.coordinates.lng}</span>
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label>Description (optional)</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Rooftop, Junction box, Room 201" />
                  </div>

                  <div style={{
                    background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: 'var(--radius)', padding: '0.75rem',
                    fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5,
                  }}>
                    💡 <strong>Sensors auto-detected:</strong> Just connect sensors to your ESP32 and send data.
                    The system automatically identifies temperature, humidity, MQ135, LDR, ultrasonic, IR, and more.
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn-outline" onClick={closeRegisterModal}>Cancel</button>
                  <button className="btn btn-primary" type="submit" disabled={busy === 'register'}>
                    <Key size={14} /> {busy === 'register' ? 'Generating Key...' : 'Register & Generate Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ═══ API Endpoint Info Modal ═══ */}
      {showApiInfo && (
        <div className="modal-overlay" onClick={() => setShowApiInfo(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header-row">
              <h2>🔗 ESP32 API Endpoint</h2>
              <button className="btn btn-sm btn-outline" onClick={() => setShowApiInfo(false)}><X size={14} /></button>
            </div>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <p style={{ marginBottom: '0.75rem' }}>
                Use this endpoint from your ESP32 to send sensor data:
              </p>

              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)', padding: '1rem', fontFamily: 'monospace',
                fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '1rem', overflowX: 'auto',
              }}>
                <div style={{ color: '#10b981', fontWeight: 700 }}>POST /api/iot/esp32/data</div>
                <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Headers:</div>
                <div style={{ color: '#f59e0b' }}>&nbsp;&nbsp;Content-Type: application/json</div>
                <div style={{ color: '#f59e0b' }}>&nbsp;&nbsp;x-device-key: {'<your-api-key>'}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Body:</div>
                <pre style={{ color: '#3b82f6', margin: 0 }}>{JSON.stringify({
                  esp32_id: "ESP32_001",
                  location: "SmartCity_Zone_A",
                  data: {
                    temperature: 30.5,
                    humidity: 60,
                    mq135: 1500,
                    ldr: 200,
                    voltage: 12.4,
                    distance: 25,
                    ir1: 0,
                    ir2: 1
                  }
                }, null, 2)}</pre>
              </div>

              <p>
                <strong>🔑 Authentication:</strong> Send the API key (from registration) in the <code>x-device-key</code> header.<br />
                <strong>📡 Auto-detect:</strong> Any field inside <code>data</code> is auto-detected as a connected sensor.<br />
                <strong>⚡ Real-time:</strong> Data appears instantly on the dashboard via WebSocket.
              </p>
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowApiInfo(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        title="Select ESP32 Location"
        initialCoordinates={form.coordinates.lat ? { lat: Number(form.coordinates.lat), lng: Number(form.coordinates.lng) } : null}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handlePickCoordinates}
      />
    </div>
  )
}

export default IoTDevices
