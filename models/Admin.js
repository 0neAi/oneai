import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
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
}, {
  timestamps: true
});

// Pre-save hook to hash password
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to check if registration is allowed
adminSchema.statics.canRegister = async function() {
  const count = await this.countDocuments();
  return count === 0;
};

// Method to compare passwords
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get safe version of admin (without password)
adminSchema.methods.toSafeObject = function() {
  const admin = this.toObject();
  delete admin.password;
  return admin;
};

// Static method for registration
adminSchema.statics.register = async function(email, password) {
  // Check if registration is allowed
  if (!await this.canRegister()) {
    throw new Error('Admin registration is closed');
  }

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if email already exists
  const existingAdmin = await this.findOne({ email: normalizedEmail });
  if (existingAdmin) {
    throw new Error('Email already exists');
  }

  // Create new admin
  const admin = new this({
    email: normalizedEmail,
    password
  });

  // Save admin to database
  await admin.save();
  return admin.toSafeObject();
};

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
