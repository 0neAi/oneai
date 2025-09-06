const mongoose = require('mongoose');

const merchantIssueSchema = new mongoose.Schema({
  // Name of the merchant involved in the issue
  merchantName: {
    type: String,
    required: true,
    trim: true
  },
  // Phone number of the merchant involved in the issue
  merchantPhone: {
    type: String,
    required: true,
    trim: true
  },
  // Type of issue (e.g., 'payment_dispute', 'service_complaint')
  issueType: {
    type: String,
    required: true,
    trim: true
  },
  // Detailed description of the issue
  details: {
    type: String,
    required: true,
    trim: true
  },
  // Current status of the issue
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'rejected'],
    default: 'pending',
    trim: true
  },
  // Optional: Voucher code generated if the issue is resolved with compensation
  voucherCode: {
    type: String,
    trim: true
  },
  // Optional: Discount percentage associated with the generated voucher
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

module.exports = mongoose.model('MerchantIssue', merchantIssueSchema);