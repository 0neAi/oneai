const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WebSocketServer, WebSocket } = require('ws');
const { adminAuth, validateUser } = require('./middleware/auth');
const Payment = require('./models/Payment');
const User = require('./models/User');
const Admin = require('./models/Admin');
const PremiumService = require('./models/PremiumService');
const FexiloadRequest = require('./models/FexiloadRequest');
const LocationTrackerServiceRequest = require('./models/LocationTrackerServiceRequest');
const Voucher = require('./models/Voucher');
const MerchantIssue = require('./models/MerchantIssue'); // Added
const PenaltyReport = require('./models/PenaltyReport'); // Added
const Page = require('./models/Page'); // Added
const TrxRechargeRequest = require('./models/TrxRechargeRequest'); // Added
const dotenv = require('dotenv');
const http = require('http');
const webpush = require('web-push');
const path = require('path');

// Initialize environment variables
dotenv.config();

function standardizePageName(name) {
  // Check if it's a domain name (contains a dot and no spaces)
  if (name.includes('.') && !name.includes(' ')) {
    return name.toLowerCase(); // Keep domain names as-is, lowercase
  }
  // For other names, capitalize first letter of each word
  return name.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// Initialize express app
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.static(path.join(__dirname, 'public')));
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

app.get('/validate', validateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      isAdminApproved: req.user.isApproved
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, message: 'Validation failed' });
  }
});

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

// Merchant Issue Submission
app.post('/merchant-issues', async (req, res) => {
  try {
    const { merchantName, merchantPhone, issueType, details } = req.body;

    if (!merchantName || !merchantPhone || !issueType || !details) {
      return res.status(400).json({ success: false, message: 'All fields are required for merchant issue submission.' });
    }

    const newIssue = new MerchantIssue({
      merchantName,
      merchantPhone,
      issueType,
      details,
      status: 'pending' // Initial status
    });

    await newIssue.save();

    // Increment issueCount for the page
    const standardizedPageName = standardizePageName(merchantName);
    await Page.findOneAndUpdate(
      { pageName: standardizedPageName },
      { $inc: { issueCount: 1 } }, // Increment issueCount
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, message: 'Merchant issue submitted successfully.', issue: newIssue });
  } catch (error) {
    console.error('Error submitting merchant issue:', error);
    res.status(500).json({ success: false, message: 'Failed to submit merchant issue.' });
  }
});

// Penalty Report Submission
app.post('/penalty-report', async (req, res) => {
  try {
    const { merchantName, customerName, customerPhone, penaltyDate, amount1, amount2, penaltyDetails } = req.body;

    if (!merchantName || !customerName || !customerPhone || !penaltyDate || amount1 === undefined || amount2 === undefined || !penaltyDetails) {
      return res.status(400).json({ success: false, message: 'All fields are required for penalty report submission.' });
    }

    const newPenaltyReport = new PenaltyReport({
      merchantName,
      customerName,
      customerPhone,
      penaltyDate,
      amount1,
      amount2,
      penaltyDetails,
      status: 'pending' // Initial status
    });

    await newPenaltyReport.save();

    res.status(201).json({ success: true, message: 'Penalty report submitted successfully.', report: newPenaltyReport });
  } catch (error) {
    console.error('Error submitting penalty report:', error);
    res.status(500).json({ success: false, message: 'Failed to submit penalty report.' });
  }
});

// Premium Service Submission
app.post('/premium-service', validateUser, async (req, res) => {
  try {
    const { phone, amount, serviceType } = req.body;

    if (!phone || !amount || !serviceType) {
      return res.status(400).json({ success: false, message: 'All fields are required for premium service submission.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.trxBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient TRX balance for premium service.' });
    }

    user.trxBalance -= amount;
    await user.save();

    const newPremiumService = new PremiumService({
      phone,
      trxid: 'DEDUCTED_FROM_WALLET',
      amount,
      serviceType,
      status: 'Completed', // Payment is immediately completed from wallet
      discountPercentage: 0, // Default or derive based on serviceType
      validity: 'lifetime' // Default or derive based on serviceType
    });

    await newPremiumService.save();

    res.status(201).json({ success: true, message: 'Premium service request submitted successfully.', premiumService: newPremiumService });
  } catch (error) {
    console.error('Error submitting premium service request:', error);
    res.status(500).json({ success: false, message: 'Failed to submit premium service request.' });
  }
});

// Fetch Vouchers by Phone Number
app.get('/vouchers/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const vouchers = await Voucher.find({ phone: phone }).sort({ createdAt: -1 });
    res.json({ success: true, vouchers });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vouchers.' });
  }
});

// Apply Voucher Endpoint
app.post('/apply-voucher', async (req, res) => {
  try {
    const { voucherCode } = req.body;
    const voucher = await Voucher.findOne({ code: voucherCode, isUsed: false });

    if (!voucher) {
      return res.status(400).json({ success: false, message: 'Invalid or expired voucher code.' });
    }

    // Mark voucher as used (or apply logic based on your voucher system)
    // For now, just return the discount percentage
    res.json({ success: true, message: 'Voucher applied successfully!', discountPercentage: voucher.discountPercentage });
  } catch (error) {
    console.error('Apply voucher error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply voucher.' });
  }
});

// Admin General Payment Endpoints
app.get('/admin/payments', adminAuth, async (req, res) => {
  try {
    const payments = await Payment.find().populate('user', 'email').sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    console.error('Error fetching admin payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
});

app.put('/admin/payments/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findByIdAndUpdate(
      id,
      { status: 'Completed' },
      { new: true }
    ).populate('user', 'email');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Notify users/dashboard via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userID === payment.user.toString()) {
        client.send(JSON.stringify({
          type: 'payment-updated',
          payment: {
            _id: payment._id,
            status: payment.status,
            trxid: payment.trxid,
            amount3: payment.amount3
          }
        }));
      }
    });

    res.json({ success: true, message: 'Payment approved successfully.', payment });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ success: false, message: 'Failed to approve payment.' });
  }
});

app.put('/admin/payments/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findByIdAndUpdate(
      id,
      { status: 'Failed' },
      { new: true }
    ).populate('user', 'email');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Notify users/dashboard via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userID === payment.user.toString()) {
        client.send(JSON.stringify({
          type: 'payment-updated',
          payment: {
            _id: payment._id,
            status: payment.status,
            trxid: payment.trxid,
            amount3: payment.amount3
          }
        }));
      }
    });

    res.json({ success: true, message: 'Payment rejected successfully.', payment });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ success: false, message: 'Failed to reject payment.' });
  }
});

app.delete('/admin/payments/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findByIdAndDelete(id);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    res.json({ success: true, message: 'Payment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete payment.' });
  }
});

// Admin Authentication Routes
app.get('/admin/exists', async (req, res) => {
  try {
    const adminCount = await Admin.countDocuments();
    res.json({ exists: adminCount > 0 });
  } catch (error) {
    console.error('Error checking admin existence:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/admin/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(403).json({ success: false, message: 'Admin account already exists. Registration forbidden.' });
    }

    const admin = new Admin({ email, password });
    const token = jwt.sign({ adminId: admin._id, role: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.status(201).json({ success: true, message: 'Admin registered successfully.', token });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin registration.' });
  }
});

app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ adminId: admin._id, role: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin login.' });
  }
});

app.get('/admin/validate', adminAuth, (req, res) => {
  res.json({ success: true, message: 'Admin token is valid.' });
});

// Admin User Management Endpoints
app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().populate('referredBy', 'name').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

app.post('/admin/users/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionPercentage, name, zilla, officeLocation } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.isApproved = true;
    user.name = name || user.name;
    user.zilla = zilla || user.zilla;
    user.officeLocation = officeLocation || user.officeLocation;
    user.referralCommissionPercentage = commissionPercentage !== undefined ? commissionPercentage : user.referralCommissionPercentage;

    await user.save();

    res.json({ success: true, message: 'User approved successfully.', user });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ success: false, message: 'Failed to approve user.' });
  }
});

// Admin Merchant Issue Endpoints
app.get('/admin/merchant-issues', adminAuth, async (req, res) => {
  try {
    const issues = await MerchantIssue.find().sort({ createdAt: -1 });
    res.json({ success: true, issues });
  } catch (error) {
    console.error('Error fetching admin merchant issues:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch merchant issues.' });
  }
});

// Admin Penalty Report Endpoints
app.get('/admin/penalty-reports', adminAuth, async (req, res) => {
  try {
    const reports = await PenaltyReport.find().sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Error fetching admin penalty reports:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch penalty reports.' });
  }
});

// Admin Page Management Endpoints
app.post('/admin/pages', adminAuth, async (req, res) => {
  try {
    const { pageName, status, count, issueCount, note } = req.body;

    if (!pageName) {
      return res.status(400).json({ success: false, message: 'Page Name is required.' });
    }

    const standardizedPageName = standardizePageName(pageName);

    const existingPage = await Page.findOne({ pageName: standardizedPageName });
    if (existingPage) {
      return res.status(409).json({ success: false, message: `Page '${standardizedPageName}' already exists.` });
    }

    const newPage = new Page({
      pageName: standardizedPageName,
      status: status || 'new-listed',
      count: count || 0,
      issueCount: issueCount || 0,
      note: note || '',
    });
    await newPage.save();

    res.status(201).json({ success: true, message: 'Page added successfully.', page: newPage });

  } catch (error) {
    console.error('Error adding new page:', error);
    res.status(500).json({ success: false, message: 'Failed to add new page.' });
  }
});

app.put('/admin/pages/:shortId', adminAuth, async (req, res) => {
  try {
    const { shortId } = req.params;
    const { pageName, status, count, issueCount, note } = req.body;

    const updatedPage = await Page.findOneAndUpdate(
      { shortId: shortId },
      { pageName, status, count, issueCount, note },
      { new: true }
    );

    if (!updatedPage) {
      return res.status(404).json({ success: false, message: 'Page not found.' });
    }

    res.json({ success: true, message: `Page '${updatedPage.pageName}' updated successfully.`, page: updatedPage });

  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({ success: false, message: 'Failed to update page.' });
  }
});

app.delete('/admin/pages/:shortId', adminAuth, async (req, res) => {
  try {
    const { shortId } = req.params;

    const deletedPage = await Page.findOneAndDelete({ shortId: shortId });

    if (!deletedPage) {
      return res.status(404).json({ success: false, message: 'Page not found.' });
    }

    res.json({ success: true, message: `Page '${deletedPage.pageName}' deleted successfully.` });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ success: false, message: 'Failed to delete page.' });
  }
});

// Admin Premium Service Endpoints
app.get('/admin/premium-services', adminAuth, async (req, res) => {
  try {
    const premiumServices = await PremiumService.find().sort({ createdAt: -1 });
    res.json({ success: true, premiumServices });
  } catch (error) {
    console.error('Error fetching admin premium services:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch premium services.' });
  }
});

app.post('/admin/generate-premium-voucher', adminAuth, async (req, res) => {
  try {
    const { phone, discountPercentage, validity } = req.body;

    if (!phone || discountPercentage === undefined || !validity) {
      return res.status(400).json({ success: false, message: 'Phone, discount percentage, and validity are required.' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User with this phone number not found.' });
    }

    let validUntil = null;
    if (validity !== 'lifetime') {
      const num = parseInt(validity.slice(0, -1));
      const unit = validity.slice(-1);
      validUntil = new Date();
      if (unit === 'd') {
        validUntil.setDate(validUntil.getDate() + num);
      } else if (unit === 'm') {
        validUntil.setMonth(validUntil.getMonth() + num);
      }
    }

    const voucherCode = `PREMIUM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newVoucher = new Voucher({
      phone: user.phone,
      code: voucherCode,
      discountPercentage,
      validUntil,
      report: user._id,
      reportModel: 'User' // Associating with the user who receives the voucher
    });

    await newVoucher.save();

    res.status(201).json({ success: true, message: 'Premium voucher generated successfully.', voucherCode, discountPercentage, validUntil });
  } catch (error) {
    console.error('Error generating premium voucher:', error);
    res.status(500).json({ success: false, message: 'Failed to generate premium voucher.' });
  }
});

app.post('/admin/premium-payments/:id/process', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const premiumService = await PremiumService.findById(id);
    if (!premiumService) {
      return res.status(404).json({ success: false, message: 'Premium service request not found.' });
    }

    // If the premium service is already completed (e.g., paid via TRX wallet), 
    // we can still generate a voucher if needed, but the status won't change.
    if (premiumService.status === 'Completed' && premiumService.trxid === 'DEDUCTED_FROM_WALLET') {
      // Optionally, handle this case differently if a voucher should only be generated once.
      // For now, we proceed to generate a voucher if it hasn't been generated yet.
    }

    // Assuming discountPercentage and validity are now part of the PremiumService object
    // or determined by admin logic, not passed in req.body for processing.
    // For simplicity, let's assume a default or fetch from premiumService if available.
    const discountPercentage = premiumService.discountPercentage || 0; // Assuming a field exists or default
    const validity = premiumService.validity || 'lifetime'; // Assuming a field exists or default

    let validUntil = null;
    if (validity !== 'lifetime') {
      const num = parseInt(validity.slice(0, -1));
      const unit = validity.slice(-1);
      validUntil = new Date();
      if (unit === 'd') {
        validUntil.setDate(validUntil.getDate() + num);
      } else if (unit === 'm') {
        validUntil.setMonth(validUntil.getMonth() + num);
      }
    }
    premiumService.validUntil = validUntil;

    const voucherCode = `PREMIUM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newVoucher = new Voucher({
      phone: premiumService.phone,
      code: voucherCode,
      discountPercentage,
      validUntil,
      report: premiumService._id,
      reportModel: 'PremiumService'
    });

    await newVoucher.save();
    await premiumService.save(); // Save to update validUntil if changed

    res.json({ success: true, message: 'Premium payment processed and voucher generated.', premiumService, voucher: newVoucher });
  } catch (error) {
    console.error('Error processing premium payment:', error);
    res.status(500).json({ success: false, message: 'Failed to process premium payment.' });
  }
});

// Admin Fexiload Request Endpoints
app.get('/admin/fexiload-requests', adminAuth, async (req, res) => {
  try {
    const fexiloadRequests = await FexiloadRequest.find().populate('userId', 'email phone').sort({ createdAt: -1 });
    res.json({ success: true, fexiloadRequests });
  } catch (error) {
    console.error('Error fetching admin fexiload requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fexiload requests.' });
  }
});

app.put('/admin/fexiload-requests/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Completed', 'Failed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    const fexiloadRequest = await FexiloadRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('userId', 'email phone');

    if (!fexiloadRequest) {
      return res.status(404).json({ success: false, message: 'Fexiload request not found.' });
    }

    // Notify users/dashboard via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userID === fexiloadRequest.userId.toString()) {
        client.send(JSON.stringify({
          type: 'fexiload-updated',
          fexiloadRequest: {
            _id: fexiloadRequest._id,
            status: fexiloadRequest.status,
            gpNumber: fexiloadRequest.gpNumber,
            rechargeAmount: fexiloadRequest.rechargeAmount
          }
        }));
      }
    });

    res.json({ success: true, message: 'Fexiload request status updated.', fexiloadRequest });
  } catch (error) {
    console.error('Error updating fexiload request status:', error);
    res.status(500).json({ success: false, message: 'Failed to update fexiload request status.' });
  }
});

app.delete('/admin/fexiload-requests/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const fexiloadRequest = await FexiloadRequest.findByIdAndDelete(id);

    if (!fexiloadRequest) {
      return res.status(404).json({ success: false, message: 'Fexiload request not found.' });
    }

    res.json({ success: true, message: 'Fexiload request deleted successfully.' });
  } catch (error) {
    console.error('Error deleting fexiload request:', error);
    res.status(500).json({ success: false, message: 'Failed to delete fexiload request.' });
  }
});

// Admin Location Tracker Request Endpoints
app.get('/admin/tracker/requests', adminAuth, async (req, res) => {
  try {
    const locationTrackerRequests = await LocationTrackerServiceRequest.find().populate('user', 'email phone').sort({ createdAt: -1 });
    res.json({ success: true, requests: locationTrackerRequests });
  } catch (error) {
    console.error('Error fetching admin location tracker requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch location tracker requests.' });
  }
});

app.put('/admin/tracker/requests/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, moderatorNotes } = req.body;

    if (!['Pending', 'Approved', 'Rejected', 'Completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    const locationTrackerRequest = await LocationTrackerServiceRequest.findByIdAndUpdate(
      id,
      { status, moderatorNotes },
      { new: true }
    ).populate('user', 'email phone');

    if (!locationTrackerRequest) {
      return res.status(404).json({ success: false, message: 'Location tracker request not found.' });
    }

    // Notify users/dashboard via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userID === locationTrackerRequest.user.toString()) {
        client.send(JSON.stringify({
          type: 'location-tracker-updated',
          request: {
            _id: locationTrackerRequest._id,
            status: locationTrackerRequest.status,
            moderatorNotes: locationTrackerRequest.moderatorNotes,
            sourceType: locationTrackerRequest.sourceType
          }
        }));
      }
    });

    res.json({ success: true, message: 'Location tracker request status updated.', request: locationTrackerRequest });
  } catch (error) {
    console.error('Error updating location tracker request status:', error);
    res.status(500).json({ success: false, message: 'Failed to update location tracker request status.' });
  }
});

app.post('/admin/deliver-data', adminAuth, async (req, res) => {
  try {
    const { requestId, dataType, dataContent } = req.body;

    if (!requestId || !dataType || !dataContent) {
      return res.status(400).json({ success: false, message: 'Missing required fields for data delivery.' });
    }

    const locationTrackerRequest = await LocationTrackerServiceRequest.findById(requestId);

    if (!locationTrackerRequest) {
      return res.status(404).json({ success: false, message: 'Location tracker request not found.' });
    }

    // Add delivered data to the request
    locationTrackerRequest.deliveredData.push({
      dataType,
      dataContent,
      deliveredBy: req.admin._id, // Assuming req.admin is populated by adminAuth
      deliveredAt: new Date()
    });

    // Optionally update status to Completed if data is delivered
    if (locationTrackerRequest.status !== 'Completed') {
      locationTrackerRequest.status = 'Completed';
    }

    await locationTrackerRequest.save();

    // Notify users/dashboard via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userID === locationTrackerRequest.user.toString()) {
        client.send(JSON.stringify({
          type: 'location-tracker-updated',
          request: {
            _id: locationTrackerRequest._id,
            status: locationTrackerRequest.status,
            deliveredData: locationTrackerRequest.deliveredData,
            moderatorNotes: locationTrackerRequest.moderatorNotes
          }
        }));
      }
    });

    res.json({ success: true, message: 'Data delivered successfully.', request: locationTrackerRequest });
  } catch (error) {
    console.error('Error delivering data:', error);
    res.status(500).json({ success: false, message: 'Failed to deliver data.' });
  }
});

app.delete('/admin/tracker/requests/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const locationTrackerRequest = await LocationTrackerServiceRequest.findByIdAndDelete(id);

    if (!locationTrackerRequest) {
      return res.status(404).json({ success: false, message: 'Location tracker request not found.' });
    }

    res.json({ success: true, message: 'Location tracker request deleted successfully.' });
  } catch (error) {
    console.error('Error deleting location tracker request:', error);
    res.status(500).json({ success: false, message: 'Failed to delete location tracker request.' });
  }
});

app.post('/refresh-token', validateUser, async (req, res) => {
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

// Fexiload Request Submission
app.post('/fexiload-request', validateUser, async (req, res) => {
  try {
    const { gpNumber, rechargeAmount, retailCharge } = req.body;

    // Basic validation
    if (!gpNumber || !rechargeAmount || !retailCharge) {
      return res.status(400).json({ success: false, message: 'All fields are required for fexiload request.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.trxBalance < retailCharge) {
      return res.status(400).json({ success: false, message: 'Insufficient TRX balance for fexiload request.' });
    }

    user.trxBalance -= retailCharge;
    await user.save();

    // Create new fexiload request
    const fexiloadRequest = new FexiloadRequest({
      userId: req.user._id,
      gpNumber,
      rechargeAmount,
      transactionNumber: 'DEDUCTED_FROM_WALLET',
      retailCharge,
      method: 'TRX Wallet',
      status: 'Completed' // Initial status
    });

    await fexiloadRequest.save();
    console.log('FexiloadRequest object before saving:', fexiloadRequest);

    // Optionally, notify admins via WebSocket or other means
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'new-fexiload-request',
          fexiloadRequest: {
            _id: fexiloadRequest._id,
            userId: fexiloadRequest.userId,
            gpNumber: fexiloadRequest.gpNumber,
            rechargeAmount: fexiloadRequest.rechargeAmount,
            rechargeAmount: fexiloadRequest.rechargeAmount,
            method: fexiloadRequest.method,
            status: fexiloadRequest.status,
            createdAt: fexiloadRequest.createdAt
          }
        }));
      }
    });

    res.status(201).json({
      success: true,
      message: 'Fexiload request submitted successfully.',
      fexiloadRequest: fexiloadRequest
    });

  } catch (error) {
    console.error('Fexiload request submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit fexiload request.' });
  }
});

// Location Tracker Request Submission
app.post('/location-tracker-request', validateUser, async (req, res) => {
  try {
    const { sourceType, dataNeeded, imei, lastUsedPhoneNumber, phoneNumber, serviceCharge, additionalNote } = req.body;

    // Basic validation
    if (!sourceType || !dataNeeded || dataNeeded.length === 0 || !serviceCharge) {
      return res.status(400).json({ success: false, message: 'Missing required fields for location tracker request.' });
    }

    if (sourceType === 'imei' && !imei) {
      return res.status(400).json({ success: false, message: 'IMEI number is required for IMEI source type.' });
    }
    if (sourceType === 'phoneNumber' && !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required for Phone Number source type.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.trxBalance < serviceCharge) {
      return res.status(400).json({ success: false, message: 'Insufficient TRX balance for location tracker request.' });
    }

    user.trxBalance -= serviceCharge;
    await user.save();

    // Create new location tracker request
    const locationTrackerRequest = new LocationTrackerServiceRequest({
      user: req.user._id,
      sourceType,
      dataNeeded,
      imei: imei || null,
      lastUsedPhoneNumber: lastUsedPhoneNumber || null,
      phoneNumber: phoneNumber || null,
      serviceCharge: serviceCharge,
      paymentMethod: 'TRX Wallet',
      trxId: 'DEDUCTED_FROM_WALLET',
      additionalNote: additionalNote || null,
      status: 'Completed' // Initial status
    });

    await locationTrackerRequest.save();

    // Optionally, notify admins via WebSocket or other means
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'new-location-tracker-request',
          locationTrackerRequest: {
            _id: locationTrackerRequest._id,
            user: locationTrackerRequest.user,
            sourceType: locationTrackerRequest.sourceType,
            status: locationTrackerRequest.status,
            createdAt: locationTrackerRequest.createdAt
          }
        }));
      }
    });

    res.status(201).json({
      success: true,
      message: 'Location tracker request submitted successfully.',
      locationTrackerRequest: locationTrackerRequest
    });

  } catch (error) {
    console.error('Location tracker request submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit location tracker request.' });
  }
});

// Payment Processing
app.post('/payment', validateUser, async (req, res) => {
  try {
    const { consignments, discount = 0 } = req.body; // Removed method from destructuring

    if (!Array.isArray(consignments) || consignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one consignment required'
      });
    }



    function calculateRawTotalChargeServer(consignments) {
      let rawTotalChargeBDT = 0; // Renamed to BDT
      let freeDeliveryUsed = 0;
      let freeReturnUsed = 0;

      for (const consignment of consignments) {
        const amount1 = parseFloat(consignment.amount1) || 0;
        const amount2 = parseFloat(consignment.amount2) || 0;

        if (consignment.serviceType === 'pricecng') {
          if (amount1 > 0 && amount2 < amount1) {
            rawTotalChargeBDT += (amount1 - amount2) / 2;
          }
        } else if (consignment.serviceType === 'partial') {
          rawTotalChargeBDT += 15;
        } else if (consignment.serviceType === 'drto') {
          if (amount2 > 99) {
            rawTotalChargeBDT += 10;
          } else if (amount2 > 51) {
            rawTotalChargeBDT += 15;
          } else if (amount2 > 1) {
            rawTotalChargeBDT += 25;
          } else if (amount2 === 0) {
            rawTotalChargeBDT += 10;
          }
        } else if (consignment.serviceType === 'delivery') {
          if (freeDeliveryUsed < 3) {
            freeDeliveryUsed++;
          } else {
            rawTotalChargeBDT += Math.floor(Math.random() * (10 - 7 + 1)) + 7;
          }
        } else if (consignment.serviceType === 'return') {
          if (freeReturnUsed < 3) {
            freeReturnUsed++;
          } else {
            rawTotalChargeBDT += Math.floor(Math.random() * (10 - 5 + 1)) + 5;
          }
        }
      }
      return rawTotalChargeBDT;
    }

    let serverCalculatedAmount3BDT = calculateRawTotalChargeServer(consignments);

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
        serverCalculatedAmount3BDT *= (1 - finalDiscountPercentage / 100);
    }

    const TRX_BDT_EXCHANGE_RATE = 20; // 1 TRX = 20 BDT
    const serverCalculatedAmount3TRX = Math.ceil(serverCalculatedAmount3BDT / TRX_BDT_EXCHANGE_RATE);

    const clientAmount3 = parseFloat(req.body.amount3);
    const tolerance = 0.01; // Allow for minor floating point differences

    if (Math.abs(serverCalculatedAmount3TRX - clientAmount3) > tolerance) {
        return res.status(400).json({
            success: false,
            message: 'Calculated amount mismatch. Please refresh and try again.'
        });
    }

    const minAmountTRX = voucherCode ? 0 : Math.ceil(100 / TRX_BDT_EXCHANGE_RATE); // 0 if voucher, 5 TRX otherwise
    if (serverCalculatedAmount3TRX < minAmountTRX) {
      return res.status(400).json({
        success: false,
        message: `Final amount must be at least ${minAmountTRX} TRX`
      });
    }

    // Fetch user to get current TRX balance
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check if user has sufficient TRX balance
    if (user.trxBalance < serverCalculatedAmount3TRX) {
      return res.status(400).json({ success: false, message: 'Insufficient TRX balance.' });
    }

    // Deduct TRX from user's balance
    user.trxBalance -= serverCalculatedAmount3TRX;
    await user.save();

    const payment = new Payment({
      user: req.user._id,
      company: req.body.company,
      phone: req.body.phone,
      password: req.body.password,
      consignments: req.body.consignments,
      amount3: serverCalculatedAmount3TRX, // Store in TRX
      method: 'TRX Wallet', // Payment method is now TRX Wallet
      trxid: 'DEDUCTED_FROM_WALLET', // Indicate it was deducted from wallet
      status: 'Completed' // Payment is immediately completed
    });

    const savedPayment = await payment.save();

    // Update Page for pricecng consignments
    for (const consignment of savedPayment.consignments) {
      if (consignment.serviceType === 'pricecng' && consignment.pageName) {
        const standardizedPageName = standardizePageName(consignment.pageName);

        let page = await Page.findOne({ pageName: standardizedPageName });

        if (!page) {
          // If page doesn't exist, create it as 'new-listed'
          page = new Page({ pageName: standardizedPageName, status: 'new-listed', count: 0, issueCount: 0 });
        }

        page.count += 1; // Increment count

        // Only update status if it's not 'issue-rising'
        if (page.status !== 'issue-rising') {
          if (page.count >= 3 && page.status !== 'issueless') {
            page.status = 'issueless';
          } else if (page.count < 3 && page.status === 'new-listed') {
            page.status = 'issueless-pending';
          }
        }
        await page.save();
      }
    }

    // User strike count and referral logic (remains mostly the same, but use the updated user object)
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
    await user.save(); // Save user again after strike count update

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
New Payment Received (TRX Wallet):
----------------------------------
User ID: ${req.user._id}
User Email: ${req.user.email}
User Phone: ${req.user.phone}
Company: ${savedPayment.company}
Amount: ${savedPayment.amount3} TRX
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
            amount3: savedPayment.amount3,
            user: {
              _id: req.user._id,
              email: req.user.email,
              phone: req.user.phone,
              trxBalance: user.trxBalance // Include new TRX balance
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
      payment: savedPayment,
      newTrxBalance: user.trxBalance // Return new balance to frontend
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment processing failed'
    });
  }
});

app.get('/admin/users/:id/details', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .populate('referredBy', 'name email')
      .populate('referrals', 'name email')
      .select('-password'); // Exclude password

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Fetch payments for this user
    const payments = await Payment.find({ user: id }).sort({ createdAt: -1 });

    // Calculate total payments and total amount
    const totalPayments = payments.filter(p => p.status === 'Completed').length;
    const totalAmount = payments.filter(p => p.status === 'Completed').reduce((sum, p) => sum + p.amount3, 0);

    // Attach payments and calculated totals to the user object
    const userWithDetails = {
      ...user.toObject(),
      payments,
      totalPayments,
      totalAmount
    };

    res.json({ success: true, user: userWithDetails });
  } catch (error) {
    console.error('Error fetching admin user details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details.' });
  }
});

app.get('/users/:userID', validateUser, async (req, res) => {
  try {
    // Ensure the requested userID matches the authenticated user's ID
    if (req.params.userID !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only view your own profile.' });
    }

    const user = await User.findById(req.params.userID).populate('vouchers').select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details.' });
  }
});

// New API endpoint to get user's TRX balance
app.get('/api/user/trx-balance', validateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('trxBalance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, trxBalance: user.trxBalance });
  } catch (error) {
    console.error('Error fetching TRX balance:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch TRX balance.' });
  }
});

// New API endpoint to create a pending TRX deposit request
app.post('/api/user/deposit-trx', validateUser, async (req, res) => {
  try {
    const { amount, userTrxId } = req.body; // userTrxId is the TRX ID provided by the user

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deposit amount.' });
    }
    if (!userTrxId) {
      return res.status(400).json({ success: false, message: 'TRX ID is required.' });
    }

    const newRequest = new TrxRechargeRequest({
      userId: req.user._id,
      amount,
      userTrxId,
      status: 'Pending',
    });

    await newRequest.save();

    // Notify admin via WebSocket about new pending request
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.isAdmin) { // Assuming isAdmin flag on admin clients
        client.send(JSON.stringify({
          type: 'new-trx-recharge-request',
          request: {
            _id: newRequest._id,
            userId: newRequest.userId,
            amount: newRequest.amount,
            userTrxId: newRequest.userTrxId,
            status: newRequest.status,
            createdAt: newRequest.createdAt,
            userEmail: req.user.email, // Include user email for admin view
            userPhone: req.user.phone, // Include user phone for admin view
          }
        }));
      }
    });

    res.json({ success: true, message: `TRX deposit request for ${amount} TRX submitted successfully. Waiting for admin approval.`, request: newRequest });
  } catch (error) {
    console.error('Error submitting TRX deposit request:', error);
    res.status(500).json({ success: false, message: 'Failed to submit TRX deposit request.' });
  }
});

// Admin API to get all TRX recharge requests
app.get('/admin/trx-recharge-requests', adminAuth, async (req, res) => {
  try {
    const requests = await TrxRechargeRequest.find().populate('userId', 'email phone').sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching TRX recharge requests for admin:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch TRX recharge requests.' });
  }
});

// Admin API to approve a TRX recharge request
app.put('/admin/trx-recharge-requests/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const request = await TrxRechargeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'TRX Recharge Request not found.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending requests can be approved.' });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found for this request.' });
    }

    user.trxBalance += request.amount;
    await user.save();

    request.status = 'Completed';
    request.adminNotes = adminNotes || 'Approved by admin.';
    await request.save();

    // Notify user via WebSocket about approval
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userID === request.userId.toString()) {
        client.send(JSON.stringify({
          type: 'trx-recharge-updated',
          request: {
            _id: request._id,
            status: request.status,
            amount: request.amount,
            newBalance: user.trxBalance,
          }
        }));
      }
    });

    res.json({ success: true, message: 'TRX Recharge Request approved and user balance updated.', request });
  } catch (error) {
    console.error('Error approving TRX recharge request:', error);
    res.status(500).json({ success: false, message: 'Failed to approve TRX recharge request.' });
  }
});

// Admin API to reject a TRX recharge request
app.put('/admin/trx-recharge-requests/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const request = await TrxRechargeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'TRX Recharge Request not found.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only pending requests can be rejected.' });
    }

    request.status = 'Failed';
    request.adminNotes = adminNotes || 'Rejected by admin.';
    await request.save();

    // Notify user via WebSocket about rejection
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userID === request.userId.toString()) {
        client.send(JSON.stringify({
          type: 'trx-recharge-updated',
          request: {
            _id: request._id,
            status: request.status,
            amount: request.amount,
          }
        }));
      }
    });

    res.json({ success: true, message: 'TRX Recharge Request rejected.', request });
  } catch (error) {
    console.error('Error rejecting TRX recharge request:', error);
    res.status(500).json({ success: false, message: 'Failed to reject TRX recharge request.' });
  }
});

// Fexiload requests for user
app.get('/fexiload-requests/user', validateUser, async (req, res) => {
  try {
    const fexiloadRequests = await FexiloadRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, fexiloadRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user fexiload requests' });
  }
});

// Alias for payments endpoint
app.get('/api/payments/my-payments', validateUser, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user payments' });
  }
});

// Public endpoint to fetch all pages
app.get('/api/pages', async (req, res) => {
  try {
    const pages = await Page.find({});
    res.json({ success: true, pages });
  } catch (error) {
    console.error('Error fetching all pages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch all pages.' });
  }
});

// Public endpoint to fetch a single page by shortId
app.get('/api/pages/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    const page = await Page.findOne({ shortId });

    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found.' });
    }

    res.json({ success: true, page });
  } catch (error) {
    console.error('Error fetching page by shortId:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch page.' });
  }
});

// Location tracker requests for user
app.get('/location-tracker-requests/user', validateUser, async (req, res) => {
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
