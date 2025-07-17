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
    enum: ['15day_15merchant', '1month_30merchant', '3month_full_db', 'lifetime_full_db']
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  validUntil: {
    type: Date,
    required: false // Not required for lifetime access
  }
}, { timestamps: true });

export default mongoose.model('PremiumService', premiumServiceSchema);
