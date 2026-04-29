const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'operator', 'user'],
    default: 'user'
  },
  department: {
    type: String,
    enum: ['traffic', 'waste', 'water', 'lighting', 'emergency', 'general'],
    default: 'general'
  },
  zone: {
    type: String,
    enum: ['north', 'south', 'east', 'west', 'central'],
    default: 'central'
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ zone: 1 });

module.exports = mongoose.model('User', userSchema);
