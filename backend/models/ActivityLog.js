const mongoose = require('mongoose')

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    module: {
      type: String,
      required: true,
      enum: [
        'traffic',
        'waste',
        'water',
        'lighting',
        'emergency',
        'auth',
        'system',
        'dashboard',
        'complaints',
        'iot',
        'announcements',
        'analytics',
        'admin',
        'parking',
      ],
    },
    details: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

activityLogSchema.index({ createdAt: -1 })
activityLogSchema.index({ module: 1 })
activityLogSchema.index({ userId: 1 })

module.exports = mongoose.model('ActivityLog', activityLogSchema)
