const socketIo = require('socket.io')
const jwt = require('jsonwebtoken')

let io

module.exports = {
  init: (httpServer) => {
    const origins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
      : ['http://localhost:5173', 'http://localhost:3000']

    io = socketIo(httpServer, {
      cors: {
        origin: origins,
        methods: ['GET', 'POST', 'PUT'],
        credentials: true,
      },
    })

    // Authenticate socket connections with JWT
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token
      if (!token) {
        // Allow anonymous connections but mark as unauthenticated
        socket.user = null
        return next()
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        socket.user = decoded
        next()
      } catch (err) {
        // Allow connection but without auth context
        socket.user = null
        next()
      }
    })

    io.on('connection', (socket) => {
      console.log(`🔗 Client connected: ${socket.id} (user: ${socket.user?.id || 'anonymous'})`)

      // Auto-join user-specific room
      if (socket.user?.id) {
        socket.join(`user:${socket.user.id}`)
      }

      // Clients can join specific rooms
      socket.on('join_room', (room) => {
        if (!room || typeof room !== 'string') return

        // Validate room names to prevent abuse
        const allowedPrefixes = ['iot', 'alerts', 'emergency', 'complaints', 'bins', 'weather', 'parking:', 'device:', 'zone:', 'role:', 'user:']
        const isAllowed = allowedPrefixes.some((prefix) => room === prefix || room.startsWith(prefix))
        if (isAllowed) {
          socket.join(room)
        } else {
          console.warn(`⚠️ Rejected room join attempt: ${room}`)
        }
      })

      socket.on('leave_room', (room) => {
        socket.leave(room)
      })

      socket.on('disconnect', () => {
        // Clean disconnect
      })
    })

    return io
  },

  getIo: () => {
    if (!io) {
      console.warn('⚠️ Socket.io called before initialization')
    }
    return io
  },

  // Utility: emit to a specific user
  emitToUser: (userId, event, data) => {
    if (io) io.to(`user:${userId}`).emit(event, data)
  },

  // Utility: emit to a role group
  emitToRole: (role, event, data) => {
    if (io) io.to(`role:${role}`).emit(event, data)
  },

  // Utility: emit to a zone
  emitToZone: (zone, event, data) => {
    if (io) io.to(`zone:${zone}`).emit(event, data)
  },

  // Utility: broadcast to all
  broadcast: (event, data) => {
    if (io) io.emit(event, data)
  },
}
