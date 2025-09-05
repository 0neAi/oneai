const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User'); // Added User model import

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId);

    if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin Auth Error:', error);

    // ADDED SPECIFIC ERROR MESSAGES
    let message = 'Authorization failed';
    if (error.name === 'TokenExpiredError') message = 'Token expired';
    if (error.name === 'JsonWebTokenError') message = 'Invalid token';

    res.status(401).json({
      success: false,
      message
    });
  }
};

const validateUser = async (req, res, next) => { // Renamed from authMiddleware
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

module.exports = { adminAuth, validateUser }; // Export both
