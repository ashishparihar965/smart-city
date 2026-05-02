const mongoose = require('mongoose');

const trafficSimulationSchema = new mongoose.Schema({
  signalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrafficSignal',
    required: true
  },
  directionCounts: {
    type: Map,
    of: {
      car: { type: Number, default: 0 },
      threewheel: { type: Number, default: 0 },
      bus: { type: Number, default: 0 },
      truck: { type: Number, default: 0 },
      motorbike: { type: Number, default: 0 },
      van: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    default: {}
  },
  // Annotated images (base64) from YOLO detection per direction
  annotatedImages: {
    type: Map,
    of: String,
    default: {}
  },
  totalCount: {
    type: Number,
    default: 0,
    min: 0
  },
  density: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  activeGroup: {
    type: Number,
    default: 0
  },
  signalTime: {
    type: Number,
    default: 25
  },
  groupTotals: {
    type: [Number],
    default: []
  }
}, {
  timestamps: true
});

trafficSimulationSchema.index({ signalId: 1, createdAt: -1 });
trafficSimulationSchema.index({ density: 1 });

module.exports = mongoose.model('TrafficSimulation', trafficSimulationSchema);
