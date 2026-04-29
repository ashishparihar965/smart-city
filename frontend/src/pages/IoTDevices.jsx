import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BatteryCharging,
  Clock3,
  Copy,
  Cpu,
  MapPin,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Satellite,
  Signal,
  TriangleAlert,
  Wifi,
} from 'lucide-react'
import { iotAPI } from '../services/api'
import socketService from '../services/socket'
import { useAuth } from '../context/AuthContext'
import LocationPickerModal from '../components/LocationPickerModal'
import './IoTDevices.css'

const deviceTypes = [
  { value: 'traffic-sensor', label: 'Traffic Sensor' },
  { value: 'waste-sensor', label: 'Waste Sensor' },
  { value: 'water-meter', label: 'Water Meter' },
  { value: 'lighting-controller', label: 'Lighting Controller' },
  { value: 'air-quality-sensor', label: 'Air Quality Sensor' },
  { value: 'custom', label: 'Custom Device' },
]

const zones = ['north', 'south', 'east', 'west', 'central']

const emptyForm = {
  name: '',
  deviceId: '',
  type: 'custom',
  zone: 'central',
  location: '',
  coordinates: { lat: '', lng: '' },
  firmwareVersion: '1.0.0',
  connectionType: 'socket',
  batteryLevel: 100,
  signalStrength: 100,
}

const formatTime = (value) => {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

const buildTelemetryPreview = (device) => {
  if (!device?.telemetry) return 'No telemetry yet'
  const entries = []
  for (const [key, value] of Object.entries(device.telemetry)) {
    if (value !== null && value !== undefined && value !== '') {
      entries.push(`${key}: ${value}`)
    }
  }
  return entries.length > 0 ? entries.join(' • ') : 'No telemetry yet'
}

const getStatusTone = (status) => {
  if (status === 'online') return 'online'
  if (status === 'maintenance') return 'warning'
  if (status === 'error') return 'error'
  return 'offline'
}

const IoTDevices = () => {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [events, setEvents] = useState([])
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const appendEvent = (label, detail) => {
    setEvents((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          label,
          detail,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 8)
    )
  }

  const syncData = async () => {
    try {
      const [summaryRes, devicesRes] = await Promise.all([
        iotAPI.getSummary(),
        iotAPI.getDevices(),
      ])
      setSummary(summaryRes.data.data)
      setDevices(devicesRes.data.data || [])
    } catch (error) {
      console.error('IoT fetch error:', error)
      setMessage(
        error?.response?.data?.message ||
          error.message ||
          'Failed to load IoT devices.'
      )
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
        const index = prev.findIndex(
          (item) => item.deviceId === device.deviceId
        )
        if (index === -1) return [device, ...prev]
        const copy = [...prev]
        copy[index] = device
        return copy
      })

      appendEvent(
        payload?.event || 'iot_device_event',
        `${device.name} → ${device.status}`
      )
    }

    socketService.on('iot_device_event', onDeviceEvent)

    return () => {
      socketService.off('iot_device_event', onDeviceEvent)
    }
  }, [])

  useEffect(() => {
    if (!summary) return
    setSummary((prev) => {
      if (!prev) return prev
      const total = devices.length
      const online = devices.filter((item) => item.status === 'online').length
      const offline = devices.filter((item) => item.status === 'offline').length
      const maintenance = devices.filter(
        (item) => item.status === 'maintenance'
      ).length
      const lowBattery = devices.filter(
        (item) => Number(item.batteryLevel) < 20
      ).length
      return { ...prev, total, online, offline, maintenance, lowBattery }
    })
  }, [devices])

  const handleRegister = async (event) => {
    event.preventDefault()
    setBusy('register')
    setMessage('')
    try {
      const payload = {
        ...form,
        coordinates: {
          lat: form.coordinates.lat === '' ? null : Number(form.coordinates.lat),
          lng: form.coordinates.lng === '' ? null : Number(form.coordinates.lng),
        },
      }
      const res = await iotAPI.registerDevice(payload)
      const created = {
        ...res.data.data,
        connectionKey: res.data.connectionKey,
      }
      setDevices((prev) => [created, ...prev])
      setForm(emptyForm)
      appendEvent('device_registered', `${created.name} registered`)
      setMessage(`Device registered. Connection key: ${res.data.connectionKey}`)
    } catch (error) {
      setMessage(
        error?.response?.data?.message ||
          error.message ||
          'Unable to register device.'
      )
    } finally {
      setBusy('')
    }
  }

  const performAction = async (device, action) => {
    setBusy(`${action}-${device.deviceId}`)
    setMessage('')
    try {
      const payload = {
        connectionKey: device.connectionKey,
        connectionType: 'socket',
        batteryLevel: Math.max(
          0,
          Number(device.batteryLevel || 100) - (action === 'heartbeat' ? 1 : 0)
        ),
        signalStrength: Number(device.signalStrength || 100),
        telemetry: {
          ...device.telemetry,
          message:
            action === 'connect'
              ? 'Connected from SmartCity console'
              : action === 'heartbeat'
                ? 'Heartbeat acknowledged'
                : action === 'telemetry'
                  ? 'Telemetry synced'
                  : 'Device disconnected',
        },
      }

      const apiMap = {
        connect: iotAPI.connectDevice,
        heartbeat: iotAPI.heartbeatDevice,
        telemetry: iotAPI.sendTelemetry,
        disconnect: iotAPI.disconnectDevice,
      }

      const res = await apiMap[action](device.deviceId, payload)
      const updated = res.data.data
      setDevices((prev) =>
        prev.map((item) =>
          item.deviceId === updated.deviceId ? { ...item, ...updated } : item
        )
      )
      appendEvent(`device_${action}`, `${updated.name} → ${updated.status}`)
      syncData()
    } catch (error) {
      setMessage(
        error?.response?.data?.message ||
          error.message ||
          `Unable to ${action} device.`
      )
    } finally {
      setBusy('')
    }
  }

  const handlePickCoordinates = (selected) => {
    if (!selected) return
    setForm((prev) => ({
      ...prev,
      coordinates: {
        lat: selected.lat.toFixed(6),
        lng: selected.lng.toFixed(6),
      },
    }))
    setShowLocationPicker(false)
  }

  const copyKey = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      setMessage('Device key copied to clipboard.')
    } catch (error) {
      setMessage('Clipboard access failed.')
    }
  }

  const visibleDevices = useMemo(() => devices, [devices])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="module-page animate-fade-in iot-page">
      <div className="page-header">
        <div>
          <h1>📡 IoT Device Connection</h1>
          <p>
            Register smart devices, connect them to the backend, and watch live
            telemetry updates.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={syncData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid-4 mb-1">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Cpu size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summary?.total || 0}</span>
            <span className="stat-label">Total Devices</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <Wifi size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summary?.online || 0}</span>
            <span className="stat-label">Online</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <TriangleAlert size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summary?.maintenance || 0}</span>
            <span className="stat-label">Maintenance</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">
            <BatteryCharging size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summary?.lowBattery || 0}</span>
            <span className="stat-label">Low Battery</span>
          </div>
        </div>
      </div>

      <div className="card iot-console mb-1">
        <div className="iot-console-header">
          <div>
            <h3>Device Registration Console</h3>
            <p>
              Use this panel to create a new device and get the pairing key
              immediately.
            </p>
          </div>
          <span className="ai-zone-chip">
            Operator: {user?.role || 'unknown'}
          </span>
        </div>

        <form className="iot-form grid-3" onSubmit={handleRegister}>
          <div className="input-group">
            <label>Device Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="North Water Meter"
              required
            />
          </div>
          <div className="input-group">
            <label>Device ID</label>
            <input
              value={form.deviceId}
              onChange={(e) =>
                setForm((f) => ({ ...f, deviceId: e.target.value }))
              }
              placeholder="DEV-WATER-NORTH-010"
            />
          </div>
          <div className="input-group">
            <label>Device Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {deviceTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Zone</label>
            <select
              value={form.zone}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.charAt(0).toUpperCase() + zone.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Location</label>
            <input
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              placeholder="Pump house / junction / pole"
              required
            />
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
              {form.coordinates.lat !== '' && form.coordinates.lng !== '' && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {form.coordinates.lat}, {form.coordinates.lng}
                </span>
              )}
            </div>
          </div>
          <div className="input-group">
            <label>Connection Mode</label>
            <select
              value={form.connectionType}
              onChange={(e) =>
                setForm((f) => ({ ...f, connectionType: e.target.value }))
              }
            >
              <option value="socket">Socket</option>
              <option value="http">HTTP</option>
              <option value="mqtt">MQTT</option>
              <option value="simulation">Simulation</option>
            </select>
          </div>
          <div className="input-group">
            <label>Firmware Version</label>
            <input
              value={form.firmwareVersion}
              onChange={(e) =>
                setForm((f) => ({ ...f, firmwareVersion: e.target.value }))
              }
              placeholder="1.0.0"
            />
          </div>
          <div className="input-group">
            <label>Battery %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.batteryLevel}
              onChange={(e) =>
                setForm((f) => ({ ...f, batteryLevel: e.target.value }))
              }
            />
          </div>
          <div className="input-group">
            <label>Signal %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.signalStrength}
              onChange={(e) =>
                setForm((f) => ({ ...f, signalStrength: e.target.value }))
              }
            />
          </div>
          <div className="iot-form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy === 'register'}
            >
              <Plus size={14} />{' '}
              {busy === 'register' ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>

        <LocationPickerModal
          isOpen={showLocationPicker}
          title="Pick device location"
          initialCoordinates={form.coordinates}
          onClose={() => setShowLocationPicker(false)}
          onConfirm={handlePickCoordinates}
        />

        {message && <div className="iot-message">{message}</div>}
      </div>

      <div className="grid-2 mb-1">
        <div className="card iot-feed-card">
          <div className="iot-card-title">
            <Activity size={16} /> Live Event Feed
          </div>
          <div className="iot-feed-list">
            {events.length === 0 ? (
              <div className="iot-empty">
                No realtime events yet. Connect or disconnect a device to see
                live updates.
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="iot-feed-item">
                  <div>
                    <strong>{event.label}</strong>
                    <p>{event.detail}</p>
                  </div>
                  <span>{event.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card iot-feed-card">
          <div className="iot-card-title">
            <Satellite size={16} /> Device Type Snapshot
          </div>
          <div className="iot-type-list">
            {(summary?.byType || []).map((typeItem) => (
              <div key={typeItem._id} className="iot-type-item">
                <span>{typeItem._id}</span>
                <strong>{typeItem.total}</strong>
                <small>{typeItem.online} online</small>
              </div>
            ))}
            {(!summary?.byType || summary.byType.length === 0) && (
              <div className="iot-empty">No device types available.</div>
            )}
          </div>
        </div>
      </div>

      <div className="card-grid iot-device-grid">
        {visibleDevices.map((device) => (
          <div
            key={device.deviceId}
            className={`iot-device-card ${getStatusTone(device.status)}`}
          >
            <div className="iot-device-top">
              <div>
                <h4>{device.name}</h4>
                <p>{device.deviceId}</p>
              </div>
              <span className={`iot-status ${getStatusTone(device.status)}`}>
                {device.status}
              </span>
            </div>

            <div className="iot-device-meta">
              <span>
                <MapPin size={12} /> {device.zone} ·{' '}
                {device.location || 'No location'}
                {device.coordinates?.lat != null && device.coordinates?.lng != null
                  ? ` (${Number(device.coordinates.lat).toFixed(4)}, ${Number(device.coordinates.lng).toFixed(4)})`
                  : ''}
              </span>
              <span>
                <Radio size={12} /> {device.connectionType}
              </span>
              <span>
                <Signal size={12} /> {device.signalStrength}% signal
              </span>
              <span>
                <BatteryCharging size={12} /> {device.batteryLevel}% battery
              </span>
              <span>
                <Clock3 size={12} /> Last seen {formatTime(device.lastSeen)}
              </span>
            </div>

            <div className="iot-telemetry-box">
              <span>Telemetry</span>
              <p>{buildTelemetryPreview(device)}</p>
            </div>

            <div className="iot-key-row">
              <span>
                Key: {device.connectionKey?.slice(0, 4)}••••
                {device.connectionKey?.slice(-4)}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => copyKey(device.connectionKey)}
              >
                <Copy size={12} /> Copy
              </button>
            </div>

            <div className="item-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => performAction(device, 'connect')}
                disabled={busy === `connect-${device.deviceId}`}
              >
                <Wifi size={13} /> Connect
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => performAction(device, 'heartbeat')}
                disabled={busy === `heartbeat-${device.deviceId}`}
              >
                <Activity size={13} /> Heartbeat
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => performAction(device, 'telemetry')}
                disabled={busy === `telemetry-${device.deviceId}`}
              >
                <Cpu size={13} /> Sync Telemetry
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => performAction(device, 'disconnect')}
                disabled={busy === `disconnect-${device.deviceId}`}
              >
                <Power size={13} /> Disconnect
              </button>
            </div>
          </div>
        ))}

        {visibleDevices.length === 0 && (
          <div className="empty-state">
            <p>No IoT devices found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default IoTDevices
