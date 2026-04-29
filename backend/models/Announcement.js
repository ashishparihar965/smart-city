const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    minlength: 5,
    maxlength: 150
  },
  message: {
    type: String,
    required: [true, 'Announcement message is required'],
    trim: true,
    minlength: 10
  },
  type: {
    type: String,
    enum: ['traffic', 'water', 'waste', 'lighting', 'emergency', 'general', 'maintenance'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  zones: {
    type: [String],
    enum: ['north', 'south', 'east', 'west', 'central', 'all'],
    default: ['all']
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'scheduled'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledFor: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  viewCount: {
    type: Number,
    default: 0
  },
  views: [{
    userId: mongoose.Schema.Types.ObjectId,
    viewedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

announcementSchema.index({ status: 1, type: 1 });
announcementSchema.index({ zones: 1 });
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ expiresAt: 1 });
announcementSchema.index({ priority: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
