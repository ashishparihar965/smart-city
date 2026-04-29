const mongoose = require('mongoose');
const { getIo } = require('../utils/socket');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['warning', 'danger', 'info', 'critical', 'prediction']
  },
  module: {
    type: String,
    required: true,
    enum: ['traffic', 'waste', 'water', 'lighting', 'emergency', 'system', 'iot']
  },
  title: {
    type: String,
    required: [true, 'Alert title is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Alert message is required'],
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  zone: {
    type: String,
    enum: ['north', 'south', 'east', 'west', 'central', 'all'],
    default: 'all'
  },
  read: {
    type: Boolean,
    default: false
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  timestamps: true
});

alertSchema.index({ read: 1, priority: -1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ module: 1 });
alertSchema.index({ zone: 1 });

alertSchema.post('save', function (doc) {
  try {
    const io = getIo();
    if (!io) return;

    const payload = {
      alert: doc,
      timestamp: new Date().toISOString(),
    };

    io.to('role:admin').emit('notification:new', payload);
    io.to('role:operator').emit('notification:new', payload);

    if (doc.zone && doc.zone !== 'all') {
      io.to(`zone:${doc.zone}`).emit('notification:zone', payload);
    }
  } catch (error) {
    console.error('Alert realtime emit error:', error.message);
  }
});

module.exports = mongoose.model('Alert', alertSchema);
