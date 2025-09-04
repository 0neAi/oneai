const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WebSocketServer, WebSocket } = require('ws');
const { adminAuth } = require('./middleware/auth');
const Payment = require('./models/Payment');
const User = require('./models/User');
const Admin = require('./models/Admin');
const PremiumService = require('./models/PremiumService');
const FexiloadRequest = require('./models/FexiloadRequest');
const LocationTrackerServiceRequest = require('./models/LocationTrackerServiceRequest');
const Voucher = require('./models/Voucher');
const dotenv = require('dotenv');
const http = require('http');
const webpush = require('web-push');
const path = require('path');

// Initialize environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 10000;
const __dirname = path.resolve();

// Security middlewar
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
  origin: ['https://0neai.github.io', 'https://oneai-wjox.onrender.com', 'https://0neai.github.io/oneai'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { trustProxy: true },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress
});
app.use(limiter);

// Database connection
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
  console.log('⚠️  MongoDB disconnected - attempting to reconnect...');
  setTimeout(() => mongoose.connect(process.env.MONGODB_URI), 5000);
});

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err);
  isReady = false;
});

// WebSocket configuration
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

      if (data.type === 'register') {
        ws.userID = data.userID;
      }
      
      if (data.type === 'adminStatusUpdate') {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
        
        if (!['superadmin', 'moderator'].includes(decoded.role)) {
          throw new Error('Insufficient privileges');
        }

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'payment-updated',
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

// Server readiness check
app.use((req, res, next) => {
  if (!isReady) {
    return res.status(503).json({
      success: false,
      message: 'Server initializing... Try again in 10 seconds'
    });
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const userID = req.header('X-User-ID');

    console.log('AuthMiddleware: Received token:', token ? 'Exists' : 'Missing', 'UserID:', userID);

    if (!token) {
      console.error('Auth Error: Missing token');
      return res.status(401).json({ success: false, message: 'Authentication failed: Token missing' });
    }
    if (!userID) {
      console.error('Auth Error: Missing User ID');
      return res.status(401).json({ success: false, message: 'Authentication failed: User ID missing' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('AuthMiddleware: JWT decoded successfully for userId:', decoded.userId);
    } catch (jwtError) {
      console.error('Auth Error: JWT verification failed', jwtError.message);
      const message = jwtError.name === 'TokenExpiredError' 
        ? 'Authentication failed: Session expired. Please log in again.' 
        : 'Authentication failed: Invalid token.';
      return res.status(401).json({ success: false, message });
    }

    if (decoded.userId !== userID) {
      console.error('Auth Error: User ID mismatch', { decodedId: decoded.userId, headerId: userID });
      return res.status(401).json({ success: false, message: 'Authentication failed: User ID mismatch' });
    }

    const user = await User.findById(userID);
    if (!user) {
      console.error('Auth Error: User not found in DB', { userID });
      return res.status(401).json({ success: false, message: 'Authentication failed: User not found' });
    }

    if (!user.isApproved) {
      console.error('Auth Error: User not approved', { userID });
      return res.status(403).json({ success: false, message: 'Authentication failed: User not approved' });
    }
    
    req.user = user;
    console.log('AuthMiddleware: User authenticated and approved:', user.email);
    next();
  } catch (error) {
    console.error('Auth Error: Unexpected error', error.message);
    res.status(500).json({ success: false, message: 'Authentication failed: Internal server error' });
  }
};

// Core routes
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

// User Authentication Routes
app.post('/register', async (req, res) => {
  try {
    const { name, phone, email: rawEmail, zilla, officeLocation, password, referralCode } = req.body;
    const email = rawEmail.toLowerCase().trim();

    if (!name || !phone || !email || !zilla || !officeLocation || !password || !referralCode) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    if (await User.findOne({ phone })) {
      return res.status(409).json({ success: false, message: 'Phone number already exists' });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(400).json({ success: false, message: 'Invalid referral code' });
    }

    const user = new User({
      name,
      phone,
      email,
      zilla,
      officeLocation,
      password,
      referredBy: referrer._id,
      isApproved: !referralCode,
    });

    user.referralCode = `${user.phone.slice(-4)}${Date.now().toString(36).slice(-4)}`;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please wait for admin approval.',
      userID: user._id,
    });

  } catch (error) {
    let message = process.env.NODE_ENV === 'production'
      ? 'Registration failed'
      : error.message;
    res.status(500).json({ success: false, message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid Email' 
      });
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid Password' 
      });
    }

    if (!user.isApproved) {
      return res.status(200).json({
        success: true,
        isApproved: false,
        message: 'Your account is pending admin approval.'
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { 
      expiresIn: '3h' 
    });

    res.json({
      success: true,
      isApproved: true,
      token,
      userID: user._id,
      expiresIn: Date.now() + 3 * 60 * 60 * 1000
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

app.post('/refresh-token', authMiddleware, async (req, res) => {
  try {
    const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: '3h',
    });

    res.json({
      success: true,
      token,
      userID: req.user._id,
      expiresIn: Date.now() + 3 * 60 * 60 * 1000,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh',
    });
  }
});

// Payment Processing
app.post('/payment', authMiddleware, async (req, res) => {
  try {
    const { consignments, discount = 0 } = req.body;

    if (!Array.isArray(consignments) || consignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one consignment required'
      });
    }

    function calculateRawTotalChargeServer(consignments) {
      let rawTotalCharge = 0;
      let freeDeliveryUsed = 0;
      let freeReturnUsed = 0;

      for (const consignment of consignments) {
        const amount1 = parseFloat(consignment.amount1) || 0;
        const amount2 = parseFloat(consignment.amount2) || 0;

        if (consignment.serviceType === 'pricecng') {
          if (amount1 > 0 && amount2 < amount1) {
            rawTotalCharge += (amount1 - amount2) / 2;
          }
        } else if (consignment.serviceType === 'partial') {
          rawTotalCharge += 15;
        } else if (consignment.serviceType === 'drto') {
          if (amount2 > 99) {
            rawTotalCharge += 10;
          } else if (amount2 > 51) {
            rawTotalCharge += 15;
          } else if (amount2 > 1) {
            rawTotalCharge += 25;
          } else if (amount2 === 0) {
            rawTotalCharge += 10;
          }
        } else if (consignment.serviceType === 'delivery') {
          if (freeDeliveryUsed < 3) {
            freeDeliveryUsed++;
          } else {
            rawTotalCharge += Math.floor(Math.random() * (10 - 7 + 1)) + 7;
          }
        } else if (consignment.serviceType === 'return') {
          if (freeReturnUsed < 3) {
            freeReturnUsed++;
          } else {
            rawTotalCharge += Math.floor(Math.random() * (10 - 5 + 1)) + 5;
          }
        }
      }
      return rawTotalCharge;
    }

    let serverCalculatedAmount3 = calculateRawTotalChargeServer(consignments);

    let finalDiscountPercentage = 0;
    const { voucherCode } = req.body;

    if (voucherCode) {
        const voucher = await Voucher.findOne({ code: voucherCode, isUsed: false });
        if (voucher) {
            finalDiscountPercentage = voucher.discountPercentage;
            voucher.isUsed = true;
            await voucher.save();
        } else {
            return res.status(400).json({ success: false, message: 'Invalid or expired voucher' });
        }
    } else if (discount > 0) {
        finalDiscountPercentage = discount;
    }

    if (finalDiscountPercentage > 0) {
        serverCalculatedAmount3 *= (1 - finalDiscountPercentage / 100);
    }

    const clientAmount3 = parseFloat(req.body.amount3);
    const tolerance = 0.01;

    if (Math.abs(serverCalculatedAmount3 - clientAmount3) > tolerance) {
        return res.status(400).json({
            success: false,
            message: 'Calculated amount mismatch. Please refresh and try again.'
        });
    }

    const minAmount = voucherCode ? 0 : 100;
    if (serverCalculatedAmount3 < minAmount) {
      return res.status(400).json({
        success: false,
        message: `Final amount must be at least ${minAmount}`
      });
    }

    const payment = new Payment({
      user: req.user._id,
      ...req.body,
      amount3: serverCalculatedAmount3,
      status: 'Pending'
    });

    const savedPayment = await payment.save();

    const user = await User.findById(req.user._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (user.lastPaymentDate) {
      const lastPaymentDay = new Date(user.lastPaymentDate);
      lastPaymentDay.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today.getTime() - lastPaymentDay.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        user.strikeCount = (user.strikeCount || 0) + 1;
      } else if (diffDays > 1) {
        user.strikeCount = 1;
      }
    } else {
      user.strikeCount = 1;
    }
    user.lastPaymentDate = new Date();

    if (user.strikeCount >= 5) {
      user.hasPendingBonusVoucher = true;
    }
    await user.save();

    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        const paymentCount = await Payment.countDocuments({ user: user._id, status: 'Completed' });

        if (paymentCount === 1) {
          const voucherCode = `REFERRAL-100-${user._id.toString().slice(-4)}`;
          const voucher = new Voucher({
            phone: referrer.phone,
            code: voucherCode,
            discountPercentage: 100,
            report: user._id,
            reportModel: 'User'
          });
          await voucher.save();
        }
      }
    }

    const whatsappMessage = `
New Payment Received!
--------------------
User ID: ${req.user._id}
User Email: ${req.user.email}
User Phone: ${req.user.phone}
Company: ${savedPayment.company}
TRX ID: ${savedPayment.trxid}
Amount: ${savedPayment.amount3} BDT
Payment Method: ${savedPayment.method}
Status: ${savedPayment.status}
Timestamp: ${new Date(savedPayment.createdAt).toLocaleString()}

Consignments:
${savedPayment.consignments.map(c => `  - Service: ${c.serviceType}, Name: ${c.name}, Phone: ${c.phone}, Amount1: ${c.amount1}, Amount2: ${c.amount2}`).join('\n')}
`;

    console.log('Simulating WhatsApp message to helpline:');
    console.log(whatsappMessage);

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

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment processing failed'
    });
  }
});

// Fexiload requests for user
app.get('/fexiload-requests/user', authMiddleware, async (req, res) => {
  try {
    const fexiloadRequests = await FexiloadRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, fexiloadRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user fexiload requests' });
  }
});

// Alias for payments endpoint
app.get('/api/payments/my-payments', authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user payments' });
  }
});

// Location tracker requests for user
app.get('/location-tracker-requests/user', authMiddleware, async (req, res) => {
  try {
    const locationTrackerRequests = await LocationTrackerServiceRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, locationTrackerRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user location tracker requests' });
  }
});

// Error handling middleware
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

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server & WS running on port ${PORT}`);
  console.log(`🏭 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
  });
});

module.exports = app;
