import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import { Crosshair, MapPin, Navigation, X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './LocationPickerModal.css'

const DEFAULT_CENTER = [23.03, 72.58]

const normalizeCoordinates = (coords) => {
  if (!coords) return null
  const lat = Number(coords.lat)
  const lng = Number(coords.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

const ChangeView = ({ center }) => {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 14))
    }
  }, [center, map])

  return null
}

const MapClickHandler = ({ onPick }) => {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })

  return null
}

const LocationPickerModal = ({
  isOpen,
  title = 'Pick location on map',
  initialCoordinates,
  onClose,
  onConfirm,
}) => {
  const [selected, setSelected] = useState(null)
  const [didAutoLocate, setDidAutoLocate] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSelected(normalizeCoordinates(initialCoordinates))
      setDidAutoLocate(false)
    }
  }, [isOpen, initialCoordinates])

  useEffect(() => {
    if (!isOpen || didAutoLocate) return
    if (normalizeCoordinates(initialCoordinates)) return
    if (!navigator.geolocation) {
      setDidAutoLocate(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelected({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setDidAutoLocate(true)
      },
      () => {
        setDidAutoLocate(true)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [isOpen, didAutoLocate, initialCoordinates])

  const mapCenter = useMemo(() => {
    if (selected) return [selected.lat, selected.lng]

    const initial = normalizeCoordinates(initialCoordinates)
    if (initial) return [initial.lat, initial.lng]

    return DEFAULT_CENTER
  }, [selected, initialCoordinates])

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelected({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        // no-op for denied or unavailable geolocation
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay location-picker-overlay" onClick={onClose}>
      <div className="modal-content location-picker-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header-row">
          <h2>
            <MapPin size={16} /> {title}
          </h2>
          <button className="btn btn-sm btn-outline" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <p className="location-picker-hint">
          Map pe click karke exact location select karein.
        </p>

        <div className="location-picker-map-wrap">
          <MapContainer center={mapCenter} zoom={13} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapClickHandler onPick={setSelected} />
            {selected && (
              <>
                <CircleMarker
                  center={[selected.lat, selected.lng]}
                  radius={9}
                  pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9 }}
                />
                <ChangeView center={selected} />
              </>
            )}
          </MapContainer>
        </div>

        <div className="location-picker-footer-row">
          <div className="location-picker-coords">
            <Crosshair size={13} />
            {selected
              ? `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`
              : 'No location selected'}
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleUseCurrentLocation}>
            <Navigation size={13} /> Current Location
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(selected)}
            disabled={!selected}
          >
            Use Selected Location
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default LocationPickerModal
