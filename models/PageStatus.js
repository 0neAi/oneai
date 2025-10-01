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
    enum: ['new-listed', 'issueless-pending', 'issueless', 'issue-rising'],
    default: 'new-listed',
    required: true
  },
  issueCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const PageStatus = mongoose.model('PageStatus', pageStatusSchema);

module.exports = PageStatus;
