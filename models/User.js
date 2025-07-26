import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    index: true,
    match: [/^01[3-9]\d{8}$/, 'Please use a valid Bangladeshi phone number starting with 013-019']
  },
  email: { 
    type: String, 
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^["\w-\."]+@([\w-"]+\.)+[\w-"]{2,4}$/, 'Invalid email format']
  },
  zilla: {
    type: String,
    required: [true, 'Zilla is required'],
  },
  officeLocation: {
    type: String,
    required: [true, 'Office location is required'],
  },
  password: {
    type: String,
    required: true,
    minlength: [8, 'Password must be at least 8 characters']
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCode: { type: String, unique: true, sparse: true },
  referralCommissionPercentage: { type: Number, default: 0 },
  strikeCount: { type: Number, default: 0 },
  strikeStarsFromPayments: { type: Number, default: 0 }, // Renamed from strikeStars
  normalStars: { type: Number, default: 0, max: 10 },
  lastPaymentDate: { type: Date },
  lastStrikeStarFromPaymentDate: { type: Date }, // New field to track last payment-based strike star
  lastNormalStarCollectionDate: { type: Date }, // New field for daily check-in
  lastNormalStarConversionDate: { type: Date }, // New field for normal star conversion
  hasPendingBonusVoucher: { type: Boolean, default: false },
  pushSubscription: { type: Object },
  isApproved: { type: Boolean, default: false },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Added for populating referred users
  referralBonus: { type: Number, default: 0 },
  referralBonusStatus: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Add password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Add password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
