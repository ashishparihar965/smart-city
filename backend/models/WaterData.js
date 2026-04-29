const mongoose = require('mongoose');

const waterDataSchema = new mongoose.Schema({
  area: {
    type: String,
    required: [true, 'Area is required'],
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
  usage: {
    type: Number,
    default: 0,
    min: 0
  },
  usageUnit: {
    type: String,
    default: 'liters'
  },
  pressure: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  leakDetected: {
    type: Boolean,
    default: false
  },
  leakSeverity: {
    type: String,
    enum: ['none', 'minor', 'major', 'critical'],
    default: 'none'
  },
  threshold: {
    type: Number,
    default: 5000
  },
  dailyAverage: {
    type: Number,
    default: 0
  },
  weeklyAverage: {
    type: Number,
    default: 0
  },
  qualityIndex: {
    type: Number,
    default: 95,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Auto-detect leak based on threshold
waterDataSchema.pre('save', function(next) {
  if (this.usage > this.threshold) {
    this.leakDetected = true;
    const overagePercent = ((this.usage - this.threshold) / this.threshold) * 100;
    if (overagePercent > 50) this.leakSeverity = 'critical';
    else if (overagePercent > 25) this.leakSeverity = 'major';
    else this.leakSeverity = 'minor';
  } else {
    this.leakDetected = false;
    this.leakSeverity = 'none';
  }
  next();
});

waterDataSchema.index({ zone: 1, leakDetected: 1 });
waterDataSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

module.exports = mongoose.model('WaterData', waterDataSchema);
