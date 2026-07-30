const mongoose = require('mongoose');

const agentCredentialSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  encryptedPassword: { type: String, required: true },
  encryptedClientSecret: { type: String, default: '' },
  clientId: { type: String, default: '1' },
  source: { type: String, default: 'admin' },
  lastValidAt: { type: Date },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

agentCredentialSchema.index({ username: 1 }, { unique: true });

const AgentCredential = mongoose.model('AgentCredential', agentCredentialSchema);
module.exports = AgentCredential;
