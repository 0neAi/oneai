const mongoose = require('mongoose');

const consignmentSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true,
    validate: {
      validator: v => /^01[3-9]\d{8}$/.test(v), // Updated regex
      message: props => `Invalid Bangladeshi phone number: ${props.value}`
    }
  },
  amount1: { 
    type: Number, 
    required: true,
    min: [100, 'Minimum 100 BDT'],
    max: [100000, 'Maximum 100,000 BDT']
  },
  amount2: { 
    type: Number, 
    required: true,
    min: [100, 'Minimum 100 BDT'],
    max: [100000, 'Maximum 100,000 BDT']
  }
});

const paymentSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  company: { 
    type: String, 
    required: true,
    enum: ['govt_nid', 'redx', 'pathao', 'steadfast']
  },
  phone: {
    type: String,
    required: true,
    validate: {
      validator: v => /^01[3-9]\d{8}$/.test(v), // Properly formatted regex
      message: props => `Invalid Bangladeshi phone number: ${props.value}`
    }
  },
  password: { 
    type: String, 
    required: true 
    minlength: [8, 'Password must be at least 8 characters']
  },
    serviceType: {
    type: String,
    required: true,
    enum: ['pricecng', 'partial', 'nid']
  },
  consignments: [consignmentSchema],
  method: { 
    type: String, 
    required: true,
    enum: ['Nagad']
  },
  amount3: { 
    type: Number, 
    required: true,
    min: [100, 'Minimum 100 BDT'],
    max: [30000, 'Maximum 50,000 BDT']
    
  },
  trxid: { 
    type: String, 
    required: true,
    unique: true,
    minlength: 8
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Add index for better query performance
paymentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
