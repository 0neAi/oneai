const mongoose = require('mongoose');

const brokerCreditTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['purchase', 'usage', 'refund', 'bonus'],
    required: true
  },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true },
  description: { type: String, default: '' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BrokerOrder' },
  transactionHash: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const BrokerCreditTransaction = mongoose.model('BrokerCreditTransaction', brokerCreditTransactionSchema);
module.exports = BrokerCreditTransaction;
