const mongoose = require('mongoose');

const fexiloadRequestSchema = new mongoose.Schema({
  gpNumber: {
    type: String,
    required: true,
    validate: {
      validator: v => /^01[7-9]\d{8}$/.test(v),
      message: props => `${props.value} is not a valid GP/Skitto number!`
    }
  },
  rechargeAmount: {
    type: String, // Can be amount (e.g., "100 BDT") or offer (e.g., "1GB 30 Days")
    required: true
  },
  transactionNumber: {
    type: String,
    required: true,
    unique: true,
    minlength: 8
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  retailCharge: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['Bkash', 'Nagad'], // Assuming these are the only payment methods for flexiload
    required: true
  }
}, { timestamps: true });

const FexiloadRequest = mongoose.model('FexiloadRequest', fexiloadRequestSchema);

module.exports = FexiloadRequest;
