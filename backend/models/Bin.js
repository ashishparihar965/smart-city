const mongoose = require('mongoose');

const binSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Bin name is required'],
    trim: true
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required']
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required']
  },
  fill_level: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['low', 'medium', 'full'],
    default: 'low'
  },
  needs_collection: {
    type: Boolean,
    default: false
  },
  capacity: {
    type: Number,
    default: null
  },
  last_collected_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Auto-compute status from fill_level
binSchema.pre('save', function (next) {
  if (this.fill_level <= 50) this.status = 'low';
  else if (this.fill_level <= 80) this.status = 'medium';
  else this.status = 'full';

  // Auto-flag for collection when full
  if (this.fill_level > 80) this.needs_collection = true;

  next();
});

binSchema.index({ status: 1 });
binSchema.index({ fill_level: -1 });
binSchema.index({ latitude: 1, longitude: 1 });

module.exports = mongoose.model('Bin', binSchema);
