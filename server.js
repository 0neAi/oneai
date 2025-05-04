require('dotenv').config();
const paymentRoute = require('./assets/js/paymentRoute');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const Payment = require('./models/Payment');
const User = require('./models/User');
const Admin = require('./models/Admin');

const app = express();
const server = require('http').createServer(app);
const PORT = process.env.PORT || 10000;
const jwtSecret = process.env.JWT_SECRET || 'default_secret_use_env_var_in_prod';

// ======================
// WebSocket Configuration
// ======================
const wss = new WebSocket.Server({ server });
app.set('wss', wss);

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
  if (typeof message !== 'string') return;
    try {
      const paymentData = JSON.parse(message);
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'payment-updated',
            payment: paymentData
          }));
        }
      });
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });
});

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? [
    'https://0neai.github.io',
    'https://oneai-wjox.onrender.com'
  ] : [
    'http://localhost:3000',
    'https://oneai-wjox.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-User-ID',
    'X-Request-Source'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['Authorization']
}));

app.use(express.json({ limit: '10kb' }));

// ======================
// Rate Limiting
// ======================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { trustProxy: true },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress
});
app.use(limiter);

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
// Request Logging
// ======================
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode}`);
  });
  next();
});

// ======================
// Authentication Middlewares
// ======================
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error("No token provided");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.exp * 1000 < Date.now()) {
      throw new Error("Token expired");
    }
    const admin = await Admin.findById(decoded.adminId);
    
    if (!admin) throw new Error("Admin not found");
    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Admin authorization failed' });
  }
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const userID = req.header('X-User-ID');

    if (!token || !userID) throw new Error("Missing credentials");
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.userId !== userID) throw new Error("ID mismatch");

    const user = await User.findById(userID);
    if (!user) throw new Error("User not found");
    
    req.user = user;
    next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError' 
      ? 'Session expired' 
      : 'Invalid authentication';
    res.status(401).json({ success: false, message });
  }
};

// ======================
// Core Routes
// ======================
app.options('*', cors());

app.get('/', (req, res) => res.status(200).json({ 
  success: true, 
  message: 'Server operational',
  version: '1.0.0'
}));

app.get('/status', (req, res) => res.json({
  status: 'live',
  db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  uptime: process.uptime().toFixed(2) + 's'
}));

// ======================
// User Authentication Routes
// ======================
app.post('/register', async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    
    if (!phone || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const user = new User({
      phone,
      email,
      password: await bcrypt.hash(password, 12)
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userID: user._id,
      token,
      expiresIn: Date.now() + 3600000
    });

  } catch (error) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Registration failed'
      : error.message;
    res.status(500).json({ success: false, message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      success: true,
      token,
      userID: user._id,
      expiresIn: Date.now() + 3600000,
      user: { phone: user.phone, email: user.email }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// ======================
// Payment Processing
// ======================
app.post('/payment', authMiddleware, async (req, res) => {
  try {
    if (!Array.isArray(req.body.consignments) || req.body.consignments.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid consignments data' });
    }

    const discount = req.body.discount || 0;
    if (discount < 0 || discount > 40) {
      return res.status(400).json({ success: false, message: 'Invalid discount value' });
    }

    const originalAmount = req.body.consignments.reduce((acc, curr) => 
      acc + (curr.amount1 - curr.amount2) / 2, 0
    );

    const expectedAmount = originalAmount * (1 - (discount / 100));
    if (expectedAmount.toFixed(2) !== req.body.amount3.toFixed(2)) {
      return res.status(400).json({ success: false, message: 'Amount mismatch' });
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
        finalAmount: payment.amount3
      }
    });

  } catch (error) {
    const message = error.code === 11000 
      ? 'Duplicate transaction ID' 
      : 'Payment processing failed';
    res.status(500).json({ success: false, message });
  }
});

// ======================
// Admin Routes
// ======================
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again after 15 minutes'
});

app.get('/admin/check-registration', async (req, res) => {
  try {
    const canRegister = await Admin.canRegister();
    res.json({ success: true, allowRegistration: canRegister });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Registration check failed' });
  }
});

app.post('/admin/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Credentials required' });
    }

    if (!await Admin.canRegister()) {
      return res.status(403).json({ success: false, message: 'Admin registration closed' });
    }

    if (await Admin.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Email exists' });
    }

    const admin = new Admin({ email, password });
    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin created',
      admin: admin.toSafeObject()
    });

  } catch (error) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Registration failed'
      : error.message;
    res.status(500).json({ success: false, message });
  }
});

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

    res.json({ success: true, token, admin: admin.toSafeObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/validate', authMiddleware, (req, res) => {
  res.json({ success: true });
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server & WS running on port ${PORT}`);
  console.log(`🏭 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
  });
});
