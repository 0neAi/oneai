const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^01[3-9]\d{8}$/, 'Please use a valid Bangladeshi phone number starting with 013-019'],
    validate: {
      validator: function(v) {
        return /^01[3-9]\d{8}$/.test(v);
      },
      message: props => `${props.value} is not a valid Bangladeshi phone number!`
    }
  },
  email: { 
    type: String, 
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please use a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    maxlength: [128, 'Password cannot exceed 128 characters'],
    select: false // Prevent accidental exposure in queries
  }
}, {
  timestamps: true // Add createdAt and updatedAt fields
});

module.exports = mongoose.model('User', userSchema);
