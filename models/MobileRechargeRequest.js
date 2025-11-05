const mongoose = require('mongoose');

const mobileRechargeRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  trxAmount: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  transactionId: {
    type: String, // ID from the external mobile recharge API
  },
  operator: {
    type: String, // e.g., 'Grameenphone', 'Robi', 'Airtel'
  },
  adminNotes: {
    type: String,
  },
}, { timestamps: true });

const MobileRechargeRequest = mongoose.model('MobileRechargeRequest', mobileRechargeRequestSchema);

module.exports = MobileRechargeRequest;
