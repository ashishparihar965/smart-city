const mongoose = require('mongoose');

const parkingLocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Parking name is required'],
    trim: true,
    maxlength: 200
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: 500
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: -180,
    max: 180
  },
  allowedVehicles: {
    type: [String],
    enum: ['bike', 'car', 'truck'],
    default: ['bike', 'car']
  },
  totalSlots: {
    bike: { type: Number, default: 0, min: 0 },
    car: { type: Number, default: 0, min: 0 },
    truck: { type: Number, default: 0, min: 0 }
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  pricePerHour: {
    bike: { type: Number, default: 0, min: 0 },
    car: { type: Number, default: 0, min: 0 },
    truck: { type: Number, default: 0, min: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  operatingHours: {
    open: { type: String, default: '00:00' },
    close: { type: String, default: '23:59' }
  },
  contactPhone: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

parkingLocationSchema.index({ latitude: 1, longitude: 1 });
parkingLocationSchema.index({ isActive: 1 });
parkingLocationSchema.index({ name: 'text', address: 'text' });

module.exports = mongoose.model('ParkingLocation', parkingLocationSchema);
