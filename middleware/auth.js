import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';  

export const adminAuth = async (req, res, next) => {
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
