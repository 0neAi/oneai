const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const AppSetting = mongoose.model('AppSetting', appSettingSchema);
module.exports = AppSetting;
