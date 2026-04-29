const mongoose = require('mongoose');

const trafficDataSchema = new mongoose.Schema({
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
  congestionLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  vehicleCount: {
    type: Number,
    default: 0,
    min: 0
  },
  averageSpeed: {
    type: Number,
    default: 40,
    min: 0
  },
  signalStatus: {
    type: String,
    enum: ['green', 'yellow', 'red', 'flashing'],
    default: 'green'
  },
  incidentReported: {
    type: Boolean,
    default: false
  },
  incidentType: {
    type: String,
    enum: ['accident', 'roadwork', 'breakdown', 'none'],
    default: 'none'
  },
  emergencyOverride: {
    type: Boolean,
    default: false
  },
  predictedCongestion: {
    type: String,
    enum: ['low', 'medium', 'high', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

trafficDataSchema.index({ createdAt: -1 });
trafficDataSchema.index({ zone: 1, congestionLevel: 1 });
trafficDataSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

module.exports = mongoose.model('TrafficData', trafficDataSchema);
