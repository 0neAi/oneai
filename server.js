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

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// Security Middlewares
// ======================
app.use(helmet());
app.use(cors({
  origin: [
    'https://0neai.github.io',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// ======================
// Database Connection
// ======================
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

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
      throw new Error('User ID mismatch');
    }

    const user = await User.findOne({ _id: userID });
    if (!user) {
      return res.status(401).json({ 
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

// ======================
// Routes
// ======================

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Server operational' });
});

// Enhanced Registration
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
      message: 'Server error during registration' 
    });
  }
});

// Enhanced Login
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

// Protected Payment Route with Discount Handling
app.post('/payment', authMiddleware, async (req, res) => {
  try {
    // Validate discount range
    const discount = req.body.discount || 0;
    if (discount < 0 || discount > 20) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount value'
      });
    }

    // Calculate original amount
    const originalAmount = req.body.consignments.reduce((acc, curr) => {
      return acc + (curr.amount1 - curr.amount2) / 2;
    }, 0);

    // Calculate expected amount with discount
    const expectedAmount = originalAmount * (1 - (discount / 100));

    // Validate amount with 2 decimal precision
    if (expectedAmount.toFixed(2) !== req.body.amount3.toFixed(2)) {
      return res.status(400).json({
        success: false,
        message: 'Amount calculation mismatch. Please refresh and try again.'
      });
    }

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      ...req.body,
      originalAmount: originalAmount,
      discount: discount
    });

    await payment.save();

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      payment: {
        id: payment._id,
        trxid: payment.trxid,
        status: payment.status,
        originalAmount: payment.originalAmount,
        discount: payment.discount,
        finalAmount: payment.amount3
      }
    });

  } catch (error) {
    console.error('Payment Error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 11000 
        ? 'Duplicate transaction ID' 
        : 'Payment processing failed'
    });
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  res.status(err.status || 500).json({ 
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Server Initialization
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
  });
});
