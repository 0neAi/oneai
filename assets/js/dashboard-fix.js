// Global state for payments and fexiload requests
const paymentState = {
    payments: [],
    fexiloadRequests: [],
    locationTrackerRequests: [], // Added for location tracker requests
    paymentTimers: {},
    fexiloadTimers: {},
    ws: null,
};

// Utility functions for showing toasts (assuming these are defined elsewhere or need to be added)
function showSuccess(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast', 'success');
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast', 'error');
    toast.innerHTML = `<i class="fas fa-times-circle"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Function to render all payments
function renderAllPayments() {
    const paymentStatusBody = document.getElementById('payment-status');
    const paymentSection = document.getElementById('payment-section');
    const noPaymentsDiv = paymentSection.querySelector('.no-payments');

    paymentStatusBody.innerHTML = ''; // Clear existing rows

    if (paymentState.payments.length === 0) {
        // Check if noPaymentsDiv exists before trying to access its style
        if (noPaymentsDiv) {
            noPaymentsDiv.style.display = 'block';
        }
        paymentSection.style.display = 'none'; // Hide the table if no payments
        return;
    } else {
        if (noPaymentsDiv) {
            noPaymentsDiv.style.display = 'none';
        }
        paymentSection.style.display = 'block'; // Show the table if payments exist
    }

    paymentState.payments.forEach(payment => {
        const row = paymentStatusBody.insertRow();
        row.id = `payment-row-${payment._id}`; // Add an ID for easy access

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${payment.status.toLowerCase()}">${payment.status}</span>`;

        const detailsCell = row.insertCell();
        detailsCell.innerHTML = `
            <strong>TRX ID:</strong> ${payment.trxid}<br>
            <strong>Amount:</strong> ৳${payment.amount3}<br>
            <strong>Method:</strong> ${payment.method}<br>
            <strong>Company:</strong> ${payment.company}<br>
            <strong>Date:</strong> ${new Date(payment.createdAt).toLocaleString()}
        `;

        const amountCell = row.insertCell();
        amountCell.textContent = `৳${payment.amount3}`;

        const actionsCell = row.insertCell();
        const viewDetailsBtn = document.createElement('button');
        viewDetailsBtn.classList.add('action-btn', 'view-details-btn');
        viewDetailsBtn.textContent = 'View Details';
        viewDetailsBtn.onclick = () => showPaymentDetailsModal(payment);
        actionsCell.appendChild(viewDetailsBtn);
    });
}

// Function to update a single payment status (e.g., from WebSocket)
function updatePaymentStatus(updatedPayment) {
    const existingRow = document.getElementById(`payment-row-${updatedPayment._id}`);
    if (existingRow) {
        // Update status cell
        existingRow.cells[0].innerHTML = `<span class="status ${updatedPayment.status.toLowerCase()}">${updatedPayment.status}</span>`;
        // Update details cell if needed (e.g., if other fields change)
        existingRow.cells[1].innerHTML = `
            <strong>TRX ID:</strong> ${updatedPayment.trxid}<br>
            <strong>Amount:</strong> ৳${updatedPayment.amount3}<br>
            <strong>Method:</strong> ${updatedPayment.method}<br>
            <strong>Company:</strong> ${updatedPayment.company}<br>
            <strong>Date:</strong> ${new Date(updatedPayment.createdAt).toLocaleString()}
        `;
        // Find and update the payment in the local state
        const index = paymentState.payments.findIndex(p => p._id === updatedPayment._id);
        if (index !== -1) {
            paymentState.payments[index] = updatedPayment;
        }
        showSuccess(`Payment ${updatedPayment.trxid} updated to ${updatedPayment.status}`);
    } else {
        // If the payment is new, add it
        addNewPayment(updatedPayment);
    }
}

// Function to add a new payment (e.g., from WebSocket)
function addNewPayment(newPayment) {
    // Add to the beginning of the array to show newest first
    paymentState.payments.unshift(newPayment);
    renderAllPayments(); // Re-render the entire table
    showSuccess(`New payment received: ${newPayment.trxid}`);
}

// Function to handle payment completion (show popup)
function handlePaymentCompletion(completedPayment) {
    const popup = document.getElementById('payment-popup');
    document.getElementById('popup-trxid').textContent = completedPayment.trxid;
    document.getElementById('popup-amount').textContent = completedPayment.amount3;
    popup.classList.add('active');
}

// Function to close payment completion popup
function closePaymentPopup() {
    document.getElementById('payment-popup').classList.remove('active');
}

// Function to show payment details modal
function showPaymentDetailsModal(payment) {
    const modal = document.getElementById('payment-details-modal');
    const content = document.getElementById('payment-details-content');
    content.innerHTML = `
        <p><strong>TRX ID:</strong> ${payment.trxid}</p>
        <p><strong>Amount:</strong> ৳${payment.amount3}</p>
        <p><strong>Method:</strong> ${payment.method}</p>
        <p><strong>Company:</strong> ${payment.company}</p>
        <p><strong>Status:</strong> <span class="status ${payment.status.toLowerCase()}">${payment.status}</span></p>
        <p><strong>Date:</strong> ${new Date(payment.createdAt).toLocaleString()}</p>
        <h4>Consignments:</h4>
        <ul>
            ${payment.consignments.map(c => `
                <li>
                    <strong>Name:</strong> ${c.name}<br>
                    <strong>Phone:</strong> ${c.phone}<br>
                    <strong>Service Type:</strong> ${c.serviceType}<br>
                    <strong>Amount 1:</strong> ${c.amount1}<br>
                    <strong>Amount 2:</strong> ${c.amount2}
                </li>
            `).join('')}
        </ul>
    `;
    modal.style.display = 'flex';
}

// Function to close payment details modal
function closePaymentDetailsModal() {
    document.getElementById('payment-details-modal').style.display = 'none';
}

// Function to toggle payment sections visibility
function togglePaymentSections() {
    const paymentSection = document.getElementById('payment-section');
    const noPaymentsDiv = paymentSection.querySelector('.no-payments');

    if (paymentState.payments.length > 0) {
        paymentSection.style.display = 'block';
        if (noPaymentsDiv) noPaymentsDiv.style.display = 'none';
    } else {
        paymentSection.style.display = 'none';
        if (noPaymentsDiv) noPaymentsDiv.style.display = 'block';
    }
}

// Assuming updateStats, handleFexiloadCompletion, addNewFexiloadRequest, updateFexiloadRequestStatus are defined elsewhere or will be added.
// For now, I'll add a placeholder for updateStats to avoid errors.
function updateStats() {
    // This function would typically update the dashboard stats cards.
    // For now, it can be empty or log a message.
    console.log('Updating dashboard stats...');
}

// Placeholder for fexiload functions if they are not in the original snippet
function handleFexiloadCompletion(fexiloadRequest) {
    console.log('Fexiload completed:', fexiloadRequest);
    // Implement fexiload completion logic (e.g., show a popup)
}

function addNewFexiloadRequest(newFexiloadRequest) {
    console.log('New fexiload request:', newFexiloadRequest);
    // Implement logic to add new fexiload request to the UI
}

function updateFexiloadRequestStatus(updatedFexiloadRequest) {
    console.log('Fexiload request updated:', updatedFexiloadRequest);
    // Implement logic to update fexiload request status in the UI
}

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

        const response = await fetch('https://oneai-wjox.onrender.com/api/payments/my-payments', {
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
            } else if (data.type === 'new-location-tracker-request') { // Handle new location tracker requests
                addNewLocationTrackerRequest(data.locationTrackerRequest);
            } else if (data.type === 'location-tracker-updated') { // Handle updated location tracker requests
                updateLocationTrackerRequestStatus(data.locationTrackerRequest);
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
  try {
    const authToken = localStorage.getItem('authToken');
    const userID = localStorage.getItem('userID');

    const response = await fetch('https://oneai-wjox.onrender.com/fexiload-requests/user', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-User-ID': userID
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch fexiload requests');
    }

    const data = await response.json();
    paymentState.fexiloadRequests = data.fexiloadRequests || [];
    renderAllFexiloadRequests();
    toggleFexiloadSections();
  } catch (error) {
    console.error('Fexiload refresh error:', error);
  }
}

function renderAllFexiloadRequests() {
  const tbody = document.getElementById('fexiload-requests-table-body');
  tbody.innerHTML = '';

  if (paymentState.fexiloadRequests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No flexiload requests found.</td></tr>';
    return;
  }

  paymentState.fexiloadRequests.forEach(request => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${request.gpNumber}</td>
      <td>${request.rechargeAmount}</td>
      <td><span class="status ${request.status.toLowerCase()}">${request.status}</span></td>
      <td>${new Date(request.createdAt).toLocaleString()}</td>
    `;
  });
}

function toggleFexiloadSections() {
  const section = document.getElementById('fexiload-requests-section');
  if (paymentState.fexiloadRequests.length > 0) {
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

function addNewFexiloadRequest(newRequest) {
  paymentState.fexiloadRequests.unshift(newRequest);
  renderAllFexiloadRequests();
  toggleFexiloadSections();
  showSuccess(`New flexiload request received: ${newRequest.gpNumber}`);
}

function updateFexiloadRequestStatus(updatedRequest) {
  const index = paymentState.fexiloadRequests.findIndex(req => req._id === updatedRequest._id);
  if (index !== -1) {
    paymentState.fexiloadRequests[index] = updatedRequest;
    renderAllFexiloadRequests();
    showSuccess(`Flexiload request ${updatedRequest.gpNumber} updated to ${updatedRequest.status}`);
  }
}

function handleFexiloadCompletion(completedRequest) {
  showSuccess(`Flexiload request for ${completedRequest.gpNumber} completed!`);
}

// New functions for Location Tracker Requests
async function refreshLocationTrackerRequests() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    console.log('refreshLocationTrackerRequests: Starting.');
    try {
        const authToken = localStorage.getItem('authToken');
        const userID = localStorage.getItem('userID');

        const response = await fetch('https://oneai-wjox.onrender.com/location-tracker-requests/user', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userID
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch location tracker requests');
        }

        const data = await response.json();
        paymentState.locationTrackerRequests = data.locationTrackerRequests || [];

        renderAllLocationTrackerRequests();
        toggleLocationTrackerSections();

        showSuccess('Location tracker requests refreshed successfully');
        console.log('refreshLocationTrackerRequests: Completed successfully.');
    } catch (error) {
        console.error('refreshLocationTrackerRequests: Error:', error);
        showError(error.message || 'Failed to refresh location tracker requests');
    } finally {
        if (loadingOverlay) {
            console.log('refreshLocationTrackerRequests: Finally block executed.');
        }
    }
}

function renderAllLocationTrackerRequests() {
    const tableBody = document.getElementById('location-tracker-requests-table-body');
    tableBody.innerHTML = '';

    if (paymentState.locationTrackerRequests.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center">No location tracker requests found.</td></tr>`;
        return;
    }

    paymentState.locationTrackerRequests.forEach(request => {
        const row = tableBody.insertRow();
        row.id = `location-tracker-row-${request._id}`;

        const sourceTypeCell = row.insertCell();
        sourceTypeCell.textContent = request.sourceType;

        const dataNeededCell = row.insertCell();
        dataNeededCell.textContent = request.dataNeeded.join(', ');

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${request.status.toLowerCase()}">${request.status}</span>`;

        const dateCell = row.insertCell();
        dateCell.textContent = new Date(request.createdAt).toLocaleString();
    });
}

function toggleLocationTrackerSections() {
    const section = document.getElementById('location-tracker-requests-section');
    if (paymentState.locationTrackerRequests.length > 0) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}

function addNewLocationTrackerRequest(newRequest) {
    paymentState.locationTrackerRequests.unshift(newRequest);
    renderAllLocationTrackerRequests();
    showSuccess(`New location tracker request received: ${newRequest._id}`);
}

function updateLocationTrackerRequestStatus(updatedRequest) {
    const existingRequestIndex = paymentState.locationTrackerRequests.findIndex(req => req._id === updatedRequest._id);
    if (existingRequestIndex !== -1) {
        paymentState.locationTrackerRequests[existingRequestIndex] = updatedRequest;
        renderAllLocationTrackerRequests();
        showSuccess(`Location tracker request ${updatedRequest._id} updated to ${updatedRequest.status}`);
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

        console.log('DOMContentLoaded: Initiating concurrent data refresh for payments, fexiload, and location tracker requests...');
        await Promise.all([
            refreshPayments(),
            refreshFexiloadRequests(),
            refreshLocationTrackerRequests() // Call new function here
        ]);
        console.log('DOMContentLoaded: All data refreshed concurrently.');
        
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
