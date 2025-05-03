const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
    required: true,
    minlength: 12
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

        // Static method to check if registration is allowed
adminSchema.statics.canRegister = async function() {
  const count = await this.countDocuments();
  return count <= 2; // Only allow registration if no admins exist
};

// Pre-save hook to hash password
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
  if (!await this.canRegister()) {
    throw new Error('Admin registration is closed');
  }

  const admin = new this({
    email,
    password
  });

  await admin.save();
  return admin.toSafeObject();
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
