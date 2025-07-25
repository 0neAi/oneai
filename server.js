import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws'; // Import both
import { adminAuth } from './middleware/auth.js';
import Payment from './models/Payment.js';
import User from './models/User.js';
import Admin from './models/Admin.js';
import PremiumService from './models/PremiumService.js';
import dotenv from 'dotenv';
import http from 'http';
import webpush from 'web-push';
import path from 'path';
import { fileURLToPath } from 'url'

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
// Environment Validati
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

('/', (req, res) => res.status(200).json({ 
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
      isAdminApproved: false,
    });

    // Generate a unique referral code
    user.referralCode = `${user.phone.slice(-4)}${Date.now().toString(36).slice(-4)}`;

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please wait for admin approval.',
    });

  } catch (error) {
    let message = process.env.NODE_ENV === 'production'
      ? 'Registration failed'
      : error.message;
    res.status(500).json({ success: false, message });
  }
});
// ======================
// User Login Route (Fixed)
// ======================
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
    const { voucherCode } = req.body;
    if (voucherCode) {
        const voucher = await Voucher.findOne({ code: voucherCode, isUsed: false });
        if (voucher) {
            const discountPercentage = voucher.code.split('-')[1];
            amount3 *= (1 - discountPercentage / 100);
            voucher.isUsed = true;
            await voucher.save();
        } else {
            return res.status(400).json({ success: false, message: 'Invalid or expired voucher' });
        }
    } else if (discount > 0) {
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

    // Check for referral bonus
    const user = await User.findById(req.user._id);
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

    // Prepare WhatsApp message
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

    // Placeholder for WhatsApp API integration
    // In a real application, you would integrate a WhatsApp API here (e.g., Twilio, WhatsApp Business API)
    // For example:
    // try {
    //   const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    //   await client.messages.create({
    //     body: whatsappMessage,
    //     from: 'whatsapp:+14155238886', // Your Twilio WhatsApp number
    //     to: `whatsapp:${process.env.HELPLINE_WHATSAPP_NUMBER}`
    //   });
    //   console.log('WhatsApp message sent successfully!');
    // } catch (whatsappError) {
    //   console.error('Failed to send WhatsApp message:', whatsappError);
    // }
    console.log('Simulating WhatsApp message to helpline:');
    console.log(whatsappMessage);


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

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment processing failed'
    });
  }
});
// Merchant Issues API
const merchantIssueSchema = new mongoose.Schema({
  merchantName: { type: String, required: true },
  merchantPhone: { 
    type: String, 
    required: true,
    validate: {
      validator: v => /^01[3-9]\d{8}$/.test(v),
      message: props => `Invalid Bangladeshi phone number: ${props.value}`
    }
  },
  issueType: {
    type: String,
    required: true,
    enum: ['issue-raising', 'issue-less', 'other']
  },
  details: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'in progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  adminNotes: { type: String },
  voucherCode: { type: String },
  discountPercentage: { type: Number },
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

const voucherSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    discountPercentage: { type: Number, required: true },
    isUsed: { type: Boolean, default: false },
    validUntil: { type: Date, required: false }, // Added validUntil
    report: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'reportModel'
    },
    reportModel: {
        type: String,
        required: true,
        enum: ['MerchantIssue', 'PenaltyReport', 'PremiumService'] // Added PremiumService
    }
}, { timestamps: true });

const Voucher = mongoose.model('Voucher', voucherSchema);

// Merchant Issues API
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
    
    // WebSocket notification
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
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
      message: 'Issue report submitted successfully ixx1',
      issue 
    });
  } catch (error) {
    console.error('Issue report error ixx1:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit issue report' 
    });
  }
});

// Penalty Report API
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

    // WebSocket notification
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
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
      message: 'Penalty report submitted successfully pxx1',
      voucherCode: report.voucherCode
    });
  } catch (error) {
    console.error('Penalty report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit penalty report pxx2'
    });
  }
});

app.get('/merchant-issues', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }
    
    const issues = await MerchantIssue.find({ merchantPhone: phone }).sort({ createdAt: -1 });
    res.json({ success: true, issues });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch issues' });
  }
});

// Merchant issue status endpoint
app.get('/merchant-issue-status', async (req, res) => {
  try {
    const { phone } = req.query;
    const issue = await MerchantIssue.findOne({
      merchantPhone: phone,
      status: 'resolved'
    });

    if (issue && issue.voucherCode) {
      res.json({ success: true, voucherCode: issue.voucherCode });
    } else {
      res.status(404).json({ success: false, message: 'Report not processed yet' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check status' });
  }
});

// Penalty report status endpoint
app.get('/penalty-report-status', async (req, res) => {
  try {
    const { phone } = req.query;
    const report = await PenaltyReport.findOne({
      customerPhone: phone,
      status: 'processed'
    });

    if (report && report.voucherCode) {
      res.json({ success: true, voucherCode: report.voucherCode });
    } else {
      res.status(404).json({ success: false, message: 'Report not processed yet' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check status' });
  }
});

// Add this endpoint to fetch both types of reports
app.get('/user-reports/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const [issues, penalties] = await Promise.all([
      MerchantIssue.find({ merchantPhone: phone }),
      PenaltyReport.find({ customerPhone: phone })
    ]);
    
    res.json({
      success: true,
      reports: {
        issues: issues,
        penalties: penalties
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load reports' });
  }
});

app.get('/vouchers/:phone', async (req, res) => {
    try {
        const vouchers = await Voucher.find({ phone: req.params.phone });
        res.json({ success: true, vouchers });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch vouchers' });
    }
});
// Add after existing endpoints
app.get('/admin/admins', adminAuth, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
});

app.post('/admin/admins', adminAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }
    
    const { email, password, role } = req.body;
    const admin = new Admin({ email, password, role });
    await admin.save();
    
    res.status(201).json({ success: true, admin: admin.toSafeObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/admin/admins/:id', adminAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }
    
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Admin deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete admin' });
  }
});

app.put('/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

app.post('/admin/users/:id/approve', adminAuth, async (req, res) => {
  try {
    const { commissionPercentage } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isAdminApproved = true;
    user.referralCommissionPercentage = commissionPercentage;
    await user.save();

    const referrer = await User.findById(user.referredBy);
    if (referrer) {
      referrer.referrals.push(user._id);
      await referrer.save();
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to approve user' });
  }
});

app.delete('/admin/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

app.post('/admin/users/:id/generate-referral-code', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.referralCode) {
      return res.status(400).json({ success: false, message: 'User already has a referral code' });
    }

    user.referralCode = `${user.phone.slice(-4)}${Date.now().toString(36).slice(-4)}`;
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate referral code' });
  }
});

app.put('/admin/merchant-issues/:id', adminAuth, async (req, res) => {
  try {
    const issue = await MerchantIssue.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update issue fxx1' });
  }
});
// Add these endpoints to server.js
app.get('/admin/merchant-issues', adminAuth, async (req, res) => {
  try {
    const issues = await MerchantIssue.find().sort({ createdAt: -1 });
    res.json({ success: true, issues });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch merchant issues' });
  }
});

app.get('/admin/penalty-reports', adminAuth, async (req, res) => {
  try {
    const reports = await PenaltyReport.find().sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch penalty reports' });
  }
});


// Update issue status


app.post('/admin/issue-reports/:id/approve', adminAuth, async (req, res) => {
    try {
        const { discountPercentage } = req.body;
        const issue = await MerchantIssue.findById(req.params.id);
        if (!issue) {
            return res.status(404).json({ success: false, message: 'Issue not found' });
        }

        const voucherCode = `ONEAI-${discountPercentage}-${issue._id.toString().slice(-4)}`;
        const voucher = new Voucher({
            phone: issue.merchantPhone,
            code: voucherCode,
            discountPercentage,
            report: issue._id,
            reportModel: 'MerchantIssue'
        });
        await voucher.save();

        issue.status = 'resolved';
        issue.voucherCode = voucherCode;
        issue.discountPercentage = discountPercentage;
        await issue.save();

        res.json({ success: true, issue });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to approve issue' });
    }
});

// Update issue details
app.put('/admin/penalty-reports/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processed', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const report = await PenaltyReport.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: 'Penalty report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update penalty report status' });
  }
});



app.post('/admin/penalty-reports/:id/process', adminAuth, async (req, res) => {
    try {
        const { discountPercentage } = req.body;
        const report = await PenaltyReport.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, message: 'Penalty report not found' });
        }

        const voucherCode = `ONEAI-${discountPercentage}-${report._id.toString().slice(-4)}`;
        const voucher = new Voucher({
            phone: report.customerPhone,
            code: voucherCode,
            discountPercentage,
            report: report._id,
            reportModel: 'PenaltyReport'
        });
        await voucher.save();

        report.status = 'processed';
        report.voucherCode = voucherCode;
        await report.save();

        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to process penalty report' });
    }
});

app.post('/validate-voucher', async (req, res) => {
    try {
        const { voucherCode } = req.body;
        const voucher = await Voucher.findOne({ code: voucherCode, isUsed: false });

        if (!voucher) {
            return res.status(404).json({ success: false, message: 'Invalid or expired voucher' });
        }

        res.json({ success: true, discountPercentage: voucher.discountPercentage });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to validate voucher' });
    }
});
//
app.put('/admin/premium-services/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Completed', 'Failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const premiumService = await PremiumService.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!premiumService) {
      return res.status(404).json({ success: false, message: 'Premium service not found' });
    }

    res.json({ success: true, premiumService });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update premium service status' });
  }
});

app.get('/admin/premium-services', adminAuth, async (req, res) => {
  try {
    const premiumServices = await PremiumService.find().sort({ createdAt: -1 });
    res.json({ success: true, premiumServices });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch premium services' });
  }
});

app.get('/premium-services/:phone', async (req, res) => {
    try {
        const services = await PremiumService.find({ phone: req.params.phone }).sort({ createdAt: -1 });
        res.json({ success: true, services });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch premium services' });
    }
});

app.post('/admin/generate-premium-voucher', adminAuth, async (req, res) => {
  try {
    const { phone, discountPercentage, validity } = req.body;

    let validUntil = null;
    const now = new Date();

    switch (validity) {
      case '1d':
        validUntil = new Date(now.setDate(now.getDate() + 1));
        break;
      case '2d':
        validUntil = new Date(now.setDate(now.getDate() + 2));
        break;
      case '3d':
        validUntil = new Date(now.setDate(now.getDate() + 3));
        break;
      case '15d':
        validUntil = new Date(now.setDate(now.getDate() + 15));
        break;
      case '1m':
        validUntil = new Date(now.setMonth(now.getMonth() + 1));
        break;
      case '3m':
        validUntil = new Date(now.setMonth(now.getMonth() + 3));
        break;
      case 'lifetime':
        validUntil = new Date(9999, 11, 31); // Far future date for lifetime
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid validity period' });
    }

    const voucherCode = `PREMIUM-${discountPercentage}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const voucher = new Voucher({
      phone,
      code: voucherCode,
      discountPercentage,
      isUsed: false,
      validUntil,
      reportModel: 'PremiumService' // Using PremiumService as a placeholder for reportModel
    });
    await voucher.save();

    res.status(201).json({ success: true, voucherCode, discountPercentage, validUntil });
  } catch (error) {
    console.error('Error generating premium voucher:', error);
    res.status(500).json({ success: false, message: 'Failed to generate premium voucher' });
  }
});

// Add new endpoint for premium service without authentication
app.post('/premium-service', async (req, res) => {
  try {
    const { phone, trxid, amount, voucherCode } = req.body;
    
    if (!phone || !trxid || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }

    let serviceType;
    let validUntil = null;
    const now = new Date();

    let finalAmount = Number(amount);

    switch (finalAmount) {
      case 500:
        serviceType = '15day_15merchant';
        validUntil = new Date(now.setDate(now.getDate() + 15));
        break;
      case 1000:
        serviceType = '1month_30merchant';
        validUntil = new Date(now.setMonth(now.getMonth() + 1));
        break;
      case 2000:
        serviceType = '3month_full_db';
        validUntil = new Date(now.setMonth(now.getMonth() + 3));
        break;
      case 5000:
        serviceType = 'lifetime_full_db';
        validUntil = new Date(9999, 11, 31); // Far future date for lifetime
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid package selection or amount after discount'
        });
    }

    // Create premium service record
    const premiumService = new PremiumService({
      phone,
      trxid,
      amount: Number(amount),
      serviceType,
      status: 'Pending',
      validUntil
    });

    await premiumService.save();

    // WebSocket notification to admin
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'new-premium',
          service: {
            _id: premiumService._id,
            phone: premiumService.phone,
            amount: premiumService.amount,
            serviceType: premiumService.serviceType,
            createdAt: premiumService.createdAt
          }
        }));
      }
    });

    res.status(201).json({
      success: true,
      message: 'Premium service request submitted successfully'
    });

  } catch (error) {
    console.error('Premium service error:', error);
    let message = 'Failed to process premium service request';
    if (error.code === 11000) message = 'Duplicate transaction ID';
    
    res.status(500).json({
      success: false,
      message
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
    ).populate('user', 'email phone');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (status === 'Completed') {
        const user = await User.findById(payment.user);
        if (user && user.referredBy) {
            const paymentCount = await Payment.countDocuments({ user: user._id, status: 'Completed' });
            if (paymentCount === 1) {
                const referrer = await User.findById(user.referredBy);
                if (referrer) {
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
    }

    // If the status is completed, send a push notification
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

    // Broadcast update via WebSocket
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

// ======================
// Admin registration check
app.get('/admin/check-registration', async (req, res) => {
  try {
    const canRegister = await Admin.countDocuments() === 0;
    res.json({ allowRegistration: canRegister });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error checking registration status' 
    });
  }
});

app.post('/admin/premium-payments/:id/process', adminAuth, async (req, res) => {
    try {
        const { discountPercentage, validity } = req.body;
        const premiumService = await PremiumService.findById(req.params.id);
        if (!premiumService) {
            return res.status(404).json({ success: false, message: 'Premium service not found' });
        }

        let validUntil = null;
        const now = new Date();

        switch (validity) {
          case '1d':
            validUntil = new Date(now.setDate(now.getDate() + 1));
            break;
          case '2d':
            validUntil = new Date(now.setDate(now.getDate() + 2));
            break;
          case '3d':
            validUntil = new Date(now.setDate(now.getDate() + 3));
            break;
          case '15d':
            validUntil = new Date(now.setDate(now.getDate() + 15));
            break;
          case '1m':
            validUntil = new Date(now.setMonth(now.getMonth() + 1));
            break;
          case '3m':
            validUntil = new Date(now.setMonth(now.getMonth() + 3));
            break;
          case 'lifetime':
            validUntil = new Date(9999, 11, 31); // Far future date for lifetime
            break;
          default:
            return res.status(400).json({ success: false, message: 'Invalid validity period' });
        }

        const voucherCode = `PREMIUM-${discountPercentage}-${premiumService._id.toString().slice(-4)}`;
        const voucher = new Voucher({
            phone: premiumService.phone,
            code: voucherCode,
            discountPercentage,
            isUsed: false,
            validUntil,
            report: premiumService._id,
            reportModel: 'PremiumService'
        });
        await voucher.save();

        premiumService.status = 'Completed';
        premiumService.voucherCode = voucherCode;
        await premiumService.save();

        res.json({ success: true, premiumService });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to process premium payment' });
    }
});
// Admin exists check
app.get('/admin/exists', async (req, res) => {
    const count = await Admin.countDocuments();
    res.json({ exists: count > 0 });
});

// Admin login
app.post('/admin/login', async (req, res) => {
    try {
        const admin = await Admin.findOne({ email: req.body.email });
        if (!admin) return res.status(401).json({ message: 'Admin not found' });
        
        const valid = await admin.comparePassword(req.body.password);
        if (!valid) return res.status(401).json({ message: 'Invalid password' });
        
        const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });
        
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Login failed' });
    }
});

// Protected routes
app.get('/users', adminAuth, async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users);
});

app.get('/payments', adminAuth, async (req, res) => {
    const payments = await Payment.find().populate('user', 'email phone');
    res.json(payments);
});
// ======================
// Admin Registration
// ======================
// Remove duplicate endpoint and keep only this one:
// Admin registration - Fix this endpoint
app.post('/admin/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if registration is allowed
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(403).json({
        success: false,
        message: 'Admin registration is closed'
      });
    }

    // Create admin
    const admin = new Admin({
      email: email.trim().toLowerCase(),
      password,
      role: 'superadmin'
    });

    await admin.save();

    res.json({ 
      success: true,
      admin: admin.toSafeObject()
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    let message = 'Registration failed';
    if (error.code === 11000) message = 'Email already exists';
    
    res.status(400).json({
      success: false,
      message
    });
  }
});

// Remove

// ======================
// Admin validation
app.get('/admin/validate', adminAuth, (req, res) => {
  res.json({ success: true });
});

// Admin get payments
app.get('/admin/payments', adminAuth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
});


// ======================
// User Payments Route
// ======================
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

// ======================
// Premium Payment Route
// ======================
// In the premium-payment route
app.post('/premium-payment', authMiddleware, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.phone || !req.body.trxid || !req.body.amount || !req.body.service || !req.body.type) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      company: 'premium_service',
      phone: req.body.phone,
      password: 'premium_access',
      method: 'Premium',
      trxid: req.body.trxid,
      consignments: [{
        name: 'Premium Service',
        phone: req.body.phone,
        amount1: req.body.amount,
        amount2: 0,
        serviceType: req.body.service
      }],
      amount3: req.body.amount,
      status: 'Pending'
    });

    // Save and broadcast
    const savedPayment = await payment.save();
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
            company: 'premium_service',
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
    res.status(500).json({
      success: false,
      message: error.message || 'Premium payment processing failed'
    });
  }
});

// ======================
// Get Users (Admin)
// ======================
app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().populate('referredBy', 'name').select('-password');
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const payments = await Payment.find({ user: user._id, status: 'Completed' });
      const totalPayments = payments.length;
      const totalAmount = payments.reduce((acc, payment) => acc + payment.amount3, 0);
      return {
        ...user.toObject(),
        totalPayments,
        totalAmount
      };
    }));
    res.json({ success: true, users: usersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/admin/users/:id/details', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('referredBy', 'name email')
      .populate('referrals', 'name email')
      .select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const payments = await Payment.find({ user: user._id, status: 'Completed' }).sort({ createdAt: -1 });
    const totalPayments = payments.length;
    const totalAmount = payments.reduce((acc, payment) => acc + payment.amount3, 0);

    let monthlyCommission = 0;
    if (user.referrals && user.referrals.length > 0) {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      for (const referredUser of user.referrals) {
        const referredUserPayments = await Payment.find({
          user: referredUser._id,
          createdAt: { $gte: startOfMonth },
          status: 'Completed'
        });
        const totalReferredUserPayments = referredUserPayments.reduce((acc, payment) => acc + payment.amount3, 0);
        const commissionPercentage = typeof referredUser.referralCommissionPercentage === 'number' ? referredUser.referralCommissionPercentage : 0;
        monthlyCommission += totalReferredUserPayments * (commissionPercentage / 100);
      }
    }

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        payments,
        totalPayments,
        totalAmount,
        monthlyCommission
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
});

app.get('/admin/user-payments/:email', adminAuth, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { startDate, endDate } = req.query;
        let query = { user: user._id, status: 'Completed' };

        if (startDate) {
            query.createdAt = { ...query.createdAt, $gte: new Date(startDate) };
        }
        if (endDate) {
            query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
        }

        const payments = await Payment.find(query).sort({ createdAt: -1 });
        const totalAmount = payments.reduce((acc, payment) => acc + payment.amount3, 0);

        res.json({
            success: true,
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            payments,
            totalAmount,
            totalPayments: payments.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch user payments' });
    }
});

app.get('/users/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('referrals', 'phone email');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

app.get('/users/:id/monthly-commission', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('referrals');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        let totalCommission = 0;

        for (const referredUser of user.referrals) {
            const payments = await Payment.find({
                user: referredUser._id,
                createdAt: { $gte: startOfMonth },
                status: 'Completed'
            });
            const totalReferredUserPayments = payments.reduce((acc, payment) => acc + payment.amount3, 0);
            totalCommission += totalReferredUserPayments * (referredUser.referralCommissionPercentage / 100);
        }

        res.json({ success: true, monthlyCommission: totalCommission });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to calculate monthly commission' });
    }
});

// ======================
// User Validation Route
// ======================
app.get('/validate', authMiddleware, async (req, res) => {
  res.json({ success: true });
});
// ======================
// Request Logging
// ======================
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
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
export default app;
