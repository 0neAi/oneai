const mongoose = require('mongoose');

const agentRecordSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, required: true },
  normalizedPhone: { type: String, trim: true, required: true, unique: true },
  source: { type: String, trim: true, default: 'tracking' },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  seenCount: { type: Number, default: 1 },
  rawText: { type: String, default: '' }
}, {
  timestamps: true
});

agentRecordSchema.index({ normalizedPhone: 1 }, { unique: true });

agentRecordSchema.pre('save', function(next) {
  if (!this.firstSeenAt) this.firstSeenAt = new Date();
  this.lastSeenAt = new Date();
  next();
});

const AgentRecord = mongoose.model('AgentRecord', agentRecordSchema);
module.exports = AgentRecord;
