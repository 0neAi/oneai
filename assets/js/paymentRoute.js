const router = require('express').Router();
const Payment = require('../../models/Payment');
const WebSocket = require('ws');
const { adminAuth } = require('../../middleware/auth');
const User = require('../../models/User');

router.post('/', async (req, res) => {
  try {
    // Validate required fields
    const { company, phone, password, consignments, discount } = req.body;
    if (!company || !phone || !password || !consignments || !Array.isArray(consignments) || consignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate Bangladeshi phone number format
    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }



    // Validate discount
    if (discount < 0 || discount > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount value'
      });
    }

    // Process each consignment
    let amount3 = 0;
   const validServiceTypes = ['pricecng', 'partial', 'drto', 'delivery', 'return', 'list'];
    
    for (const consignment of consignments) {
      const { serviceType, name, phone: customerPhone, amount1, amount2 } = consignment;
      
      // Validate service type
      if (!validServiceTypes.includes(serviceType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid service type: ${serviceType}`
        });
      }
      
      // Validate customer details
      if (!name || !customerPhone || !phoneRegex.test(customerPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer details'
        });
      }
      
      // Validate amounts based on service type
      if (serviceType === 'pricecng' || serviceType === 'partial') {
        if (typeof amount1 !== 'number' || typeof amount2 !== 'number' ||
            amount1 < 00 || amount1 > 100000 || amount2 < 00 || amount2 > 100000) {
          return res.status(400).json({
            success: false,
            message: 'Amounts must be between 00 and 100,000'
          });
        }
        
        if (amount2 >= amount1) {
          return res.status(400).json({
            success: false,
            message: 'Updated amount must be less than original amount'
          });
        }
        
        // Calculate charge for price change/partial
        amount3 += (amount1 - amount2) / 2;
      } 
      else if (serviceType === 'drto') {
        if (typeof amount2 !== 'number' || amount2 < 0 || amount2 > 100000) {
          return res.status(400).json({
            success: false,
            message: 'Amount must be between 0 and 100,000'
          });
        }
        
        // Apply charge only if amount is less than 40
        if (amount2 < 40) {
          amount3 += 40;
        }
      }
      // Delivery and Return services have no charge
    }
    
    // Apply discount
    if (discount > 0) {
      amount3 *= (1 - discount / 100);
    }
    
    // Validate final amount in TRX
    if (serverCalculatedAmount3TRX < 0 || serverCalculatedAmount3TRX > 1500) {
      return res.status(400).json({
        success: false,
        message: 'Final amount must be between 0 and 1500 TRX'
      });
    }
    
    const TRX_BDT_EXCHANGE_RATE = 20; // 1 TRX = 20 BDT
    const serverCalculatedAmount3TRX = Math.ceil(amount3 / TRX_BDT_EXCHANGE_RATE);

    // Get user ID from authentication headers
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }
    
    const userID = req.headers['x-user-id'];
    if (!userID) {
      return res.status(401).json({
        success: false,
        message: 'User ID required'
      });
    }
    
    // Verify user exists and has sufficient TRX balance
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.trxBalance < serverCalculatedAmount3TRX) {
      return res.status(400).json({ success: false, message: 'Insufficient TRX balance.' });
    }

    // Deduct TRX from user's balance
    user.trxBalance -= serverCalculatedAmount3TRX;
    await user.save();
    
    // Create payment record
    const payment = new Payment({
      user: userID,
      company,
      phone,
      password,
      method: 'TRX Wallet',
      trxid: 'DEDUCTED_FROM_WALLET',
      consignments,
      discount,
      amount3: serverCalculatedAmount3TRX,
      status: 'Completed' // Payment is immediately completed
    });
    
    const savedPayment = await payment.save();
    
    // Send WebSocket notification
// Add try-catch to WebSocket broadcast
try {
  const wss = req.app.get('wss');
  if (wss?.clients) {
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
              _id: user._id,
              email: user.email,
              phone: user.phone,
              trxBalance: user.trxBalance // Include new TRX balance
            },
            company: savedPayment.company,
            createdAt: savedPayment.createdAt
          }
        }));
      }
    });
  }
} catch (wsError) {
  console.error('WebSocket notification failed:', wsError);
}
    
    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment: savedPayment,
      newTrxBalance: user.trxBalance // Return new balance to frontend
    });
    
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    // Validate status input
    const validStatuses = ['Pending', 'Completed', 'Failed'];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: Pending, Completed, Failed'
      });
    }

    // Update payment with validation
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { 
        new: true,
        runValidators: true,
        context: 'query'
      }
    ).populate({
      path: 'user',
      select: 'email phone'
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // WebSocket implementation with safety checks
    try {
      const wss = req.app.get('wss');
      if (wss?.clients) {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'payment-updated',
              payment: {
                _id: payment._id,
                status: payment.status,
                trxid: payment.trxid,
                amount3: payment.amount3,
                user: payment.user,
                company: payment.company,
                createdAt: payment.createdAt
              }
            }));
          }
        });
      }
    } catch (wsError) {
      console.error('WebSocket notification failed:', wsError);
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      payment: {
        _id: payment._id,
        status: payment.status,
        amount3: payment.amount3,
        trxid: payment.trxid,
        user: payment.user,
        createdAt: payment.createdAt
      }
    });

  } catch (error) {
    console.error('Payment update error:', error);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Payment update failed',
      errorType: error.name
    });
  }
});

router.get('/', adminAuth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments: payments.map(payment => ({
        ...payment.toObject(),
        user: payment.user || { email: 'N/A', phone: 'N/A' }
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
});

module.exports = router;
