const mongoose = require('mongoose');

const lightingDataSchema = new mongoose.Schema({
  lightId: {
    type: String,
    required: [true, 'Light ID is required'],
    unique: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
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
  status: {
    type: String,
    enum: ['on', 'off'],
    default: 'off'
  },
  autoMode: {
    type: Boolean,
    default: true
  },
  faultDetected: {
    type: Boolean,
    default: false
  },
  faultType: {
    type: String,
    enum: ['none', 'flickering', 'burnt-out', 'power-issue', 'sensor-fault'],
    default: 'none'
  },
  energyUsage: {
    type: Number,
    default: 0,
    min: 0
  },
  energyUnit: {
    type: String,
    default: 'kWh'
  },
  brightness: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  lastMaintenanceDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

lightingDataSchema.index({ zone: 1, status: 1 });
lightingDataSchema.index({ faultDetected: 1 });
lightingDataSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

module.exports = mongoose.model('LightingData', lightingDataSchema);
