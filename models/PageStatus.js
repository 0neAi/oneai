const mongoose = require('mongoose');

const pageStatusSchema = new mongoose.Schema({
  pageName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['new-listed', 'issueless-pending', 'issueless', 'issue-prone'],
    default: 'new-listed',
    required: true
  }
}, { timestamps: true });

const PageStatus = mongoose.model('PageStatus', pageStatusSchema);

module.exports = PageStatus;
