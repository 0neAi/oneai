document.addEventListener('DOMContentLoaded', async () => {
  const trxRechargeForm = document.getElementById('trx-recharge-form');
  const rechargeAmountInput = document.getElementById('recharge-amount');
  const userTrxIdInput = document.getElementById('userTrxId');
  const confirmationMessage = document.getElementById('confirmation-message');
  const loadingOverlay = document.getElementById('loading-overlay');
  const depositHistoryTableBody = document.querySelector('#depositHistoryTable tbody');
  const websiteTrxAddressSpan = document.getElementById('websiteTrxAddress');

  const token = localStorage.getItem('token');
  const userID = localStorage.getItem('userID');

  if (!token || !userID) {
    window.location.href = 'index.html';
    return;
  }

  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:10000'
    : 'https://oneai-wjox.onrender.com';

  // Placeholder for website's TRX address (replace with actual address)
  const WEBSITE_TRX_ADDRESS = 'TSSyLq1P92G2gQy2gQy2gQy2gQy2gQy2gQ'; // This should ideally come from a backend API
  if (websiteTrxAddressSpan) {
    websiteTrxAddressSpan.textContent = WEBSITE_TRX_ADDRESS;
  }

  // WebSocket connection
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${wsProtocol}//${new URL(API_BASE_URL).host}`);

  ws.onopen = () => {
    console.log('WebSocket connected for staking.html');
    ws.send(JSON.stringify({ type: 'register', userID: userID }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'trx-recharge-updated' && data.request.userId === userID) {
      fetchDepositHistory();
      // Assuming fetchAndDisplayTrxBalance is globally available from load-navbar.js
      if (typeof window.fetchAndDisplayTrxBalance === 'function') {
        window.fetchAndDisplayTrxBalance();
      }
      showMessage(`TRX Deposit Request ${data.request.status}: ${data.request.amount} TRX`, data.request.status === 'Completed' ? 'success' : 'error');
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error for staking.html:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected for staking.html');
  };

  async function fetchDepositHistory() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/trx-recharge-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userID
        }
      });
      const data = await response.json();
      if (data.success) {
        depositHistoryTableBody.innerHTML = ''; // Clear existing history
        if (data.requests.length === 0) {
          depositHistoryTableBody.innerHTML = '<tr><td colspan="5">No TRX deposit requests found.</td></tr>';
          return;
        }
        data.requests.forEach(request => {
          const row = depositHistoryTableBody.insertRow();
          row.insertCell().textContent = `${request.amount} TRX`;
          row.insertCell().textContent = request.userTrxId;
          row.insertCell().textContent = request.status;
          row.insertCell().textContent = request.adminNotes || 'N/A';
          row.insertCell().textContent = new Date(request.createdAt).toLocaleString();
        });
      } else {
        console.error('Failed to fetch deposit history:', data.message);
        depositHistoryTableBody.innerHTML = '<tr><td colspan="5">Error loading history.</td></tr>';
      }
    } catch (error) {
      console.error('Error fetching deposit history:', error);
      depositHistoryTableBody.innerHTML = '<tr><td colspan="5">Error loading history.</td></tr>
';
    }
  }

  trxRechargeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(rechargeAmountInput.value);
    const userTrxId = userTrxIdInput.value.trim();

    confirmationMessage.style.display = 'none'; // Clear previous messages

    if (isNaN(amount) || amount <= 0) {
      showMessage('Please enter a valid positive amount for TRX recharge.', 'error');
      return;
    }

    if (!userTrxId) {
      showMessage('Please enter your TRX Transaction ID.', 'error');
      return;
    }

    loadingOverlay.style.display = 'flex';

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/deposit-trx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userID
        },
        body: JSON.stringify({ amount, userTrxId })
      });

      const data = await response.json();

      if (data.success) {
        showMessage(data.message, 'success');
        rechargeAmountInput.value = '';
        userTrxIdInput.value = '';
        fetchDepositHistory(); // Refresh history
        // Assuming fetchAndDisplayTrxBalance is globally available from load-navbar.js
        if (typeof window.fetchAndDisplayTrxBalance === 'function') {
          window.fetchAndDisplayTrxBalance();
        }
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      console.error('TRX deposit request failed:', error);
      showMessage('An unexpected error occurred. Please try again.', 'error');
    } finally {
      loadingOverlay.style.display = 'none';
    }
  });

  function showMessage(text, type) {
    confirmationMessage.textContent = text;
    confirmationMessage.className = `confirmation-message ${type}`;
    confirmationMessage.style.display = 'block';

    setTimeout(() => {
      confirmationMessage.style.display = 'none';
    }, 5000);
  }

  window.copyToClipboard = function(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      const textToCopy = element.textContent || element.value;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showMessage('Copied to clipboard!', 'success');
      }).catch(err => {
        console.error('Failed to copy:', err);
        showMessage('Failed to copy to clipboard.', 'error');
      });
    }
  };

  // Initial load
  fetchDepositHistory();
  // createParticles(); // Assuming this is handled by the HTML or another script
});

// Create background particles (moved from inline script)
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const particleCount = 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');

    const size = Math.random() * 20 + 5;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    const posX = Math.random() * 100;
    particle.style.left = `${posX}%`;

    const duration = Math.random() * 20 + 10;
    particle.style.animationDuration = `${duration}s`;

    const delay = Math.random() * 5;
    particle.style.animationDelay = `${delay}s`;

    container.appendChild(particle);
  }
}

// Call createParticles when the DOM is ready
document.addEventListener('DOMContentLoaded', createParticles);
