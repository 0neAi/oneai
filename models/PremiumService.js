import mongoose from 'mongoose';

const premiumServiceSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    validate: {
      validator: v => /^01[3-9]\d{8}$/.test(v),
      message: props => `Invalid Bangladeshi phone number: ${props.value}`
    }
  },
  trxid: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  serviceType: {
    type: String,
    required: true,
    enum: ['top10', 'top25', 'full_db']
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  }
}, { timestamps: true });

export default mongoose.model('PremiumService', premiumServiceSchema);
