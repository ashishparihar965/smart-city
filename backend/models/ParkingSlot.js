const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema({
  parkingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingLocation',
    required: true,
    index: true
  },
  vehicleType: {
    type: String,
    enum: ['bike', 'car', 'truck'],
    required: true
  },
  slotNumber: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied'],
    default: 'available'
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  currentBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  }
}, {
  timestamps: true
});

// Compound unique: one slot number per parking location
parkingSlotSchema.index({ parkingId: 1, slotNumber: 1 }, { unique: true });
// Fast queries for availability
parkingSlotSchema.index({ parkingId: 1, vehicleType: 1, status: 1 });
// Lock expiry queries
parkingSlotSchema.index({ status: 1, lockedUntil: 1 });

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema);
