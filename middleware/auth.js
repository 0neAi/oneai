// middleware/auth.js
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');

exports.adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error("No token provided");
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.exp * 1000 < Date.now()) throw new Error("Token expired");
    
    const admin = await Admin.findById(decoded.adminId);
    if (!admin) throw new Error("Admin not found");
    
    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Admin authorization failed' });
  }
};
