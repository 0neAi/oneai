// middleware/auth.js
const jwt = require('jsonwebtoken'); // Add this import
const Admin = require('../models/Admin');

exports.adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error("No token provided");
    
    // Add JWT verification
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.exp * 1000 < Date.now()) {
      throw new Error("Token expired");
    }

    const admin = await Admin.findById(decoded.adminId);
    if (!admin) throw new Error("Admin not found");
    
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin Auth Error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Admin authorization failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
