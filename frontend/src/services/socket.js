import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

class SocketService {
  constructor() {
    this.socket = null
    this.listeners = new Map()
    this.joinedRooms = new Set()
    this.activeToken = null
  }

  connect(token) {
    const authToken = token || localStorage.getItem('smartcity_token') || null

    if (this.socket?.connected && this.activeToken === authToken) return

    if (this.socket && this.activeToken !== authToken) {
      this.socket.disconnect()
      this.socket = null
    }

    this.activeToken = authToken

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: authToken ? { token: authToken } : undefined,
    })

    this.socket.on('connect', () => {
      console.log('🔗 WebSocket connected:', this.socket.id)
      this.joinedRooms.forEach((room) => {
        this.socket.emit('join_room', room)
      })
    })

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason)
    })

    this.socket.on('connect_error', (err) => {
      console.warn('⚠️ WebSocket connection error:', err.message)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinRoom(room) {
    if (!room || typeof room !== 'string') return
    this.joinedRooms.add(room)
    if (this.socket?.connected) {
      this.socket.emit('join_room', room)
    }
  }

  on(event, callback) {
    if (!this.socket) return
    this.socket.on(event, callback)

    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  once(event, callback) {
    if (!this.socket) return
    this.socket.once(event, callback)
  }

  off(event, callback) {
    if (!this.socket) return
    if (callback) {
      this.socket.off(event, callback)
    } else {
      this.socket.off(event)
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }
}

const socketService = new SocketService()
export default socketService
