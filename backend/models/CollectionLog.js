const mongoose = require('mongoose');

const collectionLogSchema = new mongoose.Schema({
  bin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: true
  },
  collected_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collected_at: {
    type: Date,
    default: Date.now
  }
});

collectionLogSchema.index({ bin_id: 1 });
collectionLogSchema.index({ collected_by: 1 });
collectionLogSchema.index({ collected_at: -1 });

module.exports = mongoose.model('CollectionLog', collectionLogSchema);
