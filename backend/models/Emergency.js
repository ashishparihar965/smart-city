const mongoose = require('mongoose')

const emergencySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['sos', 'fire', 'medical', 'crime', 'natural-disaster', 'gas-leak', 'other'],
      required: [true, 'Emergency type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    zone: {
      type: String,
      enum: ['north', 'south', 'east', 'west', 'central'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['high', 'critical'],
      default: 'critical',
    },
    status: {
      type: String,
      enum: ['active', 'responding', 'resolved'],
      default: 'active',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    responseTimeMinutes: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
)

emergencySchema.index({ status: 1, priority: -1 })
emergencySchema.index({ createdAt: -1 })
emergencySchema.index({ zone: 1 })
emergencySchema.index({ reportedBy: 1 })

module.exports = mongoose.model('Emergency', emergencySchema)
