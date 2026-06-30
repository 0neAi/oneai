const mongoose = require('mongoose');

const trxRechargeRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  userTrxId: {
    type: String, // The TRX ID provided by the user for their recharge
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  adminNotes: {
    type: String,
  },
}, { timestamps: true });

const TrxRechargeRequest = mongoose.model('TrxRechargeRequest', trxRechargeRequestSchema);

module.exports = TrxRechargeRequest;
