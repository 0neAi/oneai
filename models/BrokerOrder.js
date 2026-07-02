const mongoose = require('mongoose');

const brokerOrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  orderId: { type: String, required: true, unique: true },
  merchantName: { type: String, default: '' },
  consignmentId: { type: String, default: '' },
  productDescription: { type: String, default: '' },
  price: { type: Number, default: 0 },
  deliveryInstruction: { type: String, default: '' },
  recipientName: { type: String, default: '' },
  recipientPhone: { type: String, default: '' },
  recipientAddress: { type: String, default: '' },
  merchantPhone: { type: String, default: '' },
  failedReason: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  agentName: { type: String, default: 'Pathao Agent' },
  agentDisplayName: { type: String, default: 'Pathao Agent' },
  agentAssigned: { type: String, default: '' },
  assigned: { type: Boolean, default: false },
  paymentLink: { type: String, default: '' },
  trackingEnabled: { type: Boolean, default: false },
  fetchedAt: { type: Date },
  lastStatusCheck: { type: Date },
  lastStatusUpdate: { type: Date },
  status: {
    type: String,
    enum: ['PENDING', 'PICKUP', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED', 'HOLD'],
    default: 'PENDING'
  },
  holdCount: { type: Number, default: 0 },
  holdReason: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  holdCreditDeductedAt: { type: Date },
  lastCreditDeductionAt: { type: Date },
  creditsUsed: { type: Number, default: 1 },
  statusHistory: [{
    status: String,
    note: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

brokerOrderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const BrokerOrder = mongoose.model('BrokerOrder', brokerOrderSchema);
module.exports = BrokerOrder;
