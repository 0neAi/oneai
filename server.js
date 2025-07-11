import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { adminAuth } from './middleware/auth.js';
import Payment from './models/Payment.js';
import User from './models/User.js';
import Admin from './models/Admin.js';
import dotenv from 'dotenv';
import http from 'http';
import webpush from 'web-push';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// VAPID keys
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
const PORT = process.env.PORT || 10000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  ? ['https://0neai.github.io', 'https://oneai-wjox.onrender.com', 'https://0neai.github.io/oneai']
  : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));

app.use(express.static(path.join(__dirname, 'public')));

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
  console.log('⚠️  MongoDB disconnected - attempting to reconnect...');
  setTimeout(() => mongoose.connect(process.env.MONGODB_URI), 5000);
});

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err);
  isReady = false;
});

// ======================
// WebSocket Configuration
// ======================
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
      
      if (data.type === 'auth' && data.role === 'admin') {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
        if (!['superadmin', 'moderator'].includes(decoded.role)) {
          throw new Error('Insufficient privileges');
        }
        ws.isAdmin = true;
        console.log('Admin authenticated via WebSocket');
      }
      else if (data.type === 'adminStatusUpdate') {
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
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Error: Unexpected error', error.message);
    res.status(500).json({ success: false, message: 'Authentication failed: Internal server error' });
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
    const { phone, email: rawEmail, password } = req.body;
    const email = rawEmail.toLowerCase().trim();
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }
    
    if (!phone || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (await User.findOne({ phone })) {
      return res.status(409).json({ success: false, message: 'Phone number already exists' });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const user = new User({
      phone,
      email,
      password
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '3h' });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userID: user._id,
      token,
      expiresIn: Date.now() + 3 * 60 * 60 * 1000
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

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { 
      expiresIn: '3h' 
    });

    res.json({
      success: true,
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

// ======================
// Payment Processing
// ======================
app.post('/payment', authMiddleware, async (req, res) => {
  try {
    const { consignments, discount = 0 } = req.body;

    if (!Array.isArray(consignments) || consignments.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one consignment required' 
      });
    }

    let amount3 = 0;
    const validServiceTypes = ['pricecng', 'partial', 'drto', 'delivery', 'return'];
    const phoneRegex = /^01[3-9]\d{8}$/;
    
    for (const consignment of consignments) {
      if (!validServiceTypes.includes(consignment.serviceType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid service type: ${consignment.serviceType}`
        });
      }

      if (!consignment.name || !phoneRegex.test(consignment.phone)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer details'
        });
      }

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

    if (discount > 0) {
      amount3 *= (1 - discount / 100);
    }

    if (amount3 < 0 || amount3 > 30000) {
      return res.status(400).json({
        success: false,
        message: 'Final amount must be between 0 and 30,000'
      });
    }

    const payment = new Payment({
      user: req.user._id,
      ...req.body,
      amount3,
      status: 'Pending'
    });

    const savedPayment = await payment.save();

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
      if (client.readyState === WebSocket.OPEN && client.isAdmin) {
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

// ======================
// Merchant and Penalty Routes
// ======================
const merchantIssueSchema = new mongoose.Schema({
  merchantName: { type: String, required: true },
  merchantPhone: { type: String, required: true },
  issueType: { type: String, required: true },
  details: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in progress', 'resolved', 'rejected'], default: 'pending' },
  adminNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const MerchantIssue = mongoose.model('MerchantIssue', merchantIssueSchema);

const penaltyReportSchema = new mongoose.Schema({
  merchantName: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { 
    type: String, 
    required: true,
    validate: {
      validator: v => /^01[3-9]\d{8}$/.test(v),
      message: props => `Invalid Bangladeshi phone number: ${props.value}`
    }
  },
  penaltyDate: { type: Date, required: true },
  amount1: { type: Number, required: true },
  amount2: { type: Number, required: true },
  penaltyDetails: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'processed', 'rejected'],
    default: 'pending'
  },
  voucherCode: String
}, { timestamps: true });

const PenaltyReport = mongoose.model('PenaltyReport', penaltyReportSchema);

app.post('/merchant-issues', async (req, res) => {
  try {
    const { merchantName, merchantPhone, issueType, details } = req.body;
    
    if (!merchantName || !merchantPhone || !issueType || !details) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    const issue = new MerchantIssue({
      merchantName,
      merchantPhone,
      issueType,
      details,
      status: 'pending'
    });
    
    await issue.save();
    
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.isAdmin) {
        client.send(JSON.stringify({
          type: 'new-issue',
          issue: {
            _id: issue._id,
            merchantName: issue.merchantName,
            issueType: issue.issueType,
            status: issue.status,
            createdAt: issue.createdAt
          }
        }));
      }
    });

    res.status(201).json({ 
      success: true, 
      message: 'Issue report submitted successfully',
      issue 
    });
  } catch (error) {
    console.error('Issue report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit issue report' 
    });
  }
});

app.post('/penalty-report', async (req, res) => {
  try {
    const { merchantName, customerName, customerPhone, penaltyDate, amount1, amount2, penaltyDetails } = req.body;

    if (!merchantName || !customerName || !customerPhone || !penaltyDate || !amount1 || !amount2 || !penaltyDetails) {
      return res.status(400).json({ 
        success: false, 
        message: 'All required fields must be filled' 
      });
    }

    const report = new PenaltyReport({
      merchantName,
      customerName,
      customerPhone,
      penaltyDate: new Date(penaltyDate),
      amount1,
      amount2,
      penaltyDetails,
      status: 'pending',
      voucherCode: `VC-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    });

    await report.save();

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.isAdmin) {
        client.send(JSON.stringify({
          type: 'new-penalty',
          report: {
            _id: report._id,
            merchantName: report.merchantName,
            customerPhone: report.customerPhone,
            status: report.status,
            createdAt: report.createdAt
          }
        }));
      }
    });

    res.status(201).json({
      success: true,
      message: 'Penalty report submitted successfully',
      voucherCode: report.voucherCode
    });
  } catch (error) {
    console.error('Penalty report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit penalty report'
    });
  }
});

app.post('/premium-payment', authMiddleware, async (req, res) => {
  try {
    const { phone, trxid, amount, service } = req.body;
    
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
      status: 'Pending'
    });

    const savedPayment = await payment.save();
    
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.isAdmin) {
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
            company: 'premium_service',
            createdAt: savedPayment.createdAt
          }
        }));
      }
    });

    res.status(201).json({
      success: true,
      message: 'Premium payment submitted',
      payment: savedPayment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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

app.post('/subscribe', authMiddleware, async (req, res) => {
    try {
        const subscription = req.body;
        await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
        res.status(201).json({ success: true, message: 'Subscribed successfully' });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ success: false, message: 'Subscription failed' });
    }
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
    ).populate('user', 'email phone pushSubscription');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (status === 'Completed' && payment.user.pushSubscription) {
        const payload = JSON.stringify({
            title: 'Payment Completed!',
            body: `Your payment of ৳${payment.amount3} has been successfully processed.`,
            icon: 'https://oneai-wjox.onrender.com/images/logo.png'
        });

        webpush.sendNotification(payment.user.pushSubscription, payload).catch(error => {
            console.error('Push notification error:', error);
        });
    }

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'payment-updated',
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
