// Update refreshPayments function
async function refreshPayments() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');
    
    try {
        loadingOverlay.style.display = 'flex';
        
        // Clear existing timers
        Object.values(paymentState.paymentTimers).forEach(timer => clearInterval(timer));
        paymentState.paymentTimers = {};
        
        const response = await fetch('https://oneai-wjox.onrender.com/payments/user', { // FIXED ENDPOINT
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch payments');
        }
        
        const data = await response.json();
        console.log('Loaded payments from server:', data.payments);
        
        // Update state
        paymentState.payments = data.payments || [];
        
        // Render payments
        renderAllPayments();
        
        // Update stats
        updateStats();
        
        showSuccess('Payments refreshed successfully');
    } catch (error) {
        console.error('Payment refresh error:', error);
        showError(error.message || 'Failed to refresh payments');
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// Fix WebSocket connection
function connectWebSocket() {
    if (paymentState.ws) paymentState.ws.close();
    
    paymentState.ws = new WebSocket('wss://oneai-wjox.onrender.com');

    paymentState.ws.onopen = () => {
        console.log('WebSocket Connected');
        const authToken = localStorage.getItem('authToken');
        const userID = localStorage.getItem('userID');
        
        // Send authentication
        paymentState.ws.send(JSON.stringify({
            type: 'auth',
            token: authToken,
            userId: userID
        }));
    };

    paymentState.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data);
            
            if (data.type === 'payment-updated') {
                updatePaymentStatus(data.payment);
            } else if (data.type === 'new-payment') {
                addNewPayment(data.payment);
            } else if (data.type === 'notification') {
                showSuccess(data.message);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    };

    // ... rest of WebSocket code ...
}
