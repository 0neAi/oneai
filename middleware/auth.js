import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';  

export const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error("No token provided");
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const admin = await Admin.findById(decoded.adminId);
    if (!admin) throw new Error("Admin not found");
    
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin Auth Error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Admin authorization failed'
    });
  }
};
