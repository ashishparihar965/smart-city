const mongoose = require('mongoose');

const remarkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedByName: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved'],
    required: true
  },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedByName: { type: String, default: 'System' },
  changedAt: { type: Date, default: Date.now },
  remark: { type: String, default: '' }
}, { _id: true });

const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Complaint title is required'],
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: 10
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['traffic', 'water', 'waste', 'lighting', 'emergency']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved'],
    default: 'open'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  imageUrl: {
    type: String,
    default: null
  },
  zone: {
    type: String,
    enum: ['north', 'south', 'east', 'west', 'central'],
    default: 'central'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  remarks: [remarkSchema],
  statusHistory: [statusHistorySchema],
  deadline: {
    type: Date,
    default: null
  },
  isOverdue: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolutionTimeMinutes: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Auto-detect priority for emergency categories
complaintSchema.pre('save', function(next) {
  if (this.isNew && this.category === 'emergency') {
    this.priority = 'high';
  }

  // Auto-detect priority from keywords
  if (this.isNew) {
    const text = `${this.title} ${this.description}`.toLowerCase();
    const criticalWords = ['fire', 'blood', 'explode', 'accident', 'dead', 'pipe burst', 'robbery', 'collapse', 'flood'];
    if (criticalWords.some(w => text.includes(w))) {
      this.priority = 'high';
    }
  }

  // If no deadline set, assign default SLA deadlines
  if (this.isNew && !this.deadline) {
    const now = new Date();
    if (this.priority === 'high') {
      this.deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
    } else if (this.priority === 'medium') {
      this.deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
    } else {
      this.deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  }

  // Record initial status in history
  if (this.isNew) {
    this.statusHistory = [{
      status: 'open',
      changedByName: 'System',
      remark: 'Complaint filed'
    }];
  }

  // Check overdue
  if (this.deadline && this.status !== 'resolved' && new Date() > this.deadline) {
    this.isOverdue = true;
  }
  // Capture resolution time
  if (this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
    this.resolutionTimeMinutes = Math.round((this.resolvedAt - this.createdAt) / 60000);
  }
  next();
});

complaintSchema.index({ status: 1, priority: -1 });
complaintSchema.index({ createdBy: 1 });
complaintSchema.index({ assignedTo: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ isOverdue: 1 });
complaintSchema.index({ zone: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
