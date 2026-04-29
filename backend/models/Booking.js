const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parkingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingLocation',
    required: true
  },
  slotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingSlot',
    required: true
  },
  vehicleNumber: {
    type: String,
    required: [true, 'Vehicle number is required'],
    trim: true,
    uppercase: true
  },
  vehicleType: {
    type: String,
    enum: ['bike', 'car', 'truck'],
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 15
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled', 'expired'],
    default: 'pending'
  },
  qrCode: {
    type: String, // base64 QR image data URL
    default: null
  },
  qrPayload: {
    type: String, // HMAC-signed JSON payload
    default: null
  },
  qrExpiresAt: {
    type: Date,
    default: null
  },
  qrUsed: {
    type: Boolean,
    default: false
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  isPaid: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ slotId: 1, status: 1 });
bookingSchema.index({ parkingId: 1, status: 1 });
bookingSchema.index({ status: 1, endTime: 1 }); // for auto-expiry cron
bookingSchema.index({ status: 1, qrExpiresAt: 1 }); // for QR expiry cron

module.exports = mongoose.model('Booking', bookingSchema);
