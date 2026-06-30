const mongoose = require('mongoose');
const shortid = require('shortid'); // You might need to install shortid: npm install shortid

const pageSchema = new mongoose.Schema({
  pageName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  shortId: {
    type: String,
    required: true,
    unique: true,
    default: shortid.generate,
  },
  status: {
    type: String,
    enum: ['new-listed', 'issueless-pending', 'issueless', 'issue-rising'],
    default: 'new-listed',
  },
  count: { // Corresponds to PagePriceChangeCount.count
    type: Number,
    default: 0,
  },
  issueCount: { // Corresponds to PageStatus.issueCount
    type: Number,
    default: 0,
  },
  note: { // New field for support page notes
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('Page', pageSchema);
