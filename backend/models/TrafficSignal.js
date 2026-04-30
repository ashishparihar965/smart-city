const mongoose = require('mongoose');

const ALL_DIRECTIONS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];

const trafficSignalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Signal name is required'],
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
  directions: {
    type: [String],
    required: true,
    validate: {
      validator: function (arr) {
        return arr.length >= 2 && arr.every(d => ALL_DIRECTIONS.includes(d));
      },
      message: 'At least 2 valid directions required (N, S, E, W, NE, NW, SE, SW)'
    }
  },
  groups: {
    type: [[String]],
    default: [],
    validate: {
      validator: function (groups) {
        // Every direction in a group must be in this signal's directions
        const flat = groups.flat();
        return flat.every(d => this.directions.includes(d));
      },
      message: 'Group directions must be a subset of the signal directions'
    }
  },
  activeGroup: {
    type: Number,
    default: 0,
    min: 0
  },
  signalTime: {
    type: Number,
    default: 25,
    min: 5,
    max: 120
  },
  manualOverride: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-generate default groups if none provided
trafficSignalSchema.pre('save', function (next) {
  if (!this.groups || this.groups.length === 0) {
    this.groups = generateDefaultGroups(this.directions);
  }
  next();
});

/**
 * Generate default opposing-direction groups.
 * E.g. ['N','S','E','W'] → [['N','S'],['E','W']]
 */
function generateDefaultGroups(directions) {
  const pairs = {
    N: 'S', S: 'N',
    E: 'W', W: 'E',
    NE: 'SW', SW: 'NE',
    NW: 'SE', SE: 'NW'
  };

  const used = new Set();
  const groups = [];

  for (const dir of directions) {
    if (used.has(dir)) continue;
    const opposite = pairs[dir];
    if (opposite && directions.includes(opposite) && !used.has(opposite)) {
      groups.push([dir, opposite]);
      used.add(dir);
      used.add(opposite);
    }
  }

  // Any remaining ungrouped directions become their own group
  for (const dir of directions) {
    if (!used.has(dir)) {
      groups.push([dir]);
      used.add(dir);
    }
  }

  return groups;
}

trafficSignalSchema.index({ latitude: 1, longitude: 1 });
trafficSignalSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TrafficSignal', trafficSignalSchema);
