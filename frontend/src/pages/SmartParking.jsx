import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { parkingAPI } from '../services/api'
import socketService from '../services/socket'
import {
  ParkingSquare, MapPin, Calendar, Clock, Car, Bike, Truck,
  QrCode, X, Plus, Minus, Timer, Search, ChevronRight, CheckCircle,
  AlertTriangle, Wallet, Ban, RefreshCw, Navigation
} from 'lucide-react'
import './SmartParking.css'

// ─── User location marker ────────────────────────────────────
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div style="
    width: 18px; height: 18px; border-radius: 50%;
    background: #3b82f6; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(59,130,246,0.25), 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
})

// ─── Map controller to fly to user location ──────────────────
function MapController({ userLocation, shouldFly }) {
  const map = useMap()
  useEffect(() => {
    if (userLocation && shouldFly) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 1.5 })
    }
  }, [userLocation, shouldFly, map])
  return null
}

// ─── Map marker icons ────────────────────────────────────────
const createMarkerIcon = (status) => {
  const colors = { available: '#22c55e', limited: '#f59e0b', full: '#ef4444', empty: '#6b7280' }
  const color = colors[status] || '#6b7280'
  return L.divIcon({
    className: 'custom-parking-marker',
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: ${color}; border: 3px solid #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px ${color}80; font-size: 14px;
    ">🅿️</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  })
}

const VehicleIcon = ({ type, size = 16 }) => {
  if (type === 'bike') return <Bike size={size} />
  if (type === 'truck') return <Truck size={size} />
  return <Car size={size} />
}

const formatTime = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

// ─── Countdown Hook ──────────────────────────────────────────
function useCountdown(endTime) {
  const [remaining, setRemaining] = useState('')
  const [isExpiring, setIsExpiring] = useState(false)

  useEffect(() => {
    if (!endTime) return
    const tick = () => {
      const diff = new Date(endTime) - Date.now()
      if (diff <= 0) { setRemaining('Expired'); setIsExpiring(true); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)
      setIsExpiring(diff < 300000) // < 5 min
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endTime])

  return { remaining, isExpiring }
}

// ─── Lock Countdown ──────────────────────────────────────────
function LockCountdown({ lockedUntil }) {
  const { remaining } = useCountdown(lockedUntil)
  return <div className="lock-timer"><Timer size={14} /> Slot locked: {remaining}</div>
}

// ─── Main Component ──────────────────────────────────────────
export default function SmartParking() {
  const [tab, setTab] = useState('map')
  const [locations, setLocations] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  // Booking flow state
  const [bookingStep, setBookingStep] = useState(0)
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [lockedSlot, setLockedSlot] = useState(null)
  const [lockExpiry, setLockExpiry] = useState(null)
  const [bookingForm, setBookingForm] = useState({ vehicleType: 'car', vehicleNumber: '', durationMinutes: 60 })
  const [createdBooking, setCreatedBooking] = useState(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  // Extend modal
  const [extendModal, setExtendModal] = useState(null)
  const [extendMinutes, setExtendMinutes] = useState(30)

  const mapRef = useRef(null)

  // User geolocation
  const [userLocation, setUserLocation] = useState(null)
  const [mapCenter, setMapCenter] = useState([18.52, 73.86])
  const [shouldFlyToUser, setShouldFlyToUser] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setMapCenter([loc.lat, loc.lng])
        setShouldFlyToUser(true)
      },
      (err) => console.warn('Geolocation denied:', err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    )
    // Watch position for live updates
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Fetch data ──────────────────────────────────────────────
  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterType) params.vehicleType = filterType
      if (search) params.search = search
      const res = await parkingAPI.getAll(params)
      setLocations(res.data.data || [])
    } catch (err) {
      console.error('Error fetching parking locations:', err)
    } finally {
      setLoading(false)
    }
  }, [filterType, search])

  const fetchBookings = useCallback(async () => {
    try {
      const res = await parkingAPI.myBookings()
      setBookings(res.data.data || [])
    } catch (err) {
      console.error('Error fetching bookings:', err)
    }
  }, [])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  useEffect(() => {
    if (tab === 'bookings') fetchBookings()
  }, [tab, fetchBookings])

  // Socket updates
  useEffect(() => {
    const handler = () => fetchLocations()
    socketService.on('parking:global_update', handler)
    return () => socketService.off('parking:global_update', handler)
  }, [fetchLocations])

  // ── Select location for booking ────────────────────────────
  const selectLocation = async (loc) => {
    setSelectedLocation(loc)
    setBookingStep(1)
    setSelectedSlot(null)
    setLockedSlot(null)
    setCreatedBooking(null)
    setBookingForm({ vehicleType: 'car', vehicleNumber: '', durationMinutes: 60 })
    setTab('book')

    // Fetch slots
    try {
      const res = await parkingAPI.getSlots(loc._id, { vehicleType: 'car' })
      setSlots(res.data.data || [])
    } catch (err) {
      console.error('Error fetching slots:', err)
    }
  }

  const fetchSlots = async (vehicleType) => {
    if (!selectedLocation) return
    try {
      const res = await parkingAPI.getSlots(selectedLocation._id, { vehicleType })
      setSlots(res.data.data || [])
    } catch (err) {
      console.error('Error fetching slots:', err)
    }
  }

  // ── Lock slot ──────────────────────────────────────────────
  const handleLockSlot = async () => {
    if (!selectedSlot) return
    try {
      setBookingLoading(true)
      const res = await parkingAPI.lockSlot(selectedLocation._id, selectedSlot._id)
      setLockedSlot(res.data.data)
      setLockExpiry(res.data.data.lockedUntil)
      setBookingStep(2)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to lock slot')
    } finally {
      setBookingLoading(false)
    }
  }

  // ── Create booking ────────────────────────────────────────
  const handleCreateBooking = async () => {
    if (!bookingForm.vehicleNumber.trim()) {
      alert('Please enter your vehicle number')
      return
    }
    try {
      setBookingLoading(true)
      const res = await parkingAPI.createBooking({
        parkingId: selectedLocation._id,
        slotId: lockedSlot._id,
        vehicleNumber: bookingForm.vehicleNumber,
        vehicleType: bookingForm.vehicleType,
        durationMinutes: bookingForm.durationMinutes
      })
      const booking = res.data.data

      if (booking.isPaid && booking.status === 'pending') {
        setCreatedBooking(booking)
        setBookingStep(3) // payment step
      } else {
        setCreatedBooking(booking)
        setBookingStep(4) // QR step
      }
      fetchLocations()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create booking')
    } finally {
      setBookingLoading(false)
    }
  }

  // ── Confirm paid booking ──────────────────────────────────
  const handleConfirmPayment = async () => {
    try {
      setBookingLoading(true)
      const res = await parkingAPI.confirmBooking(createdBooking._id, { method: 'upi' })
      setCreatedBooking(res.data.data.booking)
      setBookingStep(4) // QR step
      fetchLocations()
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed')
    } finally {
      setBookingLoading(false)
    }
  }

  // ── Cancel booking ────────────────────────────────────────
  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Cancel this booking?')) return
    try {
      await parkingAPI.cancelBooking(bookingId)
      fetchBookings()
      fetchLocations()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel')
    }
  }

  // ── Extend booking ────────────────────────────────────────
  const handleExtendBooking = async () => {
    if (!extendModal) return
    try {
      await parkingAPI.extendBooking(extendModal._id, { additionalMinutes: extendMinutes })
      setExtendModal(null)
      fetchBookings()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to extend')
    }
  }

  // ── Active bookings count ─────────────────────────────────
  const activeCount = bookings.filter(b => b.status === 'active' || b.status === 'pending').length

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="smart-parking">
      <div className="parking-header">
        <h1><ParkingSquare size={28} /> Smart Parking</h1>
        <div className="parking-tabs">
          <button className={`parking-tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>
            <MapPin size={15} /> Find Parking
          </button>
          <button className={`parking-tab ${tab === 'book' ? 'active' : ''}`} onClick={() => setTab('book')} disabled={!selectedLocation}>
            <Calendar size={15} /> Book
          </button>
          <button className={`parking-tab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => setTab('bookings')}>
            <QrCode size={15} /> My Bookings
            {activeCount > 0 && <span className="tab-badge">{activeCount}</span>}
          </button>
        </div>
      </div>

      {/* ── MAP TAB ──────────────────────────────────────────── */}
      {tab === 'map' && (
        <div>
          <div className="parking-map-search">
            <input
              type="text"
              placeholder="Search parking locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Vehicles</option>
              <option value="bike">🏍️ Bike</option>
              <option value="car">🚗 Car</option>
              <option value="truck">🚛 Truck</option>
            </select>
          </div>

          <div className="parking-map-container">
            <MapContainer
              center={mapCenter}
              zoom={13}
              ref={mapRef}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap &copy; CartoDB'
              />
              <MapController userLocation={userLocation} shouldFly={shouldFlyToUser} />
              {userLocation && (
                <>
                  <Circle
                    center={[userLocation.lat, userLocation.lng]}
                    radius={150}
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1 }}
                  />
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                    <Popup>
                      <div style={{ color: '#333', fontWeight: 600, fontSize: 13 }}>📍 You are here</div>
                    </Popup>
                  </Marker>
                </>
              )}
              {locations.map((loc) => (
                <Marker
                  key={loc._id}
                  position={[loc.latitude, loc.longitude]}
                  icon={createMarkerIcon(loc.availabilityStatus)}
                >
                  <Popup>
                    <div style={{ minWidth: 200, color: '#333' }}>
                      <strong style={{ fontSize: '14px' }}>{loc.name}</strong>
                      <br />
                      <span style={{ fontSize: '12px', color: '#666' }}>{loc.address}</span>
                      <br />
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        color: loc.availabilityStatus === 'available' ? '#16a34a' :
                               loc.availabilityStatus === 'limited' ? '#d97706' : '#dc2626'
                      }}>
                        {loc.totalAvailable} / {loc.totalSlots} slots available
                      </span>
                      <br />
                      <span style={{ fontSize: '11px' }}>
                        {loc.isPaid ? `₹${Object.values(loc.pricePerHour || {}).filter(Boolean)[0] || 0}/hr` : '🆓 Free Parking'}
                      </span>
                      <br />
                      <button
                        onClick={() => selectLocation(loc)}
                        style={{
                          marginTop: 6, padding: '4px 12px', borderRadius: 6,
                          background: '#3b82f6', color: '#fff', border: 'none',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600
                        }}
                      >
                        Book Now →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="parking-locations-grid">
            {loading ? (
              <div className="parking-loading"><div className="spinner" /></div>
            ) : locations.length === 0 ? (
              <div className="parking-empty">
                <ParkingSquare size={48} />
                <p>No parking locations found</p>
              </div>
            ) : (
              locations.map((loc) => (
                <div
                  key={loc._id}
                  className={`parking-location-card status-${loc.availabilityStatus}`}
                  onClick={() => selectLocation(loc)}
                >
                  <div className="plc-header">
                    <div>
                      <h3 className="plc-name">{loc.name}</h3>
                      <div className="plc-address"><MapPin size={12} /> {loc.address}</div>
                    </div>
                    <span className={`plc-badge ${loc.availabilityStatus}`}>
                      {loc.availabilityStatus === 'available' ? '🟢 Available' :
                       loc.availabilityStatus === 'limited' ? '🟡 Limited' : '🔴 Full'}
                    </span>
                  </div>

                  <div className="plc-slots">
                    {loc.availability && Object.entries(loc.availability).map(([type, data]) => (
                      <div key={type} className="plc-slot-chip">
                        <VehicleIcon type={type} size={13} />
                        <span className="count">{data.available}</span>/{data.total} {type}
                      </div>
                    ))}
                  </div>

                  <div className="plc-pricing">
                    {loc.isPaid ? (
                      <span className="plc-price-tag">
                        <Wallet size={13} /> ₹{Object.values(loc.pricePerHour || {}).filter(Boolean)[0] || 0}/hr
                      </span>
                    ) : (
                      <span className="plc-price-tag free">🆓 Free</span>
                    )}
                    <ChevronRight size={16} style={{ opacity: 0.4 }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── BOOK TAB ─────────────────────────────────────────── */}
      {tab === 'book' && selectedLocation && (
        <div className="booking-section">
          <h2><ParkingSquare size={20} /> {selectedLocation.name}</h2>
          <p className="plc-address" style={{ marginBottom: '1rem' }}>
            <MapPin size={13} /> {selectedLocation.address}
            {selectedLocation.isPaid ? ` • ₹${selectedLocation.pricePerHour?.[bookingForm.vehicleType] || 0}/hr` : ' • Free Parking'}
          </p>

          {/* Steps indicator */}
          <div className="booking-steps">
            {['Select Slot', 'Vehicle Info', 'Payment', 'Confirmed'].map((label, i) => (
              <div key={i} className={`booking-step ${bookingStep > i + 1 ? 'completed' : bookingStep === i + 1 ? 'active' : ''}`}>
                {bookingStep > i + 1 ? <CheckCircle size={12} /> : null} {label}
              </div>
            ))}
          </div>

          {/* Step 1: Select Slot */}
          {bookingStep === 1 && (
            <div>
              <div className="booking-form-grid">
                <div className="form-group">
                  <label>Vehicle Type</label>
                  <select
                    value={bookingForm.vehicleType}
                    onChange={(e) => {
                      setBookingForm({ ...bookingForm, vehicleType: e.target.value })
                      fetchSlots(e.target.value)
                      setSelectedSlot(null)
                    }}
                  >
                    {(selectedLocation.allowedVehicles || []).map(v => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h3 style={{ fontSize: '0.95rem', margin: '1rem 0 0.5rem', fontWeight: 600 }}>
                Available Slots ({slots.filter(s => s.isAvailable).length} free)
              </h3>

              <div className="slot-legend">
                <div className="slot-legend-item"><div className="slot-legend-dot available" /> Available</div>
                <div className="slot-legend-item"><div className="slot-legend-dot selected" /> Selected</div>
                <div className="slot-legend-item"><div className="slot-legend-dot reserved" /> Reserved</div>
                <div className="slot-legend-item"><div className="slot-legend-dot occupied" /> Occupied</div>
              </div>

              <div className="slot-grid">
                {slots.map((slot) => (
                  <div
                    key={slot._id}
                    className={`slot-item ${
                      selectedSlot?._id === slot._id ? 'selected' :
                      slot.isLockedByMe ? 'locked-by-me' :
                      slot.isAvailable ? 'available' :
                      slot.status
                    }`}
                    onClick={() => slot.isAvailable || slot.isLockedByMe ? setSelectedSlot(slot) : null}
                    title={`${slot.slotNumber} - ${slot.isAvailable ? 'Available' : slot.status}`}
                  >
                    {slot.slotNumber}
                  </div>
                ))}
                {slots.length === 0 && (
                  <div className="parking-empty" style={{ gridColumn: '1/-1' }}>
                    <p>No slots available for this vehicle type</p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary" disabled={!selectedSlot || bookingLoading} onClick={handleLockSlot}>
                  {bookingLoading ? <RefreshCw size={14} className="spinning" /> : <Timer size={14} />}
                  Lock Selected Slot
                </button>
                <button className="btn-secondary" onClick={() => { setTab('map'); setSelectedLocation(null) }}>
                  <X size={14} /> Back to Map
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Vehicle Info + Duration */}
          {bookingStep === 2 && lockedSlot && (
            <div>
              <LockCountdown lockedUntil={lockExpiry} />

              <div className="booking-form-grid" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Slot Number</label>
                  <input type="text" value={lockedSlot.slotNumber} disabled />
                </div>
                <div className="form-group">
                  <label>Vehicle Type</label>
                  <input type="text" value={bookingForm.vehicleType} disabled />
                </div>
                <div className="form-group">
                  <label>Vehicle Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. MH 12 AB 1234"
                    value={bookingForm.vehicleNumber}
                    onChange={(e) => setBookingForm({ ...bookingForm, vehicleNumber: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label>Duration</label>
                  <select
                    value={bookingForm.durationMinutes}
                    onChange={(e) => setBookingForm({ ...bookingForm, durationMinutes: Number(e.target.value) })}
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={120}>2 Hours</option>
                    <option value={180}>3 Hours</option>
                    <option value={240}>4 Hours</option>
                    <option value={360}>6 Hours</option>
                    <option value={480}>8 Hours</option>
                    <option value={720}>12 Hours</option>
                    <option value={1440}>24 Hours</option>
                  </select>
                </div>
              </div>

              {selectedLocation.isPaid && (
                <div style={{ padding: '0.75rem', background: 'rgba(96,165,250,0.1)', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9rem' }}>
                  💰 Estimated Cost: <strong>₹{Math.ceil(bookingForm.durationMinutes / 60) * (selectedLocation.pricePerHour?.[bookingForm.vehicleType] || 0)}</strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary" disabled={bookingLoading} onClick={handleCreateBooking}>
                  {bookingLoading ? <RefreshCw size={14} className="spinning" /> : <CheckCircle size={14} />}
                  {selectedLocation.isPaid ? 'Proceed to Payment' : 'Confirm Booking'}
                </button>
                <button className="btn-secondary" onClick={() => setBookingStep(1)}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment (for paid parking) */}
          {bookingStep === 3 && createdBooking && (
            <div>
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <Wallet size={48} style={{ color: '#60a5fa', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>Payment Required</h3>
                <p style={{ color: '#888', fontSize: '0.9rem' }}>
                  Amount: <strong style={{ color: '#fff', fontSize: '1.3rem' }}>₹{createdBooking.amount}</strong>
                </p>
                <p style={{ color: '#888', fontSize: '0.8rem', margin: '0.5rem 0' }}>
                  Slot {createdBooking.slotId?.slotNumber || lockedSlot?.slotNumber} • {createdBooking.vehicleNumber} • {bookingForm.durationMinutes} min
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                  <button className="btn-primary" onClick={handleConfirmPayment} disabled={bookingLoading}>
                    {bookingLoading ? <RefreshCw size={14} className="spinning" /> : <Wallet size={14} />}
                    Pay ₹{createdBooking.amount} via UPI
                  </button>
                  <button className="btn-danger" onClick={() => handleCancelBooking(createdBooking._id)}>
                    <Ban size={14} /> Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation + QR */}
          {bookingStep === 4 && createdBooking && (
            <div className="qr-display">
              <CheckCircle size={48} style={{ color: '#4ade80' }} />
              <h3>Booking Confirmed!</h3>
              <p style={{ color: '#888', fontSize: '0.85rem' }}>
                Show this QR code at parking entry. Valid for 10 minutes.
              </p>

              {createdBooking.qrCode && (
                <img src={createdBooking.qrCode} alt="Entry QR Code" />
              )}

              <div className="qr-info">
                <div className="qr-info-item">
                  <div className="label">Booking ID</div>
                  <div className="value">{createdBooking._id?.slice(-8).toUpperCase()}</div>
                </div>
                <div className="qr-info-item">
                  <div className="label">Slot</div>
                  <div className="value">{lockedSlot?.slotNumber}</div>
                </div>
                <div className="qr-info-item">
                  <div className="label">Vehicle</div>
                  <div className="value">{createdBooking.vehicleNumber}</div>
                </div>
                <div className="qr-info-item">
                  <div className="label">Duration</div>
                  <div className="value">{bookingForm.durationMinutes} min</div>
                </div>
                <div className="qr-info-item">
                  <div className="label">Start</div>
                  <div className="value">{formatTime(createdBooking.startTime)}</div>
                </div>
                <div className="qr-info-item">
                  <div className="label">End</div>
                  <div className="value">{formatTime(createdBooking.endTime)}</div>
                </div>
              </div>

              {createdBooking.amount > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#60a5fa' }}>
                  💰 Paid: ₹{createdBooking.amount}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button className="btn-primary" onClick={() => { setTab('bookings'); fetchBookings() }}>
                  <QrCode size={14} /> View My Bookings
                </button>
                <button className="btn-secondary" onClick={() => { setTab('map'); setSelectedLocation(null); setBookingStep(0) }}>
                  <MapPin size={14} /> Back to Map
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BOOKINGS TAB ─────────────────────────────────────── */}
      {tab === 'bookings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>My Bookings</h2>
            <button className="btn-secondary" onClick={fetchBookings}><RefreshCw size={14} /> Refresh</button>
          </div>

          <div className="bookings-list">
            {bookings.length === 0 ? (
              <div className="parking-empty">
                <Calendar size={48} />
                <p>No bookings yet. Find parking and book a slot!</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <BookingCard
                  key={booking._id}
                  booking={booking}
                  onCancel={handleCancelBooking}
                  onExtend={(b) => { setExtendModal(b); setExtendMinutes(30) }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Extend Modal ─────────────────────────────────────── */}
      {extendModal && (
        <div className="modal-overlay" onClick={() => setExtendModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3><Plus size={16} /> Extend Parking</h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
              Current end time: {formatTime(extendModal.endTime)} on {formatDate(extendModal.endTime)}
            </p>
            <div className="form-group">
              <label>Extend by</label>
              <select value={extendMinutes} onChange={(e) => setExtendMinutes(Number(e.target.value))}>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={120}>2 Hours</option>
                <option value={180}>3 Hours</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setExtendModal(null)}>Cancel</button>
              <button className="btn-success" onClick={handleExtendBooking}>
                <Plus size={14} /> Extend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Booking Card Sub-Component ──────────────────────────────
function BookingCard({ booking, onCancel, onExtend }) {
  const { remaining, isExpiring } = useCountdown(booking.status === 'active' ? booking.endTime : null)

  return (
    <div className={`booking-card status-${booking.status}`}>
      <div className="booking-card-header">
        <span className="booking-parking-name">{booking.parkingId?.name || 'Parking'}</span>
        <span className={`booking-status-badge ${booking.status}`}>{booking.status}</span>
      </div>

      <div className="booking-details-grid">
        <div className="booking-detail">
          <div className="detail-label">Slot</div>
          <div className="detail-value">{booking.slotId?.slotNumber || '—'}</div>
        </div>
        <div className="booking-detail">
          <div className="detail-label">Vehicle</div>
          <div className="detail-value">{booking.vehicleNumber}</div>
        </div>
        <div className="booking-detail">
          <div className="detail-label">Type</div>
          <div className="detail-value" style={{ textTransform: 'capitalize' }}>{booking.vehicleType}</div>
        </div>
        <div className="booking-detail">
          <div className="detail-label">Duration</div>
          <div className="detail-value">{booking.duration} min</div>
        </div>
        <div className="booking-detail">
          <div className="detail-label">Start</div>
          <div className="detail-value">{formatDate(booking.startTime)} {formatTime(booking.startTime)}</div>
        </div>
        <div className="booking-detail">
          <div className="detail-label">End</div>
          <div className="detail-value">{formatDate(booking.endTime)} {formatTime(booking.endTime)}</div>
        </div>
        {booking.amount > 0 && (
          <div className="booking-detail">
            <div className="detail-label">Amount</div>
            <div className="detail-value">₹{booking.amount}</div>
          </div>
        )}
      </div>

      {booking.status === 'active' && remaining && (
        <div className={`booking-countdown ${isExpiring ? 'expiring' : ''}`}>
          <Timer size={14} /> {isExpiring ? '⚠️ ' : ''}Remaining: {remaining}
        </div>
      )}

      {booking.status === 'active' && booking.qrCode && (
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#60a5fa' }}>
            <QrCode size={12} style={{ display: 'inline', marginRight: 4 }} /> Show QR Code
          </summary>
          <img
            src={booking.qrCode}
            alt="QR"
            style={{ width: 140, height: 140, borderRadius: 8, background: '#fff', padding: 4, marginTop: 8 }}
          />
        </details>
      )}

      {(booking.status === 'active' || booking.status === 'pending') && (
        <div className="booking-actions">
          {booking.status === 'active' && (
            <button className="btn-success" onClick={() => onExtend(booking)}>
              <Plus size={14} /> Extend
            </button>
          )}
          <button className="btn-danger" onClick={() => onCancel(booking._id)}>
            <Ban size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  )
}
