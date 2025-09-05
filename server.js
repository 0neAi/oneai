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
const dotenv = require('dotenv');
const http = require('http');
const webpush = require('web-push');
const path = require('path');

// Initialize environment variables
dotenv.config();

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

app.post('/admin/update-status', adminAuth, async (req, res) => {
  try {
    const { trxid, status } = req.body;

    if (!trxid || !status) {
      return res.status(400).json({ success: false, message: 'TRX ID and status are required.' });
    }

    const payment = await Payment.findOneAndUpdate(
      { trxid: trxid },
      { status: status },
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

    res.json({ success: true, message: 'Payment status updated.', payment });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ success: false, message: 'Failed to update payment status.' });
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
    await admin.save();

    const token = jwt.sign({ adminId: admin._id, role: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
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

    const token = jwt.sign({ adminId: admin._id, role: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin login.' });
  }
});

app.get('/admin/validate', adminAuth, (req, res) => {
  res.json({ success: true, message: 'Admin token is valid.' });
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
    const { gpNumber, rechargeAmount, transactionNumber, retailCharge, method } = req.body;

    // Basic validation
    if (!gpNumber || !rechargeAmount || !transactionNumber || !retailCharge || !method) {
      return res.status(400).json({ success: false, message: 'All fields are required for fexiload request.' });
    }

    // Create new fexiload request
    const fexiloadRequest = new FexiloadRequest({
      userId: req.user._id,
      gpNumber,
      rechargeAmount,
      transactionNumber,
      retailCharge,
      method,
      status: 'Pending' // Initial status
    });

    await fexiloadRequest.save();

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
    const { sourceType, dataNeeded, imei, lastUsedPhoneNumber, phoneNumber, serviceCharge, method: paymentMethod, trxid: trxId, additionalNote } = req.body;

    // Basic validation
    if (!sourceType || !dataNeeded || dataNeeded.length === 0 || !serviceCharge || !paymentMethod || !trxId) {
      return res.status(400).json({ success: false, message: 'Missing required fields for location tracker request.' });
    }

    if (sourceType === 'imei' && !imei) {
      return res.status(400).json({ success: false, message: 'IMEI number is required for IMEI source type.' });
    }
    if (sourceType === 'phoneNumber' && !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required for Phone Number source type.' });
    }

    // Create new location tracker request
    const locationTrackerRequest = new LocationTrackerServiceRequest({
      user: req.user._id,
      sourceType,
      dataNeeded,
      imei: imei || null,
      lastUsedPhoneNumber: lastUsedPhoneNumber || null,
      phoneNumber: phoneNumber || null,
      serviceCharge: serviceCharge,
      paymentMethod,
      trxId,
      additionalNote: additionalNote || null,
      status: 'Pending' // Initial status
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
