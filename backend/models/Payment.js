const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['free', 'upi', 'card', 'wallet', 'netbanking'],
    default: 'free'
  },
  transactionId: {
    type: String,
    default: null,
    trim: true
  },
  refundId: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

paymentSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
