import mongoose from 'mongoose';

const premiumServiceSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  serviceType: {
    type: String,
    required: true,
    enum: ['password_cracker', 'location_tracker', 'nid_call_list', 'android_remote']
  },
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
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  }
}, { timestamps: true });

export default mongoose.model('PremiumService', premiumServiceSchema);
