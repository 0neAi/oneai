import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format']
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'moderator'],
    default: 'superadmin'
  },
  lastLogin: Date,
  ipWhitelist: [String],
  twoFactorEnabled: {
    type: Boolean,
    default: false
  }
} {
  timestamps: true
});

// Static method to check if registration is allowed
adminSchema.statics.canRegister = async function() {
  return (await this.countDocuments()) === 0;
};
};
// Method to get safe version of admin (without password)
adminSchema.methods.toSafeObject = function() {
  const admin = this.toObject();
  delete admin.password;
  return admin;
};
// Add this to complete the Admin model
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

adminSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

adminSchema.statics.register = async function(email, password) {
  const exists = await this.exists({ email });
  if (exists) throw new Error('Email already exists');
  
  const admin = new this({ email, password });
  return admin.save();
};

adminSchema.statics.canRegister = async function() {
  return (await this.countDocuments()) === 0;
};

export default mongoose.model('Admin', adminSchema);
