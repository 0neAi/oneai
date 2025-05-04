exports.adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Authorization token required' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.exp * 1000 < Date.now()) {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }

    const admin = await Admin.findById(decoded.adminId);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin Auth Error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};
