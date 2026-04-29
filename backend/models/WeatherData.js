const mongoose = require('mongoose');

const weatherDataSchema = new mongoose.Schema({
  esp32_id: {
    type: String,
    required: true,
    trim: true
  },
  zone: {
    type: String,
    required: true,
    trim: true
  },
  temperature: {
    type: Number,
    required: true
  },
  humidity: {
    type: Number,
    required: true
  },
  aqi: {
    type: Number,
    default: 0
  },
  light_level: {
    type: Number,
    default: 0
  },
  is_daytime: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Auto-compute is_daytime from LDR value (>400 = daytime)
weatherDataSchema.pre('save', function (next) {
  this.is_daytime = this.light_level > 400;
  next();
});

// TTL: auto-delete readings older than 7 days
weatherDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
weatherDataSchema.index({ zone: 1, timestamp: -1 });
weatherDataSchema.index({ esp32_id: 1 });

module.exports = mongoose.model('WeatherData', weatherDataSchema);
