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
    // Fix: Use new variable for normalized email
    const { phone, email: rawEmail, password } = req.body;
    const email = rawEmail.toLowerCase().trim();
        // Add password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }
    
    if (!phone || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    // Add phone duplicate check
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
     message = process.env.NODE_ENV === 'production'
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
// Add this to server.js after other routes
app.post('/api/penalty-report', async (req, res) => {
  try {
    const { merchantName, customerName, customerPhone, penaltyDate, amount1, amount2, penaltyDetails } = req.body;

    // Validate required fields
    if (!merchantName || !customerName || !customerPhone || !penaltyDate || !amount1 || !amount2) {
      return res.status(400).json({ 
        success: false, 
        message: 'All required fields must be filled' 
      });
    }

    // Validate phone number
    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!phoneRegex.test(customerPhone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number format' 
      });
    }

    // Create penalty report record (in a real app, save to database)
    const penaltyReport = {
      merchantName,
      customerName,
      customerPhone,
      penaltyDate: new Date(penaltyDate),
      amount1: parseFloat(amount1),
      amount2: parseFloat(amount2),
      penaltyDetails,
      status: 'Pending',
      createdAt: new Date()
    };

    // In a real application, you would save to database:
    // const newReport = new PenaltyReport(penaltyReport);
    // await newReport.save();

    // Send notification to admin (simulated)
    console.log('New penalty report:', penaltyReport);

    res.status(201).json({
      success: true,
      message: 'Penalty report submitted successfully',
      report: penaltyReport
    });
  } catch (error) {
    console.error('Penalty report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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
  merchantPhone: { type: String, required: true },
  issueType: { type: String, required: true },
  details: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in progress', 'resolved', 'rejected'], default: 'pending' },
  adminNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const MerchantIssue = mongoose.model('MerchantIssue', merchantIssueSchema);

// Fix duplicate endpoint in server.js
app.get('/api/merchant-issues', async (req, res) => {
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
// Create new merchant issue
app.post('/api/merchant-issues', async (req, res) => {
  try {
    const { merchantName, merchantPhone, issueType, severity, details } = req.body;
    
    if (!merchantName || !merchantPhone || !issueType || !details) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const issue = new MerchantIssue({
      merchantName,
      merchantPhone,
      issueType,
      severity,
      details,
      status: 'pending'
    });
    
    const savedIssue = await issue.save();
    
    res.status(201).json({ success: true, issue: savedIssue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create issue' });
  }
});

// Update issue status
app.put('/api/merchant-issues/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'in progress', 'resolved', 'rejected'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const issue = await MerchantIssue.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }
    
    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update issue' });
  }
});

// Update issue details
app.put('/api/merchant-issues/:id', adminAuth, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    
    const updateData = { updatedAt: Date.now() };
    if (status) updateData.status = status;
    if (adminNotes) updateData.adminNotes = adminNotes;
    
    const issue = await MerchantIssue.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }
    
    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update issue' });
  }
});
// Update premium-payment endpoint
app.post('/premium-payment', authMiddleware, async (req, res) => {
  try {
    const { phone, trxid, amount, service } = req.body;
    
    // Create payment record using Payment model
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
    ).populate('user', 'email phone');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
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
// Admin exists check
app.get('/api/admin/exists', async (req, res) => {
    const count = await Admin.countDocuments();
    res.json({ exists: count > 0 });
});

// Admin registration
app.post('/api/admin/register', async (req, res) => {
    try {
        const admin = await Admin.register(req.body.email, req.body.password);
        res.json(admin);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
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
app.get('/api/users', adminAuth, async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users);
});

app.get('/api/payments', adminAuth, async (req, res) => {
    const payments = await Payment.find().populate('user', 'email phone');
    res.json(payments);
});
// ======================
// Admin Registration
// ======================
app.post('/admin/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.register(email, password);
    
    res.json({
      success: true,
      admin
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

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
// Get Payments (Admin)
// ======================
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
    const users = await User.find().select('-password');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
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
