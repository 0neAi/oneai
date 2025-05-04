const router = require('express').Router();
const Payment = require('./models/Payment');
const WebSocket = require('ws'); // Added WebSocket import

router.put('/:id', async (req, res) => {
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
    ).populate('user', 'email phone');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // WebSocket implementation with safety checks
    try {
      const wss = req.app.get('wss');
      if (wss?.clients) { // Using optional chaining
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'payment-updated',
              payment: {
                _id: payment._id,
                status: payment.status,
                trxid: payment.trxid,
                amount3: payment.amount3,
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

module.exports = router;
