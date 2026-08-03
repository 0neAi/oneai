const mongoose = require('mongoose');

const agentCredentialSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  normalizedPhone: { type: String, required: true, trim: true },
  encryptedPassword: { type: String, required: true },
  encryptedClientSecret: { type: String, default: '' },
  clientId: { type: String, default: '1' },
  displayName: { type: String, default: '' },
  source: { type: String, default: 'admin' },
  lastValidAt: { type: Date },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes for fast lookups and uniqueness
agentCredentialSchema.index({ username: 1 }, { unique: true });
agentCredentialSchema.index({ normalizedPhone: 1 });

function normalizePhoneVal(p) {
  if (!p) return '';
  let s = String(p).replace(/[^0-9]/g, '');
  // remove leading country code '880' or '88'
  if (s.startsWith('880')) s = s.slice(3);
  else if (s.startsWith('88')) s = s.slice(2);
  // normalize to leading 0 if plausible (Bangladesh numbers)
  if (s.length === 10 && s.startsWith('1')) s = '0' + s;
  if (!s.startsWith('0') && s.length === 11) s = '0' + s.slice(s.length - 10);
  return s;
}

agentCredentialSchema.pre('save', function(next) {
  if (this.phone) {
    this.phone = String(this.phone).trim();
    this.normalizedPhone = normalizePhoneVal(this.phone);
  }
  if (!this.username) this.username = this.phone || this.normalizedPhone || '';
  next();
});

const AgentCredential = mongoose.model('AgentCredential', agentCredentialSchema);
module.exports = AgentCredential;
