import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { parkingAPI } from '../services/api'
import {
  ParkingSquare, LayoutDashboard, MapPin, Settings, Plus,
  Trash2, Edit, CheckCircle, Car, Bike, Truck, DollarSign,
  RefreshCw, List, X, Search, ChevronDown
} from 'lucide-react'
import './AdminParking.css'

const VehicleIcon = ({ type, size = 14 }) => {
  if (type === 'bike') return <Bike size={size} />
  if (type === 'truck') return <Truck size={size} />
  return <Car size={size} />
}

// ─── Map click picker ──────────────────────────────────────
function MapClickHandler({ onLocationPick }) {
  useMapEvents({ click: (e) => onLocationPick(e.latlng) })
  return null
}

const pinIcon = L.divIcon({
  className: 'custom-admin-marker',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(59,130,246,0.5);font-size:12px;">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28]
})

export default function AdminParking() {
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])

  // Add form state
  const [form, setForm] = useState({
    name: '', address: '', latitude: 18.52, longitude: 73.86,
    isPaid: false,
    bikeSlots: 0, carSlots: 10, truckSlots: 0,
    bikePrice: 0, carPrice: 0, truckPrice: 0,
    allowedVehicles: ['bike', 'car']
  })

  // ── Fetch ───────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await parkingAPI.adminDashboard()
      setStats(res.data.data)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [])

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true)
      const res = await parkingAPI.adminLocations()
      setLocations(res.data.data || [])
    } catch (err) {
      console.error('Error fetching locations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSlots = async (locId) => {
    try {
      const res = await parkingAPI.adminSlots(locId)
      setSlots(res.data.data || [])
    } catch (err) {
      console.error('Error fetching slots:', err)
    }
  }

  const fetchBookings = async () => {
    try {
      const res = await parkingAPI.adminBookings()
      setBookings(res.data.data || [])
    } catch (err) {
      console.error('Error fetching bookings:', err)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchLocations()
  }, [fetchStats, fetchLocations])

  // ── Add Location ────────────────────────────────────────
  const handleAddLocation = async () => {
    if (!form.name || !form.address) {
      alert('Name and address are required.')
      return
    }

    try {
      const allowedVehicles = []
      if (form.bikeSlots > 0) allowedVehicles.push('bike')
      if (form.carSlots > 0) allowedVehicles.push('car')
      if (form.truckSlots > 0) allowedVehicles.push('truck')
      if (allowedVehicles.length === 0) allowedVehicles.push('car')

      await parkingAPI.adminAddLocation({
        name: form.name,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        isPaid: form.isPaid,
        allowedVehicles,
        totalSlots: { bike: form.bikeSlots, car: form.carSlots, truck: form.truckSlots },
        pricePerHour: form.isPaid
          ? { bike: form.bikePrice, car: form.carPrice, truck: form.truckPrice }
          : { bike: 0, car: 0, truck: 0 }
      })

      setShowAddForm(false)
      setForm({
        name: '', address: '', latitude: 18.52, longitude: 73.86,
        isPaid: false, bikeSlots: 0, carSlots: 10, truckSlots: 0,
        bikePrice: 0, carPrice: 0, truckPrice: 0, allowedVehicles: ['bike', 'car']
      })
      fetchLocations()
      fetchStats()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add location')
    }
  }

  // ── Delete Location ────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Deactivate this parking location?')) return
    try {
      await parkingAPI.adminDeleteLocation(id)
      fetchLocations()
      fetchStats()
    } catch (err) {
      alert('Failed to deactivate')
    }
  }

  // ── Force slot status ──────────────────────────────────
  const handleForceStatus = async (slotId, status) => {
    try {
      await parkingAPI.adminForceSlotStatus(slotId, { status })
      if (selectedLocation) fetchSlots(selectedLocation._id)
      fetchStats()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update slot')
    }
  }

  // ── View slots for location ────────────────────────────
  const viewSlots = (loc) => {
    setSelectedLocation(loc)
    fetchSlots(loc._id)
    setTab('slots')
  }

  const formatTime = (d) => new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  // ═════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="admin-parking">
      <div className="admin-parking-header">
        <h1><ParkingSquare size={28} /> Parking Management</h1>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={14} /> Add Location
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      {stats && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card blue">
            <span className="admin-stat-label">Locations</span>
            <span className="admin-stat-value">{stats.locations}</span>
          </div>
          <div className="admin-stat-card green">
            <span className="admin-stat-label">Available Slots</span>
            <span className="admin-stat-value">{stats.slots.available}</span>
          </div>
          <div className="admin-stat-card yellow">
            <span className="admin-stat-label">Reserved</span>
            <span className="admin-stat-value">{stats.slots.reserved}</span>
          </div>
          <div className="admin-stat-card red">
            <span className="admin-stat-label">Occupied</span>
            <span className="admin-stat-value">{stats.slots.occupied}</span>
          </div>
          <div className="admin-stat-card purple">
            <span className="admin-stat-label">Active Bookings</span>
            <span className="admin-stat-value">{stats.activeBookings}</span>
          </div>
          <div className="admin-stat-card cyan">
            <span className="admin-stat-label">Today Revenue</span>
            <span className="admin-stat-value">₹{stats.dailyRevenue}</span>
          </div>
        </div>
      )}

      {/* ── Add Form ───────────────────────────────────────── */}
      {showAddForm && (
        <div className="admin-add-form">
          <h3><Plus size={16} /> Add Parking Location</h3>

          <div className="admin-form-grid">
            <div className="form-group">
              <label>Parking Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. City Center Parking" />
            </div>
            <div className="form-group">
              <label>Address *</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. 123 Main Street" />
            </div>
            <div className="form-group">
              <label>Pricing</label>
              <select value={form.isPaid ? 'paid' : 'free'} onChange={(e) => setForm({ ...form, isPaid: e.target.value === 'paid' })}>
                <option value="free">🆓 Free</option>
                <option value="paid">💰 Paid</option>
              </select>
            </div>

            <div className="form-group">
              <label>Bike Slots</label>
              <input type="number" min="0" value={form.bikeSlots} onChange={(e) => setForm({ ...form, bikeSlots: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Car Slots</label>
              <input type="number" min="0" value={form.carSlots} onChange={(e) => setForm({ ...form, carSlots: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Truck Slots</label>
              <input type="number" min="0" value={form.truckSlots} onChange={(e) => setForm({ ...form, truckSlots: Number(e.target.value) })} />
            </div>

            {form.isPaid && (
              <>
                <div className="form-group">
                  <label>Bike ₹/hr</label>
                  <input type="number" min="0" value={form.bikePrice} onChange={(e) => setForm({ ...form, bikePrice: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Car ₹/hr</label>
                  <input type="number" min="0" value={form.carPrice} onChange={(e) => setForm({ ...form, carPrice: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Truck ₹/hr</label>
                  <input type="number" min="0" value={form.truckPrice} onChange={(e) => setForm({ ...form, truckPrice: Number(e.target.value) })} />
                </div>
              </>
            )}
          </div>

          <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.5rem 0' }}>📍 Click on the map to set the location coordinates</p>

          <div style={{ borderRadius: 12, overflow: 'hidden', height: 250, marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <MapContainer center={[form.latitude, form.longitude]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CartoDB" />
              <MapClickHandler onLocationPick={(latlng) => setForm({ ...form, latitude: latlng.lat, longitude: latlng.lng })} />
              <Marker position={[form.latitude, form.longitude]} icon={pinIcon} />
            </MapContainer>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#aaa' }}>Lat: {form.latitude.toFixed(5)}, Lng: {form.longitude.toFixed(5)}</p>

          <div className="admin-form-row">
            <button className="btn-primary" onClick={handleAddLocation}><CheckCircle size={14} /> Create Location</button>
            <button className="btn-secondary" onClick={() => setShowAddForm(false)}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="admin-parking-tabs">
        <button className={`admin-parking-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          <LayoutDashboard size={14} /> Locations
        </button>
        <button className={`admin-parking-tab ${tab === 'slots' ? 'active' : ''}`} onClick={() => setTab('slots')} disabled={!selectedLocation}>
          <Settings size={14} /> Slot Management
        </button>
        <button className={`admin-parking-tab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => { setTab('bookings'); fetchBookings() }}>
          <List size={14} /> Bookings
        </button>
      </div>

      {/* ── Locations Tab ──────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="admin-locations-list">
          {loading ? (
            <div className="parking-loading"><div className="spinner" /></div>
          ) : locations.length === 0 ? (
            <div className="parking-empty">
              <ParkingSquare size={48} />
              <p>No parking locations yet. Click "Add Location" to create one.</p>
            </div>
          ) : (
            locations.map((loc) => {
              const avail = loc.availability || {}
              const totalAvail = Object.values(avail).reduce((s, v) => s + (v.available || 0), 0)
              const totalOcc = Object.values(avail).reduce((s, v) => s + (v.occupied || 0), 0)
              const totalRes = Object.values(avail).reduce((s, v) => s + (v.reserved || 0), 0)
              const totalAll = Object.values(avail).reduce((s, v) => s + (v.total || 0), 0)

              return (
                <div key={loc._id} className={`admin-location-row ${!loc.isActive ? 'inactive' : ''}`} onClick={() => viewSlots(loc)}>
                  <div className="admin-loc-info">
                    <h3>
                      {loc.name}
                      {!loc.isActive && <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: 8 }}>(Inactive)</span>}
                    </h3>
                    <p><MapPin size={11} style={{ display: 'inline' }} /> {loc.address} • {loc.isPaid ? `₹ Paid` : '🆓 Free'}</p>
                  </div>

                  <div className="admin-loc-stats">
                    <div className="admin-loc-stat">
                      <div className="stat-num" style={{ color: '#4ade80' }}>{totalAvail}</div>
                      <div className="stat-label">Available</div>
                    </div>
                    <div className="admin-loc-stat">
                      <div className="stat-num" style={{ color: '#fbbf24' }}>{totalRes}</div>
                      <div className="stat-label">Reserved</div>
                    </div>
                    <div className="admin-loc-stat">
                      <div className="stat-num" style={{ color: '#f87171' }}>{totalOcc}</div>
                      <div className="stat-label">Occupied</div>
                    </div>
                    <div className="admin-loc-stat">
                      <div className="stat-num">{totalAll}</div>
                      <div className="stat-label">Total</div>
                    </div>
                  </div>

                  <div className="admin-loc-actions">
                    <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); viewSlots(loc) }} title="Manage Slots">
                      <Settings size={14} />
                    </button>
                    <button className="btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(loc._id) }} title="Deactivate">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Slot Management Tab ────────────────────────────── */}
      {tab === 'slots' && selectedLocation && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              <Settings size={16} /> {selectedLocation.name} — Slots
            </h2>
            <button className="btn-secondary" onClick={() => fetchSlots(selectedLocation._id)}><RefreshCw size={14} /> Refresh</button>
          </div>

          <div className="admin-slots-table-container">
            <table className="admin-slots-table">
              <thead>
                <tr>
                  <th>Slot #</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Current Vehicle</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot._id}>
                    <td style={{ fontWeight: 600 }}>{slot.slotNumber}</td>
                    <td><VehicleIcon type={slot.vehicleType} /> {slot.vehicleType}</td>
                    <td>
                      <span className={`slot-status-dot ${slot.status}`}>
                        {slot.status === 'available' ? '🟢' : slot.status === 'reserved' ? '🟡' : '🔴'} {slot.status}
                      </span>
                    </td>
                    <td>{slot.currentBookingId?.vehicleNumber || '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {slot.currentBookingId?.endTime
                        ? `Until ${formatTime(slot.currentBookingId.endTime)}`
                        : '—'}
                    </td>
                    <td>
                      {slot.status !== 'available' && (
                        <button className="btn-success" onClick={() => handleForceStatus(slot._id, 'available')} style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                          Force Release
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Bookings Tab ───────────────────────────────────── */}
      {tab === 'bookings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>All Bookings</h2>
            <button className="btn-secondary" onClick={fetchBookings}><RefreshCw size={14} /> Refresh</button>
          </div>

          <div className="admin-bookings-table-container">
            <table className="admin-bookings-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Location</th>
                  <th>Slot</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No bookings found</td></tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b._id}>
                      <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{b._id?.slice(-6)}</td>
                      <td>{b.userId?.name || '—'}</td>
                      <td>{b.parkingId?.name || '—'}</td>
                      <td>{b.slotId?.slotNumber || '—'}</td>
                      <td>{b.vehicleNumber}</td>
                      <td>
                        <span className={`slot-status-dot ${b.status === 'active' ? 'available' : b.status === 'pending' ? 'reserved' : 'occupied'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>{b.amount > 0 ? `₹${b.amount}` : 'Free'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{formatTime(b.startTime)}</td>
                      <td style={{ fontSize: '0.78rem' }}>{formatTime(b.endTime)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
