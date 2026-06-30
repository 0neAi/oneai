const mongoose = require('mongoose');

const penaltyReportSchema = new mongoose.Schema({
  // Name of the merchant against whom the penalty is reported
  merchantName: {
    type: String,
    required: true,
    trim: true
  },
  // Name of the customer who reported the penalty
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  // Phone number of the customer who reported the penalty
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  // Date when the penalty occurred or was reported
  penaltyDate: {
    type: Date,
    required: true
  },
  // Original amount related to the penalty (e.g., original transaction amount)
  amount1: {
    type: Number,
    required: true,
    min: 0
  },
  // Adjusted or final amount after the penalty (e.g., refunded amount)
  amount2: {
    type: Number,
    required: true,
    min: 0
  },
  // Detailed description of the penalty
  penaltyDetails: {
    type: String,
    required: true,
    trim: true
  },
  // Current status of the penalty report
  status: {
    type: String,
    enum: ['pending', 'processed', 'rejected'],
    default: 'pending',
    trim: true
  },
  // Optional: Voucher code generated if the penalty is processed with compensation
  voucherCode: {
    type: String,
    trim: true
  },
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

module.exports = mongoose.model('PenaltyReport', penaltyReportSchema);