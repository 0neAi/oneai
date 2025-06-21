require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const { adminAuth } = require('./middleware/auth');
const Payment = require('./models/Payment');
const User = require('./models/User');
const Admin = require('./models/Admin');

const app = express();
const PORT = process.env.PORT || 10000;

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
  origin: process.env.NODE_ENV === 'production'
    ? ['https://0neai.github.io', 'https://oneai-wjox.onrender.com']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true
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
// WebSocket Configuration
// ======================
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = [
      'https://0neai.github.io',
      'https://oneai-wjox.onrender.com'
    ];
    if (!req.headers.origin || !allowedOrigins.includes(req.headers.origin)) {
      console.log(`Blocked WebSocket connection from unauthorized origin: ${req.headers.origin}`);
      return ws.close(1008, 'Unauthorized origin');
    }
  }

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'adminStatusUpdate') {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
        
        if (!['superadmin', 'moderator'].includes(decoded.role)) {
          throw new Error('Insufficient privileges');
        }

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'statusUpdate',
              payment: data.payment
            }));
          }
        });
      }
    } catch (error) {
      console.error('WebSocket error:', error.message);
      ws.close(1008, 'Authentication failed');
    }
  });
});

app.set('wss', wss);

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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ======================
// Authentication Middleware
// ======================
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
// In your login route
const isAdmin = await Admin.exists({ email: user.email });
res.json({
    success: true,
    token,
    userID: user._id,
    expiresIn: Date.now() + 3600000,
    isAdmin
});
// In your server.js login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { 
      expiresIn: '1h' 
    });

    res.json({
      success: true,
      token,
      userID: user._id,
      expiresIn: Date.now() + 3600000,
      // No redirect URLs should be sent from server
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
    const { consignments, discount = 0 } = req.body;

    // Validate consignments
    if (!Array.isArray(consignments) || consignments.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one consignment required' 
      });
    }

    // Validate each consignment
    let amount3 = 0;
    const validServiceTypes = ['pricecng', 'partial', 'drto', 'delivery', 'return'];
    const phoneRegex = /^01[3-9]\d{8}$/;
    
    for (const consignment of consignments) {
      // Validate service type
      if (!validServiceTypes.includes(consignment.serviceType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid service type: ${consignment.serviceType}`
        });
      }

      // Validate customer details
      if (!consignment.name || !phoneRegex.test(consignment.phone)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer details'
        });
      }

      // Service-specific validation
      if (consignment.serviceType === 'pricecng' || consignment.serviceType === 'partial') {
        if (consignment.amount2 >= consignment.amount1) {
          return res.status(400).json({
            success: false,
            message: 'Updated amount must be less than original amount'
          });
        }
        amount3 += (consignment.amount1 - consignment.amount2) / 2;
      } 
      else if (consignment.serviceType === 'drto' && consignment.amount2 < 40) {
        amount3 += 40;
      }
    }

    // Apply discount
    if (discount > 0) {
      amount3 *= (1 - discount / 100);
    }

    // Validate final amount
    if (amount3 < 0 || amount3 > 30000) {
      return res.status(400).json({
        success: false,
        message: 'Final amount must be between 0 and 30,000'
      });
    }

    // Create payment
    const payment = new Payment({
      user: req.user._id,
      ...req.body,
      amount3,
      status: 'Pending'
    });

    const savedPayment = await payment.save();

    // WebSocket notification
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'new-payment',
          payment: {
            _id: savedPayment._id,
            status: savedPayment.status,
            trxid: savedPayment.trxid,
            amount3: savedPayment.amount3,
            user: {
              _id: req.user._id,
              email: req.user.email,
              phone: req.user.phone
            },
            company: savedPayment.company,
            createdAt: savedPayment.createdAt
          }
        }));
      }
    });

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      payment: savedPayment
    });
    // In payment processing route
wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
            type: 'payment-updated',
            payment: {
                _id: savedPayment._id,
                status: savedPayment.status,
                trxid: savedPayment.trxid,
                amount3: savedPayment.amount3,
                user: {
                    _id: req.user._id,
                    email: req.user.email,
                    phone: req.user.phone
                },
                company: savedPayment.company,
                createdAt: savedPayment.createdAt,
                formattedDate: savedPayment.formattedDate // Add formatted date
            }
        }));
    }
});

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment processing failed'
    });
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

app.post('/admin/update-status', adminAuth, async (req, res) => {
  try {
    const { trxid, status } = req.body;
    
    if (!['Pending', 'Completed', 'Failed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const payment = await Payment.findOneAndUpdate(
      { trxid },
      { status },
      { new: true }
    ).populate('user', 'email phone');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Broadcast update via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'statusUpdate',
          payment: {
            trxid: payment.trxid,
            status: payment.status,
            amount: payment.amount3,
            timestamp: payment.updatedAt
          }
        }));
      }
    });

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, message: 'Status update failed' });
  }
});
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { adminId: admin._id, role: admin.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      admin: admin.toSafeObject()
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error during admin login' 
    });
  }
});
// Add this route after the admin routes
app.get('/payments/user', authMiddleware, async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user._id })
            .sort({ createdAt: -1 });
            
        res.json({ 
            success: true, 
            payments 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch user payments' 
        });
    }
});
// Add premium payment route
app.post('/premium-payment', authMiddleware, async (req, res) => {
    try {
        const { phone, trxid, amount, service, type } = req.body;
        
        if (!phone || !trxid || !amount || !service || !type) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields required' 
            });
        }

        const payment = new Payment({
            user: req.user._id,
            company: 'premium_service',
            phone,
            password: 'premium_access',
            method: 'Premium',
            trxid,
            consignments: [{
                name: 'Premium Service',
                phone,
                amount1: amount,
                amount2: 0,
                serviceType: service
            }],
            amount3: amount,
            status: 'Pending',
            serviceType: type
        });

        const savedPayment = await payment.save();

        // WebSocket notification
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'new-payment',
                    payment: {
                        _id: savedPayment._id,
                        status: savedPayment.status,
                        trxid: savedPayment.trxid,
                        amount3: savedPayment.amount3,
                        user: {
                            _id: req.user._id,
                            email: req.user.email,
                            phone: req.user.phone
                        },
                        company: savedPayment.company,
                        createdAt: savedPayment.createdAt
                    }
                }));
            }
        });

        res.status(201).json({
            success: true,
            message: 'Premium payment submitted for verification',
            payment: savedPayment
        });

    } catch (error) {
        console.error('Premium payment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Premium payment processing failed'
        });
    }
});
// Mount other admin routes
app.use('/admin/payments', adminAuth, require('./assets/js/paymentRoute'));

app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/validate', authMiddleware, async (req, res) => {
    try {
        const isAdmin = await Admin.exists({ _id: req.user._id });
        res.json({ 
            success: true,
            isAdmin: !!isAdmin
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Validation failed' });
    }
});
// ======================
// Add this before the error handler in server.js
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

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

export default app;
