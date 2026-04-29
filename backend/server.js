const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
const express = require('express')
const cors = require('cors')
const http = require('http')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const socketUtils = require('./utils/socket')
const connectDB = require('./config/db')
const errorHandler = require('./middleware/errorHandler')
const { initCronJobs } = require('./utils/cron')

// Import routes
const authRoutes = require('./routes/auth')
const dashboardRoutes = require('./routes/dashboard')
const trafficRoutes = require('./routes/traffic')
const binsRoutes = require('./routes/bins')
const waterRoutes = require('./routes/water')
const lightingRoutes = require('./routes/lighting')
const incidentRoutes = require('./routes/incidents')
const alertRoutes = require('./routes/alerts')
const logRoutes = require('./routes/logs')
const complaintRoutes = require('./routes/complaints')
const chatRoutes = require('./routes/chat')
const iotRoutes = require('./routes/iot')
const announcementRoutes = require('./routes/announcements')
const cityHealthRoutes = require('./routes/cityHealth')
const emergencyRoutes = require('./routes/emergency')
const analyticsRoutes = require('./routes/analytics')
const adminRoutes = require('./routes/admin')
const mapRoutes = require('./routes/map')
const parkingRoutes = require('./routes/parking')
const weatherRoutes = require('./routes/weather')

const app = express()

const parseTrustProxy = (value) => {
  if (value === undefined) return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  if (!Number.isNaN(Number(value))) return Number(value)
  return value
}

const trustProxyFromEnv = parseTrustProxy(process.env.TRUST_PROXY)
const trustProxySetting =
  trustProxyFromEnv !== undefined
    ? trustProxyFromEnv
    : process.env.NODE_ENV === 'production'
      ? 1
      : false

app.set('trust proxy', trustProxySetting)

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// Compression
app.use(compression())

// CORS — configured from env
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000']

const isOriginAllowed = (origin) => {
  if (!origin) return true

  return corsOrigins.some((allowedOrigin) => {
    if (allowedOrigin === '*') return true
    if (allowedOrigin === origin) return true

    if (allowedOrigin.startsWith('*.')) {
      try {
        const { hostname } = new URL(origin)
        const suffix = allowedOrigin.slice(1)
        return hostname.endsWith(suffix)
      } catch {
        return false
      }
    }

    return false
  })
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true)
      }

      console.warn(`[CORS] Blocked origin: ${origin}`)
      return callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
)

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', apiLimiter)

// Stricter auth rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Try again later.' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Connect to database
connectDB()

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/traffic', trafficRoutes)
app.use('/api/bins', binsRoutes)
app.use('/api/water', waterRoutes)
app.use('/api/lighting', lightingRoutes)
app.use('/api/incidents', incidentRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/complaints', complaintRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/iot', iotRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/city-health', cityHealthRoutes)
app.use('/api/emergency', emergencyRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/map', mapRoutes)
app.use('/api/parking', parkingRoutes)
app.use('/api/weather', weatherRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart City API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  })
})

// Error handler (must be last)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

// HTTP Server + Socket.io
const server = http.createServer(app)
socketUtils.init(server)

// Initialize cron jobs after DB connection
const mongoose = require('mongoose')
mongoose.connection.once('connected', () => {
  initCronJobs()
})

server.listen(PORT, () => {
  console.log(`\n🏙️  Smart City Backend running on port ${PORT}`)
  console.log(`   API Base URL: http://localhost:${PORT}/api`)
  console.log(`   Health Check: http://localhost:${PORT}/api/health`)
  console.log(`   WebSocket:    ws://localhost:${PORT}`)
  console.log(`   Environment:  ${process.env.NODE_ENV || 'development'}\n`)
})
