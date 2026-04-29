const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Incident title is required'],
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['fire', 'accident', 'crime', 'flood', 'gas-leak', 'power-outage', 'other']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  zone: {
    type: String,
    required: true,
    enum: ['north', 'south', 'east', 'west', 'central']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  responseTime: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

incidentSchema.index({ status: 1, priority: -1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ zone: 1 });
incidentSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

module.exports = mongoose.model('Incident', incidentSchema);
