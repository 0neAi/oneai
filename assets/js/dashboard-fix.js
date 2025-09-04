// Update refreshPayments function
async function refreshPayments() {
    const loadingOverlay = document.querySelector('.loading-overlay'); // Re-select to be safe
    console.log('refreshPayments: Starting.');
    try {
        // No need to show overlay here, DOMContentLoaded handles it
        
        // Clear existing timers
        Object.values(paymentState.paymentTimers).forEach(timer => clearInterval(timer));
        paymentState.paymentTimers = {};
        
        const authToken = localStorage.getItem('authToken');
        const userID = localStorage.getItem('userID');

        const response = await fetch('https://oneai-wjox.onrender.com/payments/user', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch payments');
        }
        
        const data = await response.json();
        console.log('refreshPayments: Loaded payments from server:', data.payments);
        
        paymentState.payments = data.payments || [];
        renderAllPayments();
        updateStats();
        togglePaymentSections(); // Ensure this is called to show/hide section
        
        showSuccess('Payments refreshed successfully');
        console.log('refreshPayments: Completed successfully.');
    } catch (error) {
        console.error('refreshPayments: Error:', error);
        showError(error.message || 'Failed to refresh payments');
    } finally {
        // Only hide if this function was responsible for showing it, or if it's the last one.
        // For now, let DOMContentLoaded handle the final hide.
        // If this function is called independently, it should hide it.
        // For now, I'll keep the hide here as a safeguard.
        if (loadingOverlay) {
            // loadingOverlay.style.display = 'none'; // Commenting out to let DOMContentLoaded handle it
            console.log('refreshPayments: Finally block executed.');
        }
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
                if (data.payment.status === 'Completed') {
                    handlePaymentCompletion(data.payment);
                }
            } else if (data.type === 'new-payment') {
                addNewPayment(data.payment);
            } else if (data.type === 'new-fexiload-request') {
                addNewFexiloadRequest(data.fexiloadRequest);
            } else if (data.type === 'fexiload-updated') {
                updateFexiloadRequestStatus(data.fexiloadRequest);
                if (data.fexiloadRequest.status === 'Completed') {
                    handleFexiloadCompletion(data.fexiloadRequest);
                }
            } else if (data.type === 'notification') {
                showSuccess(data.message);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    };

    paymentState.ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };

    paymentState.ws.onclose = () => {
        console.log('WebSocket disconnected - attempting to reconnect...');
        setTimeout(connectWebSocket, 5000);
    };
}

async function refreshFexiloadRequests() {
    const loadingOverlay = document.querySelector('.loading-overlay'); // Re-select to be safe
    console.log('refreshFexiloadRequests: Starting.');
    try {
        // No need to show overlay here, DOMContentLoaded handles it

        Object.values(paymentState.fexiloadTimers).forEach(timer => clearInterval(timer));
        paymentState.fexiloadTimers = {};

        const authToken = localStorage.getItem('authToken');
        const userID = localStorage.getItem('userID');

        const response = await fetch('https://oneai-wjox.onrender.com/fexiload-requests/user', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch fexiload requests');
        }

        const data = await response.json();
        paymentState.fexiloadRequests = data.fexiloadRequests || [];

        renderAllFexiloadRequests();
        toggleFexiloadSections(); // Ensure this is called to show/hide section

        showSuccess('Fexiload requests refreshed successfully');
        console.log('refreshFexiloadRequests: Completed successfully.');
    } catch (error) {
        console.error('refreshFexiloadRequests: Error:', error);
        showError(error.message || 'Failed to refresh fexiload requests');
    } finally {
        // Only hide if this function was responsible for showing it, or if it's the last one.
        // For now, let DOMContentLoaded handle the final hide.
        // If this function is called independently, it should hide it.
        // For now, I'll keep the hide here as a safeguard.
        if (loadingOverlay) {
            // loadingOverlay.style.display = 'none'; // Commenting out to let DOMContentLoaded handle it
            console.log('refreshFexiloadRequests: Finally block executed.');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded: Starting dashboard initialization.');
    if ('Notification' in window) {
        try {
            await Notification.requestPermission();
        } catch (error) {
            console.error('Notification permission error:', error);
        }
    }
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex'; // Show loading overlay
        console.log('DOMContentLoaded: Loading overlay shown.');
    } else {
        console.error('DOMContentLoaded: Loading overlay element not found!');
    }
    
    try {
        const authToken = localStorage.getItem('authToken');
        const userID = localStorage.getItem('userID');
        
        if (!authToken || !userID) {
            console.log('DOMContentLoaded: Auth token or User ID missing, redirecting to index.html.');
            window.location.href = 'index.html';
            return;
        }

        console.log('DOMContentLoaded: Initiating concurrent data refresh for payments and fexiload requests...');
        await Promise.all([
            refreshPayments(),
            refreshFexiloadRequests()
        ]);
        console.log('DOMContentLoaded: Both payments and fexiload requests refreshed concurrently.');
        
        connectWebSocket();
        console.log('DOMContentLoaded: WebSocket connection initiated.');
        
    } catch (error) {
        console.error('DOMContentLoaded: Initialization error:', error);
        showError('Failed to load dashboard data');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    } finally {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none'; // Hide loading overlay
            console.log('DOMContentLoaded: Loading overlay hidden in finally block.');
        }
    }
});
