import mongoose from 'mongoose';

const consignmentSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Customer name is required'] 
  },
  phone: { 
    type: String, 
    required: [true, 'Customer phone is required'],
    validate: {
      validator: v => /^01[3-9]\d{8}$/.test(v),
      message: props => `Invalid Bangladeshi phone number: ${props.value}`
    }
  },
  amount1: { 
    type: Number, 
    required: [true, 'Original amount is required'],
    min: [0, 'Amount cannot be negative'],
    max: [100000, 'Amount cannot exceed 100,000 BDT']
  },
  amount2: { 
    type: Number, 
    required: [true, 'Updated amount is required'],
    min: [0, 'Amount cannot be negative'],
    max: [100000, 'Amount cannot exceed 100,000 BDT']
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    enum: {
      values: ['pricecng', 'partial', 'drto', 'delivery', 'return'],
      message: '{VALUE} is not a valid service type'
    }
  }
});

const paymentSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User reference is required'] 
  },
  company: { 
    type: String, 
    required: [true, 'Company is required'],
    enum: {
      values: ['govt_nid', 'redx', 'pathao', 'steadfast', 'premium_service'],
      message: '{VALUE} is not a supported company'
    }
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: v => /^01[3-9]\d{8}$/.test(v),
      message: props => `Invalid Bangladeshi phone number: ${props.value}`
    }
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  consignments: {
    type: [consignmentSchema],
    required: [true, 'At least one consignment is required'],
    validate: {
      validator: v => Array.isArray(v) && v.length > 0,
      message: 'At least one consignment is required'
    }
  },
  method: { 
    type: String, 
    required: [true, 'Payment method is required'],
    enum: {
      values: ['Bkash', 'Nagad'],
      message: '{VALUE} is not a supported payment method'
    }
  },
  amount3: { 
    type: Number, 
    required: [true, 'Total charge is required'],
    min: [0, 'Charge cannot be negative'],
    max: [30000, 'Charge cannot exceed 30,000 BDT']
  },
  trxid: { 
    type: String, 
    required: [true, 'Transaction ID is required'],
    unique: true,
    minlength: [8, 'Transaction ID must be at least 8 characters'],
    index: true
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Completed', 'Failed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'Pending'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true } 
});

// Indexes for better query performance
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ company: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for formatted createdAt date
paymentSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});


const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 
