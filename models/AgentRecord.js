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

function normalizePhoneVal(p) {
  if (!p) return '';
  let s = String(p).replace(/[^0-9]/g, '');
  if (s.startsWith('880')) s = s.slice(3);
  else if (s.startsWith('88')) s = s.slice(2);
  if (s.length === 10 && s.startsWith('1')) s = '0' + s;
  if (!s.startsWith('0') && s.length === 11) s = '0' + s.slice(s.length - 10);
  return s;
}

agentRecordSchema.pre('save', function(next) {
  if (!this.firstSeenAt) this.firstSeenAt = new Date();
  this.lastSeenAt = new Date();
  // Ensure phone is trimmed and normalized
  if (this.phone) {
    this.phone = String(this.phone).trim();
    try {
      this.normalizedPhone = normalizePhoneVal(this.phone);
    } catch (e) {
      this.normalizedPhone = String(this.phone).replace(/[^0-9]/g, '');
    }
  }
  next();
});

const AgentRecord = mongoose.model('AgentRecord', agentRecordSchema);
module.exports = AgentRecord;
