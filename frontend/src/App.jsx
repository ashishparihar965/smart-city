import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { useToast } from './context/ToastContext'
import socketService from './services/socket'
import Layout from './components/Layout/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminTraffic from './pages/AdminTraffic'
import CitizenTraffic from './pages/CitizenTraffic'
import AdminWaste from './pages/AdminWaste'
import CitizenBins from './pages/CitizenBins'
import OperatorWaste from './pages/OperatorWaste'
import Water from './pages/Water'
import Lighting from './pages/Lighting'
import IoTDevices from './pages/IoTDevices'
import Incidents from './pages/Incidents'
import Alerts from './pages/Alerts'
import Logs from './pages/Logs'
import Complaints from './pages/Complaints'
import CitizenAssistant from './pages/CitizenAssistant'
import Announcements from './pages/Announcements'
import CitizenAnnouncements from './pages/CitizenAnnouncements'
import LiveMap from './pages/LiveMap'
import Analytics from './pages/Analytics'
import AdminPanel from './pages/AdminPanel'
import EmergencyPage from './pages/EmergencyPage'
import SmartParking from './pages/SmartParking'
import AdminParking from './pages/AdminParking'
import Weather from './pages/Weather'
import './index.css'

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (roles.length > 0 && !roles.includes(user.role))
    return <Navigate to="/complaints" replace />
  return children
}

const AppRoutes = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <Landing />}
      />
      <Route path="/welcome" element={<Navigate to="/" replace />} />

      {/* Auth */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* Protected App Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />

        {/* City modules — admin + operator only */}
        <Route
          path="traffic"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <AdminTraffic />
            </ProtectedRoute>
          }
        />
        <Route
          path="waste"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <AdminWaste />
            </ProtectedRoute>
          }
        />
        <Route
          path="operator/waste"
          element={
            <ProtectedRoute roles={['operator']}>
              <OperatorWaste />
            </ProtectedRoute>
          }
        />
        <Route
          path="water"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <Water />
            </ProtectedRoute>
          }
        />
        <Route
          path="lighting"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <Lighting />
            </ProtectedRoute>
          }
        />
        <Route
          path="iot"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <IoTDevices />
            </ProtectedRoute>
          }
        />
        <Route
          path="incidents"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <Incidents />
            </ProtectedRoute>
          }
        />
        <Route
          path="alerts"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <Alerts />
            </ProtectedRoute>
          }
        />

        {/* NEW: Live Map — admin + operator */}
        <Route
          path="map"
          element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <LiveMap />
            </ProtectedRoute>
          }
        />

        {/* NEW: Analytics — admin only */}
        <Route
          path="analytics"
          element={
            <ProtectedRoute roles={['admin']}>
              <Analytics />
            </ProtectedRoute>
          }
        />

        {/* NEW: Emergency — all roles */}
        <Route path="emergency" element={<EmergencyPage />} />

        {/* Weather — all roles */}
        <Route path="weather" element={<Weather />} />

        {/* Complaints — all roles */}
        <Route path="complaints" element={<Complaints />} />

        {/* Citizen only */}
        <Route
          path="assistant"
          element={
            <ProtectedRoute roles={['user']}>
              <CitizenAssistant />
            </ProtectedRoute>
          }
        />
        <Route
          path="announcements"
          element={
            <ProtectedRoute roles={['user']}>
              <CitizenAnnouncements />
            </ProtectedRoute>
          }
        />
        <Route
          path="parking"
          element={
            <ProtectedRoute roles={['user']}>
              <SmartParking />
            </ProtectedRoute>
          }
        />
        <Route
          path="dustbins"
          element={
            <ProtectedRoute roles={['user']}>
              <CitizenBins />
            </ProtectedRoute>
          }
        />
        <Route
          path="smart-traffic"
          element={
            <ProtectedRoute roles={['user']}>
              <CitizenTraffic />
            </ProtectedRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="admin/announcements"
          element={
            <ProtectedRoute roles={['admin']}>
              <Announcements />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/panel"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/parking"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminParking />
            </ProtectedRoute>
          }
        />
        <Route
          path="logs"
          element={
            <ProtectedRoute roles={['admin']}>
              <Logs />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={user ? '/dashboard' : '/'} replace />}
      />
    </Routes>
  )
}

const RealtimeNotificationBridge = () => {
  const { user, token } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (!user || !token) return

    socketService.connect(token)
    if (user.id) socketService.joinRoom(`user:${user.id}`)
    if (user.role) socketService.joinRoom(`role:${user.role}`)
    if (user.zone) socketService.joinRoom(`zone:${user.zone}`)

    const onNotification = (payload) => {
      const alert = payload?.alert
      if (!alert?.title) return
      toast.info(`🔔 ${alert.title}`)
    }

    socketService.on('notification:new', onNotification)

    return () => {
      socketService.off('notification:new', onNotification)
    }
  }, [user?.id, user?.role, user?.zone, token, toast])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <RealtimeNotificationBridge />
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
