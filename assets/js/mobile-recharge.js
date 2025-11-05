document.addEventListener('DOMContentLoaded', async () => {
  const mobileRechargeForm = document.getElementById('mobileRechargeForm');
  const phoneNumberInput = document.getElementById('phoneNumber');
  const amountInput = document.getElementById('amount');
  const operatorInput = document.getElementById('operator');
  const messageDiv = document.getElementById('message');
  const trxBalanceSpan = document.getElementById('trxBalance');
  const rechargeHistoryTableBody = document.querySelector('#rechargeHistoryTable tbody');

  const token = localStorage.getItem('token');
  const userID = localStorage.getItem('userID');

  if (!token || !userID) {
    window.location.href = 'login.html';
    return;
  }

  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:10000'
    : 'https://oneai-wjox.onrender.com';

  // WebSocket connection
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send(JSON.stringify({ type: 'register', userID: userID }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'mobile-recharge-updated' && data.request.userId === userID) {
      fetchTrxBalance();
      fetchMobileRechargeHistory();
      showMessage(`Mobile Recharge Request ${data.request.status}: ${data.request.amount} BDT for ${data.request.phoneNumber}`, data.request.status === 'Completed' ? 'success' : 'error');
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  async function fetchTrxBalance() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/trx-balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userID
        }
      });
      const data = await response.json();
      if (data.success) {
        trxBalanceSpan.textContent = `${data.trxBalance.toFixed(2)} TRX`;
      } else {
        trxBalanceSpan.textContent = 'Error loading balance';
        console.error('Failed to fetch TRX balance:', data.message);
      }
    } catch (error) {
      trxBalanceSpan.textContent = 'Error loading balance';
      console.error('Error fetching TRX balance:', error);
    }
  }

  async function fetchMobileRechargeHistory() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile-recharge/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userID
        }
      });
      const data = await response.json();
      if (data.success) {
        rechargeHistoryTableBody.innerHTML = ''; // Clear existing history
        if (data.requests.length === 0) {
          rechargeHistoryTableBody.innerHTML = '<tr><td colspan="6">No mobile recharge requests found.</td></tr>';
          return;
        }
        data.requests.forEach(request => {
          const row = rechargeHistoryTableBody.insertRow();
          row.insertCell().textContent = request.phoneNumber;
          row.insertCell().textContent = `${request.amount} BDT`;
          row.insertCell().textContent = `${request.trxAmount} TRX`;
          row.insertCell().textContent = request.operator;
          row.insertCell().textContent = request.status;
          row.insertCell().textContent = new Date(request.createdAt).toLocaleString();
        });
      } else {
        console.error('Failed to fetch mobile recharge history:', data.message);
        rechargeHistoryTableBody.innerHTML = '<tr><td colspan="6">Error loading history.</td></tr>';
      }
    } catch (error) {
      console.error('Error fetching mobile recharge history:', error);
      rechargeHistoryTableBody.innerHTML = '<tr><td colspan="6">Error loading history.</td></tr>';
    }
  }

  mobileRechargeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const phoneNumber = phoneNumberInput.value;
    const amount = parseFloat(amountInput.value);
    const operator = operatorInput.value;

    messageDiv.innerHTML = ''; // Clear previous messages

    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile-recharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userID
        },
        body: JSON.stringify({ phoneNumber, amount, operator })
      });

      const data = await response.json();

      if (data.success) {
        showMessage(data.message, 'success');
        phoneNumberInput.value = '';
        amountInput.value = '';
        operatorInput.value = '';
        fetchTrxBalance(); // Update balance immediately
        fetchMobileRechargeHistory(); // Update history immediately
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      console.error('Mobile recharge request failed:', error);
      showMessage('An unexpected error occurred. Please try again.', 'error');
    }
  });

  function showMessage(msg, type) {
    messageDiv.innerHTML = `<div class="${type === 'success' ? 'alert-success' : 'alert-error'}">${msg}</div>`;
    // Basic styling for messages (can be improved with CSS)
    if (type === 'success') {
      messageDiv.style.color = 'green';
    } else {
      messageDiv.style.color = 'red';
    }
  }

  // Initial loads
  fetchTrxBalance();
  fetchMobileRechargeHistory();
});
