require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Payment = require('./models/Payment');
const User = require('./models/User');
const Admin = require('./models/Admin');

const app = express();
const PORT = process.env.PORT || 10000; // Render-compatible port

// ======================
// Environment Validation
// ======================
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// ======================
// Security Middlewares
// ======================
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: [
    'https://0neai.github.io',
    'https://0neai.github.io/oneai',
    'http://localhost:3000',
    'https://oneai-wjox.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
   allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-User-ID', // Explicitly allow custom headers
    'X-Request-Source'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['Authorization']
}));
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { trustProxy: true }, // Enable proxy validation
  keyGenerator: (req) => {
    // Use the proper IP detection
    return req.ip || req.socket.remoteAddress;
  }
});
app.use(limiter);

// ======================
// Admin Section
// ======================

// Admin rate limiter
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again after 15 minutes'
});

// Check if admin registration is allowed
app.get('/admin/check-registration', async (req, res) => {
  try {
    const canRegister = await Admin.canRegister();
    res.json({ 
      success: true, 
      allowRegistration: canRegister 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error checking registration status' 
    });
  }
});

// Admin registration
app.post('/admin/register', async (req, res) => {
  console.log('Registration attempt:', req.body);
  try {
    const { email, password } = req.body;
    
    // Additional validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
  // Check registration availability
    if (!await Admin.canRegister()) {
      return res.status(403).json({
        success: false,
        message: 'Admin registration is closed'
      });
    }

    // Check for existing email
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create new admin
    const admin = new Admin({ email, password });
    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: admin.toSafeObject()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' 
        ? 'Registration failed' 
        : error.message
    });
  }
});

// Admin login
app.post('/admin/login', adminLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    admin.lastLogin = Date.now();
    await admin.save();

    res.json({ 
      success: true, 
      token,
      admin: admin.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin middleware
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const admin = await Admin.findOne({
      _id: decoded.adminId,
    });

    if (!admin) throw new Error();
    
    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Admin authorization failed' });
  }
};

// Admin routes
app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/admin/payments', adminAuth, async (req, res) => {
  try {
    const payments = await Payment.find().populate('user', 'phone email');
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

app.put('/admin/payments/:id', adminAuth, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
   res.json({ 
            success: true, 
            payment: {
                _id: payment._id,
                status: payment.status,
                amount3: payment.amount3,
                trxid: payment.trxid,
                user: payment.user,
                createdAt: payment.createdAt
            }
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ======================
// Database Connection
// ======================
let isReady = false;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

mongoose.connection.on('connected', () => {
  isReady = true;
  console.log('✅ Server ready to accept requests');
});

mongoose.connection.on('disconnected', () => {
  isReady = false;
  console.log('⚠️  MongoDB disconnected');
});
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err);
  isReady = false;
});
// ======================
// Server Readiness Check
// ======================
app.use((req, res, next) => {
  if (!isReady) {
    return res.status(503).json({
      success: false,
      message: 'Server initializing... Try again in 10 seconds'
    });
  }
  next();
});

// ======================
// Status Endpoint
// ======================
app.get('/status', (req, res) => {
  res.json({
    status: 'live',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime().toFixed(2) + 's'
  });
});

// ======================
// Enhanced Auth Middleware
// ======================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const userID = req.header('X-User-ID');

    if (!token || !userID) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication credentials missing' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.userId !== userID) {
      return res.status(401).json({
        success: false,
        message: 'User ID mismatch'
      });
    }

    const user = await User.findOne({ _id: userID });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Error:', error);
    const message = error.name === 'TokenExpiredError' 
      ? 'Session expired' 
      : 'Invalid authentication';
    res.status(401).json({ success: false, message });
  }
};
// Add this middleware before routes
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode}`);
  });
  next();
});

// ======================
// Application Routes
// ======================

// Add before other routes
app.options('*', cors()); // Handle all OPTIONS requests

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Server operational',
    version: '1.0.0'
  });
});

// Registration Endpoint
app.post('/register', async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    
    if (!phone || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    const user = new User({
      phone,
      email,
      password: await bcrypt.hash(password, 12)
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userID: user._id,
      token,
      expiresIn: Date.now() + 3600000
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message  
    });
  }
});

// Login Endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      token,
      userID: user._id,
      expiresIn: Date.now() + 3600000,
      user: {
        phone: user.phone,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// Validation Endpoint
app.get('/validate', authMiddleware, (req, res) => {
  res.json({ 
    success: true, 
    valid: true, 
    user: req.user 
  });
});

// Payment Processing
app.post('/payment', authMiddleware, async (req, res) => {
  try {
    console.log('Incoming payment:', req.body); // Log incoming data
    const discount = req.body.discount || 0;
    if (discount < 0 || discount > 40) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount value'
      });
    }

    const originalAmount = req.body.consignments.reduce((acc, curr) => {
      return acc + (curr.amount1 - curr.amount2) / 2;
    }, 0);

    const expectedAmount = originalAmount * (1 - (discount / 100));

    if (expectedAmount.toFixed(2) !== req.body.amount3.toFixed(2)) {
      return res.status(400).json({
        success: false,
        message: 'Amount calculation mismatch'
      });
    }

    const payment = new Payment({
      user: req.user._id,
      ...req.body,
      originalAmount,
      discount
    });

    await payment.save();

    res.status(201).json({
      success: true,
      message: 'Payment processed',
      payment: {
        id: payment._id,
        trxid: payment.trxid,
        status: payment.status,
        serviceType: payment.serviceType,
        originalAmount: payment.originalAmount,
        discount: payment.discount,
        finalAmount: payment.amount3
      }
    });

  } catch (error) {
    console.error('Payment Error Details:', {
      error: error.message,
      body: req.body,
      user: req.user?._id
    });
    
    const message = error.code === 11000 
      ? 'Duplicate transaction ID' 
      : 'Payment processing failed';
    
    res.status(500).json({ success: false, message });
  }
});

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error('Global Error:', {
    path: req.path,
    error: err.stack,
    body: req.body
  });
  res.status(err.status || 500).json({ 
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// ======================
// Server Initialization
// ======================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🏭 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
  });
});
