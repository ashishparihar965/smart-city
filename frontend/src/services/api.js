import axios from 'axios'

const API_BASE =
  import.meta.env.VITE_BACKEND_URI ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

const AUTH_DEBUG = import.meta.env.VITE_AUTH_DEBUG === 'true'

if (AUTH_DEBUG) {
  console.info('[AUTH][CONFIG]', {
    apiBase: API_BASE,
    socketUrl: import.meta.env.VITE_SOCKET_URL,
  })
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Add JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartcity_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (AUTH_DEBUG && config.url?.startsWith('/auth/')) {
    console.info('[AUTH][REQUEST]', {
      method: config.method,
      url: `${config.baseURL || ''}${config.url}`,
    })
  }

  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || ''
    const isLoginOrRegister = /\/auth\/(login|register)$/.test(requestUrl)
    const fullUrl = `${error.config?.baseURL || ''}${requestUrl}`

    if (!error.response) {
      console.error('[AUTH][NETWORK_ERROR]', {
        url: fullUrl,
        message: error.message,
        code: error.code,
      })
    }

    if (requestUrl.startsWith('/auth/') || AUTH_DEBUG) {
      console.error('[AUTH][RESPONSE_ERROR]', {
        url: fullUrl,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        data: error.response?.data,
      })
    }

    if (error.response && error.response.status === 401 && !isLoginOrRegister) {
      localStorage.removeItem('smartcity_token')
      localStorage.removeItem('smartcity_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  getUsers: (params) => api.get('/auth/users', { params }),
  getOperators: () => api.get('/auth/operators'),
  createUser: (data) => api.post('/auth/users', data),
}

// Dashboard API
export const dashboardAPI = {
  getData: () => api.get('/dashboard'),
  predict: () => api.post('/dashboard/predict'),
}

// Traffic API
export const trafficAPI = {
  getAll: (params) => api.get('/traffic', { params }),
  getStats: () => api.get('/traffic/stats'),
  create: (data) => api.post('/traffic', data),
  update: (id, data) => api.put(`/traffic/${id}`, data),
  reportIncident: (id, data) => api.post(`/traffic/${id}/report-incident`, data),
  emergencyOverride: (id) => api.post(`/traffic/${id}/emergency-override`),
  clearOverride: (id) => api.post(`/traffic/${id}/clear-override`),
  predict: (zone) => api.get(`/traffic/predict/${zone}`),
}

// Bins API (new waste management)
export const binsAPI = {
  getAll: () => api.get('/bins'),
  getStats: () => api.get('/bins/stats'),
  getFull: () => api.get('/bins/full'),
  addBin: (data) => api.post('/bins', data),
  markCollection: (id) => api.post(`/bins/${id}/mark-collection`),
  collected: (id) => api.post(`/bins/${id}/collected`),
}

// Weather API
export const weatherAPI = {
  getZones: () => api.get('/weather/zones'),
  getZoneHistory: (hours = 24) => api.get('/weather/zones/history', { params: { hours } }),
  getCity: () => api.get('/weather/city'),
  getAlerts: () => api.get('/weather/alerts'),
}

// Water API
export const waterAPI = {
  getAll: (params) => api.get('/water', { params }),
  getStats: () => api.get('/water/stats'),
  create: (data) => api.post('/water', data),
  update: (id, data) => api.put(`/water/${id}`, data),
  getAnalytics: (zone) => api.get(`/water/analytics/${zone}`),
  analyze: (zone) => api.post(`/water/analyze/${zone}`),
}

// Lighting API
export const lightingAPI = {
  getAll: (params) => api.get('/lighting', { params }),
  getStats: () => api.get('/lighting/stats'),
  create: (data) => api.post('/lighting', data),
  toggle: (id) => api.put(`/lighting/${id}/toggle`),
  toggleAutoMode: (id) => api.put(`/lighting/${id}/auto-mode`),
  reportFault: (id, data) => api.post(`/lighting/${id}/report-fault`, data),
  resolveFault: (id) => api.post(`/lighting/${id}/resolve-fault`),
  autoToggle: () => api.post('/lighting/auto-toggle'),
}

// Incidents API
export const incidentAPI = {
  getAll: (params) => api.get('/incidents', { params }),
  getStats: () => api.get('/incidents/stats'),
  create: (data) => api.post('/incidents', data),
  update: (id, data) => api.put(`/incidents/${id}`, data),
  assign: (id, data) => api.put(`/incidents/${id}/assign`, data),
  delete: (id) => api.delete(`/incidents/${id}`),
}

// Alerts API
export const alertAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
  markAllRead: () => api.put('/alerts/read-all'),
  delete: (id) => api.delete(`/alerts/${id}`),
}

// Logs API
export const logAPI = {
  getAll: (params) => api.get('/logs', { params }),
}

// Complaints API
export const complaintAPI = {
  getAll: (params) => api.get('/complaints', { params }),
  getStats: () => api.get('/complaints/stats'),
  getOne: (id) => api.get(`/complaints/${id}`),
  create: (data) => {
    // Support FormData (for image uploads)
    if (data instanceof FormData) {
      return api.post('/complaints', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    }
    return api.post('/complaints', data)
  },
  assign: (id, data) => api.put(`/complaints/${id}/assign`, data),
  updateStatus: (id, data) => api.put(`/complaints/${id}/status`, data),
  suggestOperator: (params) => api.get('/complaints/suggest-operator', { params }),
  checkOverdue: () => api.post('/complaints/overdue/check'),
}

// Citizen Chat Assistant API
export const chatAPI = {
  askAssistant: (data) => api.post('/chat/assistant', data),
}

// Announcements API
export const announcementAPI = {
  getAll: (params) => api.get('/announcements', { params }),
  create: (data) => api.post('/announcements', data),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  delete: (id) => api.delete(`/announcements/${id}`),
  recordView: (id) => api.post(`/announcements/${id}/view`),
}

// City Health API (Weather + AQI)
export const cityHealthAPI = {
  getData: () => api.get('/city-health'),
}

// IoT Devices API
export const iotAPI = {
  getSummary: () => api.get('/iot/summary'),
  getDevices: (params) => api.get('/iot/devices', { params }),
  getDevice: (deviceId) => api.get(`/iot/devices/${deviceId}`),
  getDeviceTelemetry: (deviceId, params) => api.get(`/iot/devices/${deviceId}/telemetry`, { params }),
  registerDevice: (data) => api.post('/iot/devices/register', data),
  connectDevice: (deviceId, data) => api.post(`/iot/devices/${deviceId}/connect`, data),
  heartbeatDevice: (deviceId, data) => api.post(`/iot/devices/${deviceId}/heartbeat`, data),
  disconnectDevice: (deviceId, data) => api.post(`/iot/devices/${deviceId}/disconnect`, data),
  sendTelemetry: (deviceId, data) => api.post(`/iot/devices/${deviceId}/telemetry`, data),
}

// Emergency API (NEW)
export const emergencyAPI = {
  createSOS: (data) => api.post('/emergency/sos', data),
  getFeed: (params) => api.get('/emergency/feed', { params }),
  respond: (id) => api.put(`/emergency/${id}/respond`),
  resolve: (id) => api.put(`/emergency/${id}/resolve`),
}

// Analytics API (NEW)
export const analyticsAPI = {
  complaintTrends: (params) => api.get('/analytics/complaints', { params }),
  moduleStats: () => api.get('/analytics/modules'),
  operatorPerformance: () => api.get('/analytics/performance'),
  overview: () => api.get('/analytics/overview'),
}

// Admin API (NEW)
export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deactivateUser: (id) => api.delete(`/admin/users/${id}`),
}

// Map API (NEW)
export const mapAPI = {
  getData: (params) => api.get('/map/data', { params }),
}

// Parking API
export const parkingAPI = {
  // Citizen
  getAll: (params) => api.get('/parking', { params }),
  getOne: (id) => api.get(`/parking/${id}`),
  getSlots: (id, params) => api.get(`/parking/${id}/slots`, { params }),
  lockSlot: (parkingId, slotId) => api.post(`/parking/${parkingId}/lock-slot`, { slotId }),
  createBooking: (data) => api.post('/parking/booking/create', data),
  confirmBooking: (id, data) => api.post(`/parking/booking/${id}/confirm`, data),
  myBookings: (params) => api.get('/parking/booking/my', { params }),
  cancelBooking: (id) => api.post(`/parking/booking/${id}/cancel`),
  extendBooking: (id, data) => api.post(`/parking/booking/${id}/extend`, data),
  validateQR: (data) => api.post('/parking/qr/validate', data),
  // Admin
  adminDashboard: () => api.get('/parking/admin/dashboard'),
  adminLocations: () => api.get('/parking/admin/locations'),
  adminAddLocation: (data) => api.post('/parking/admin/add', data),
  adminUpdateLocation: (id, data) => api.put(`/parking/admin/${id}`, data),
  adminDeleteLocation: (id) => api.delete(`/parking/admin/${id}`),
  adminSlots: (id) => api.get(`/parking/admin/${id}/slots`),
  adminForceSlotStatus: (id, data) => api.put(`/parking/admin/slot/${id}/status`, data),
  adminBookings: (params) => api.get('/parking/admin/bookings', { params }),
}

export default api
